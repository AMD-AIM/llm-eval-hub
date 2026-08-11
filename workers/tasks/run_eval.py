from __future__ import annotations

import asyncio
import json
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from celery.utils.log import get_task_logger
from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from apps.api.app.core.crypto import SecretCipher
from apps.api.app.db.models import (
    DatasetVersion,
    EndpointRevision,
    RequestAttempt,
    Run,
    RunDataset,
    RunMetric,
    SampleExecution,
)
from apps.api.app.db.models import (
    SampleScore as SampleScoreModel,
)
from apps.api.app.db.session import SessionLocal
from apps.api.app.services.endpoints import auth_headers
from packages.eval_engine.adapters import OpenAICompatibleAdapter
from packages.eval_engine.aggregators import aggregate_records
from packages.eval_engine.contracts import (
    EvalSample,
    EvaluationRecord,
    InferenceResult,
    ModelRequest,
    ParsedAnswer,
    SampleScore,
)
from packages.eval_engine.datasets import validate_dataset
from packages.eval_engine.parsers import create_parser
from packages.eval_engine.rendering import JinjaPromptRenderer
from packages.eval_engine.scorers import create_scorer
from workers.celery_app import celery_app

logger = get_task_logger(__name__)
TERMINAL_SAMPLE_STATUSES = {"SUCCEEDED", "API_ERROR", "PARSE_ERROR", "SCORE_ERROR", "CANCELLED"}


class AsyncRateLimiter:
    def __init__(self, qps: float):
        self.interval = 1 / qps if qps > 0 else 0
        self.lock = asyncio.Lock()
        self.next_allowed = 0.0

    async def wait(self) -> None:
        async with self.lock:
            loop = asyncio.get_running_loop()
            now = loop.time()
            delay = max(0.0, self.next_allowed - now)
            if delay:
                await asyncio.sleep(delay)
            self.next_allowed = loop.time() + self.interval


def _cancel_if_requested(execution_id: str) -> bool:
    with SessionLocal() as db:
        execution = db.get(SampleExecution, execution_id)
        if execution is None:
            return True
        run_dataset = db.get(RunDataset, execution.run_dataset_id)
        run = db.get(Run, run_dataset.run_id) if run_dataset else None
        if run is not None and not run.cancel_requested:
            return False
        execution.status = "CANCELLED"
        execution.completed_at = datetime.now(UTC)
        db.commit()
        return True


def _materialize(run_dataset: RunDataset, version: DatasetVersion) -> dict[str, EvalSample]:
    validated = validate_dataset(Path(version.manifest_uri), Path(version.data_uri))
    samples = {sample.sample_id: sample for sample in validated.samples}
    with SessionLocal() as db:
        existing = set(
            db.scalars(
                select(SampleExecution.sample_id).where(
                    SampleExecution.run_dataset_id == run_dataset.id
                )
            )
        )
        for sample in validated.samples:
            if sample.sample_id in existing:
                continue
            db.add(
                SampleExecution(
                    run_dataset_id=run_dataset.id,
                    sample_id=sample.sample_id,
                    inputs_json=dict(sample.inputs),
                    reference_json=sample.reference,
                    metadata_json=dict(sample.metadata),
                )
            )
        db.commit()
    return samples


