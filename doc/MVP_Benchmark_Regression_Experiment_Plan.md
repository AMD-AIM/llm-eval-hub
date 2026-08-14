# MVP Benchmark and Regression Experiment Exit Report

Document version: 1.0

Evidence period: 2026-08-11 through 2026-08-13

Status: Phase 1 exit criteria completed

## Executive summary

The Phase 1 MVP was validated as a reproducible, failure-aware evaluation system for internal
OpenAI-compatible model APIs. The experiments exercised migrations, deterministic datasets,
metric correctness, distributed scheduling, capacity, retry, cancellation, worker recovery,
service restore, browser workflows, endpoint onboarding, benchmark registration, and secret/SSRF
controls.

Experiment artifacts were intentionally excluded from Git because they can contain runtime data.
The repository retains deterministic runners, fixtures, assertions, and source locks required to
reproduce the evidence.

## Completed evidence matrix

| Area | Result | Repository evidence |
| --- | --- | --- |
| Clean migration | Passed repeated upgrade, drift check, and downgrade on disposable databases | Alembic migrations and integration tests |
| Deterministic fixtures | Passed byte-for-byte regeneration with seed `20260811` | `datasets/experiments/` and fixture generator |
| Dataset API | Passed valid imports and duplicate, checksum, schema, and traversal failures | Integration and unit tests |
| Scoring oracle | Matched an independent implementation within floating-point tolerance | `tests/oracles/` |
| Fingerprint | Stable under map reordering and changed for protocol-relevant inputs | Fingerprint unit tests |
| Shared limits | Enforced endpoint QPS and concurrency across workers/runs | Redis limiter integration tests |
| Shard/claim model | Preserved idempotency under duplicate dispatch and claim expiry | Run lifecycle tests and migration `0002` |
| Capacity | Completed repeated 1,000-sample runs across concurrency levels | Capacity experiment runner |
| Retry/faults | Classified provider, parse, and empty-response failures and retried transient cases | Fault/retry experiment |
| Cancellation | Stopped new dispatch and preserved completed sample facts and exports | Cancellation experiment |
| Worker crash | Recovered expired claims without duplicate scoring | Worker-crash experiment |
| Restart/restore | Preserved database checksums across restart and clean restore | Restart/restore experiment |
| Browser E2E | Passed endpoint-to-export flow on desktop and mobile Chromium | Playwright E2E suite |
| Real endpoint onboarding | Supported manual model IDs and providers without `/v1/models` | Endpoint contract and browser tests |
| Native benchmark packs | Registered frozen GSM8K and MMLU packs idempotently | `datasets/benchmarks/` and source lock |
| Secret and SSRF controls | Found no provider-secret disclosure and rejected malicious destinations/headers | Security experiment and policy tests |

## Frozen benchmark inventory

| Dataset | Rows | Source policy |
| --- | ---: | --- |
| `gsm8k-native` | 1,319 | Pinned upstream revision, full test split |
| `mmlu-lite-native` | 570 | Fixed seed, ten rows per subject |
| `mmlu-full-native` | 14,042 | Pinned upstream revision, full test split |

The native packs use zero-shot chat generation. MMLU Lite is a strict subset of MMLU Full. Their
scores must be labeled as native chat-generation results and must not be presented as official
log-likelihood MMLU scores.

## Reproducible commands

Core validation:

```bash
make bootstrap
make test
make test-integration
make lint
cd apps/web && npm run lint && npm run build
```

Specialized experiments:

```bash
make test-capacity
make test-qps
make test-faults
make test-cancel
make test-worker-crash
make test-restart-restore
make test-browser-e2e
make test-security
```

Prepare and register frozen benchmarks:

```bash
make bootstrap-data
make prepare-benchmarks
make register-benchmarks
```

Benchmark preparation downloads only pinned upstream revisions and writes caches under the
repository `hf_cache/` directory. Runtime services do not download datasets automatically.

## Operational findings

- Model API errors must remain separate from model-answer accuracy.
- Reasoning models can consume the full completion budget without producing final `content`;
  operators must monitor `finish_reason`, completion tokens, and empty-response rate.
- Provider 403/5xx bursts can consume a large remainder of a run because the MVP has no run-level
  circuit breaker.
- Endpoint configuration must be immutable per run; editing an endpoint cannot alter historical
  execution semantics.
- Cancelled runs preserve sample facts but do not always produce aggregate metrics or a fully
  finalized child-dataset display state.
- The encryption key and artifact volume are part of the backup boundary, not optional settings.

## Exit decision

Phase 1 is closed for the following use case:

- A trusted internal operator deploys one control plane.
- The operator evaluates text-only OpenAI-compatible chat endpoints.
- Runs use versioned internal/native benchmark datasets.
- Results are reviewed with explicit error rates and frozen protocol metadata.
- The deployment is backed up and is not exposed as a public multi-tenant service.

The following work is explicitly deferred:

- OIDC/RBAC and tenant isolation
- Automatic circuit breaking, pause, and resume
- Official harness/log-likelihood protocol support
- Regression statistics and CI gates
- Multimodal, RAG, agent, and judge-based evaluation
- Automated secret-key rotation and external secret management
- Distributed control-plane deployment

Future work should preserve the per-sample fact model, explicit error taxonomy, immutable run
specification, and protocol fingerprint established by the MVP.