async def _execute_sample(
    *,
    execution_id: str,
    sample: EvalSample,
    renderer: JinjaPromptRenderer,
    adapter: OpenAICompatibleAdapter,
    parser_config: dict[str, Any],
    scorer_config: dict[str, Any],
    limiter: AsyncRateLimiter,
    semaphore: asyncio.Semaphore,
) -> None:
    with SessionLocal() as db:
        execution = db.get(SampleExecution, execution_id)
        if execution is None or execution.status in TERMINAL_SAMPLE_STATUSES:
            return
        run_dataset = db.get(RunDataset, execution.run_dataset_id)
        run = db.get(Run, run_dataset.run_id) if run_dataset else None
        if run is None or run.cancel_requested:
            if execution:
                execution.status = "CANCELLED"
                execution.completed_at = datetime.now(UTC)
                db.commit()
            return
        execution.status = "RUNNING"
        execution.started_at = datetime.now(UTC)
        request = renderer.render(sample)
        execution.rendered_request_json = asdict(request)
        prior_attempts = (
            db.scalar(
                select(func.count(RequestAttempt.id)).where(
                    RequestAttempt.sample_execution_id == execution_id
                )
            )
            or 0
        )
        db.commit()

    async with semaphore:
        await limiter.wait()
        if _cancel_if_requested(execution_id):
            return
        inference = await adapter.infer(request)
    parser = create_parser(parser_config)
    scorer = create_scorer(scorer_config)
    answer = parser.parse(sample, inference)
    score = scorer.score(sample, answer)

    with SessionLocal() as db:
        execution = db.get(SampleExecution, execution_id)
        if execution is None:
            return
        execution.raw_response_json = (
            dict(inference.raw_response) if inference.raw_response else None
        )
        execution.output_text = inference.output_text
        execution.parsed_value_json = answer.value
        execution.parse_status = answer.status
        execution.latency_ms = inference.latency_ms
        execution.ttft_ms = inference.ttft_ms
        execution.prompt_tokens = inference.prompt_tokens
        execution.completion_tokens = inference.completion_tokens
        execution.error_type = inference.error_type
        execution.error_message_redacted = inference.error_message_redacted
        execution.completed_at = datetime.now(UTC)
        if inference.error_type:
            execution.status = "API_ERROR"
        elif answer.status != "ok":
            execution.status = "PARSE_ERROR"
        elif score.primary is None:
            execution.status = "SCORE_ERROR"
        else:
            execution.status = "SUCCEEDED"
        for trace in inference.attempt_traces:
            db.add(
                RequestAttempt(
                    sample_execution_id=execution.id,
                    attempt_no=prior_attempts + trace.attempt_no,
                    started_at=datetime.fromisoformat(trace.started_at),
                    duration_ms=trace.duration_ms,
                    http_status=trace.http_status,
                    error_type=trace.error_type,
                    response_excerpt_redacted=trace.response_excerpt_redacted,
                )
            )
        db.add(
            SampleScoreModel(
                sample_execution_id=execution.id,
                score_revision=1,
                scorer_id=scorer_config["type"],
                scorer_version=score.scorer_version,
                primary_score=score.primary,
                metrics_json=dict(score.metrics),
                passed=score.passed,
                reason=score.reason,
            )
        )
        db.commit()

    with SessionLocal() as db:
        run_dataset = db.get(RunDataset, execution.run_dataset_id)
        if run_dataset:
            run_dataset.completed_samples = (
                db.scalar(
                    select(func.count(SampleExecution.id)).where(
                        SampleExecution.run_dataset_id == run_dataset.id,
                        SampleExecution.status.in_(TERMINAL_SAMPLE_STATUSES),
                    )
                )
                or 0
            )
            db.commit()


def _records_for_aggregation(run_dataset_id: str) -> list[EvaluationRecord]:
    with SessionLocal() as db:
        executions = (
            db.scalars(
                select(SampleExecution)
                .where(SampleExecution.run_dataset_id == run_dataset_id)
                .options(selectinload(SampleExecution.scores))
            )
            .unique()
            .all()
        )
        records: list[EvaluationRecord] = []
        for execution in executions:
            score_row = execution.scores[-1] if execution.scores else None
            request_data = execution.rendered_request_json or {
                "request_id": execution.sample_id,
                "model": "",
                "mode": "chat_completions",
                "messages": None,
                "prompt": None,
                "params": {},
            }
            records.append(
                EvaluationRecord(
                    sample=EvalSample(
                        execution.sample_id,
                        execution.inputs_json,
                        execution.reference_json,
                        execution.metadata_json,
                    ),
                    request=ModelRequest(**request_data),
                    inference=InferenceResult(
                        request_id=execution.sample_id,
                        raw_response=execution.raw_response_json,
                        output_text=execution.output_text,
                        latency_ms=execution.latency_ms or 0,
                        ttft_ms=execution.ttft_ms,
                        prompt_tokens=execution.prompt_tokens,
                        completion_tokens=execution.completion_tokens,
                        error_type=execution.error_type,
                        error_message_redacted=execution.error_message_redacted,
                    ),
                    answer=ParsedAnswer(
                        execution.parsed_value_json,
                        execution.parse_status or "upstream_error",
                        "1",
                    ),
                    score=SampleScore(
                        score_row.primary_score if score_row else None,
                        score_row.metrics_json if score_row else {},
                        score_row.passed if score_row else None,
                        score_row.reason if score_row else None,
                        score_row.scorer_version if score_row else "1",
                    ),
                )
            )
        return records


def _group_value(record: EvaluationRecord, field: str) -> str:
    value = record.sample.metadata.get(field, record.sample.inputs.get(field, "<missing>"))
    if isinstance(value, dict | list) or value is None:
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


def _add_metric_rows(
    db: Any,
    run_dataset_id: str,
    metrics: dict[str, Any],
    *,
    group_key: str | None = None,
    group_value: str | None = None,
) -> None:
    primary_metric = metrics["primary_metric"]
    primary_denominator = metrics.get(f"{primary_metric}_denominator")
    for name, value in metrics.items():
        if not isinstance(value, int | float) and value is not None:
            continue
        db.add(
            RunMetric(
                run_dataset_id=run_dataset_id,
                metric_name=name,
                value=float(value) if value is not None else None,
                denominator=primary_denominator if name == primary_metric else None,
                group_key=group_key,
                group_value=group_value,
            )
        )


async def _execute_run_async(run_id: str) -> None:
    with SessionLocal() as db:
        run = db.scalar(select(Run).where(Run.id == run_id).options(selectinload(Run.datasets)))
        if run is None or run.status in {"SUCCEEDED", "CANCELLED"}:
            return
        run.status = "PREPARING"
        run.started_at = run.started_at or datetime.now(UTC)
        run.completed_at = None
        run.error_message = None
        db.commit()
        spec = run.run_spec_json
        revision = db.get(EndpointRevision, run.endpoint_revision_id)
        if revision is None:
            raise RuntimeError("Frozen endpoint revision does not exist")
        secret = SecretCipher().decrypt(revision.secret_ciphertext)
        headers = {
            **auth_headers(revision.config_json["auth_type"], secret),
            **revision.config_json.get("extra_headers", {}),
        }
        run_dataset_ids = [item.id for item in run.datasets]

    execution_config = spec["execution"]
    inference_overrides = spec["inference"]
    adapter = OpenAICompatibleAdapter(
        base_url=revision.config_json["base_url"],
        headers=headers,
        timeout_seconds=execution_config["timeout_seconds"],
        max_retries=execution_config["max_retries"],
    )
    semaphore = asyncio.Semaphore(execution_config["effective_concurrency"])
    limiter = AsyncRateLimiter(min(execution_config["qps"], revision.config_json["qps_limit"]))

    async with adapter:
        for run_dataset_id in run_dataset_ids:
            with SessionLocal() as db:
                run_dataset = db.get(RunDataset, run_dataset_id)
                assert run_dataset is not None
                version = db.get(DatasetVersion, run_dataset.dataset_version_id)
                assert version is not None
                run_dataset.status = "PREPARING"
                db.commit()
            samples = _materialize(run_dataset, version)
            manifest = version.manifest_json
            request_spec = dict(manifest["request"])
            request_spec["parameters"] = {
                **request_spec.get("parameters", {}),
                **{key: value for key, value in inference_overrides.items() if value is not None},
            }
            renderer = JinjaPromptRenderer(request_spec, spec["model_name"])
            with SessionLocal() as db:
                run_dataset = db.get(RunDataset, run_dataset_id)
                run_dataset.status = "RUNNING"
                run = db.get(Run, run_id)
                run.status = "RUNNING"
                executions = db.scalars(
                    select(SampleExecution).where(
                        SampleExecution.run_dataset_id == run_dataset_id,
                        SampleExecution.status.not_in(TERMINAL_SAMPLE_STATUSES),
                    )
                ).all()
                execution_pairs = [
                    (execution.id, samples[execution.sample_id]) for execution in executions
                ]
                db.commit()
            await asyncio.gather(
                *[
                    _execute_sample(
                        execution_id=execution_id,
                        sample=sample,
                        renderer=renderer,
                        adapter=adapter,
                        parser_config=manifest["protocol"]["parser"],
                        scorer_config=manifest["protocol"]["scorer"],
                        limiter=limiter,
                        semaphore=semaphore,
                    )
                    for execution_id, sample in execution_pairs
                ]
            )
            records = _records_for_aggregation(run_dataset_id)
            protocol = manifest["protocol"]
            labels = protocol["parser"].get("labels")
            aggregate_options = {
                "denominator_policy": protocol.get("denominator_policy", "all_scoring_samples"),
                "on_api_error": protocol.get("on_api_error", "exclude_and_report"),
                "on_parse_error": protocol.get("on_parse_error", "count_as_incorrect"),
                "labels": labels,
            }
            metrics = aggregate_records(
                records,
                **aggregate_options,
            )
            grouped_metrics: list[tuple[str, str, dict[str, Any]]] = []
            for group in manifest.get("groups", []):
                field = group.get("field")
                if not field:
                    continue
                values = sorted({_group_value(record, field) for record in records})
                for value in values:
                    group_records = [
                        record for record in records if _group_value(record, field) == value
                    ]
                    grouped_metrics.append(
                        (
                            field,
                            value,
                            aggregate_records(group_records, **aggregate_options),
                        )
                    )
            with SessionLocal() as db:
                db.execute(delete(RunMetric).where(RunMetric.run_dataset_id == run_dataset_id))
                _add_metric_rows(db, run_dataset_id, metrics)
                for group_key, group_value, group_metrics in grouped_metrics:
                    _add_metric_rows(
                        db,
                        run_dataset_id,
                        group_metrics,
                        group_key=group_key,
                        group_value=group_value,
                    )
                run_dataset = db.get(RunDataset, run_dataset_id)
                run = db.get(Run, run_id)
                assert run_dataset is not None and run is not None
                run_dataset.completed_samples = (
                    db.scalar(
                        select(func.count(SampleExecution.id)).where(
                            SampleExecution.run_dataset_id == run_dataset.id,
                            SampleExecution.status.in_(TERMINAL_SAMPLE_STATUSES),
                        )
                    )
                    or 0
                )
                if run.cancel_requested:
                    run_dataset.status = "CANCELLED"
                else:
                    run_dataset.status = "SUCCEEDED"
                run_dataset.counters_json = {
                    key: metrics[key]
                    for key in (
                        "total_samples",
                        "scored_samples",
                        "api_errors",
                        "parse_errors",
                        "score_errors",
                    )
                }
                db.commit()

    with SessionLocal() as db:
        run = db.get(Run, run_id)
        assert run is not None
        run.status = "CANCELLED" if run.cancel_requested else "SUCCEEDED"
        run.completed_at = datetime.now(UTC)
        db.commit()


@celery_app.task(bind=True, name="workers.tasks.run_eval.execute_run", acks_late=True)
def execute_run(self, run_id: str) -> None:
    del self
    try:
        asyncio.run(_execute_run_async(run_id))
    except Exception as exc:
        logger.exception("Run failed run_id=%s", run_id)
        with SessionLocal() as db:
            run = db.get(Run, run_id)
            if run:
                run.status = "FAILED"
                run.error_message = f"{type(exc).__name__}: {str(exc)[:500]}"
                run.completed_at = datetime.now(UTC)
                for run_dataset in db.scalars(
                    select(RunDataset).where(
                        RunDataset.run_id == run_id,
                        RunDataset.status.not_in({"SUCCEEDED", "CANCELLED"}),
                    )
                ):
                    run_dataset.status = "FAILED"
                db.commit()
        raise
