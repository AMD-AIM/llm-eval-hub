# LLM Evaluation Platform Project Plan

Document status: Phase 1 MVP complete; Phase 2 is not scheduled in this repository.

## Purpose

LLM Eval Hub provides a reproducible internal evaluation workflow for OpenAI-compatible model
APIs. The system treats endpoint configuration, dataset versions, prompts, inference parameters,
parsers, scorers, and engine versions as part of an immutable evaluation protocol.

The primary design goals are:

1. Preserve enough per-sample evidence to explain every aggregate result.
2. Keep API failures separate from wrong model answers.
3. Make repeated runs reproducible and comparisons auditable.
4. Protect endpoint credentials and restrict outbound network access.
5. Recover safely from retries, duplicate task delivery, worker crashes, and service restarts.

## Phase 1 scope

The completed MVP includes:

- FastAPI, PostgreSQL, Redis, Celery, React, Vite, and Nginx
- Endpoint registration, encrypted credentials, capability probes, revisions, editing, and guarded
  deletion
- Dataset registry with YAML manifests, JSONL data, schema validation, and SHA-256 checksums
- Frozen run specifications and protocol fingerprints
- Sharded execution with idempotent claims, shared endpoint limits, retry, cancellation, and
  recovery
- Built-in choice, numeric, and exact parsers/scorers
- Accuracy and classification metrics with explicit denominator policies
- Sample inspection, filters, SSE progress, JSONL/CSV export, and audit records
- Deterministic fixture packs and native-chat GSM8K/MMLU benchmark packs
- Automated correctness, capacity, failure, recovery, browser, and security evidence

## Architecture

```text
Browser
  |
  v
Nginx web container ----> FastAPI ----> PostgreSQL
                              |
                              v
                         Redis/Celery ----> Worker ----> Model endpoint
                                                |
                                                v
                                          Artifact volume
```

The API owns control-plane validation and state transitions. Workers own model requests and
per-sample execution. PostgreSQL is the source of truth. Redis is a broker and distributed
scheduling mechanism, not the authoritative result store.

## Reproducibility boundary

Each run freezes:

- Endpoint revision and normalized endpoint configuration hash
- Model ID
- Dataset version, checksum, and manifest
- Rendered request protocol
- Parser and scorer type/version
- Inference and execution parameters
- Engine version and protocol fingerprint

Editing an endpoint or importing a new dataset version affects future runs only.

## Correctness rules

- Every dataset row has exactly one sample execution per run dataset.
- Retry attempts do not enter score denominators more than once.
- API, parse, and score failures have distinct statuses and error classes.
- Aggregate metrics declare their numerator, denominator, and error policy.
- Chat-generation MMLU is a separate protocol from log-likelihood MMLU.
- Raw prompts, responses, parsed values, and score facts remain inspectable per sample.

## Security boundary

- One administrator API key protects the MVP control plane.
- Provider credentials are encrypted at rest and never returned by the API.
- Sensitive authentication headers are forbidden in ordinary endpoint metadata.
- Outbound destinations require exact hostname or CIDR authorization.
- DNS results are checked against forbidden address ranges, redirects are disabled, and workers
  revalidate destinations before requests.
- Application logs and task payloads must not contain provider secrets.

This is suitable for a trusted internal deployment, not an internet-facing multi-tenant service.

## Phase 1 exit criteria

Phase 1 is considered complete because the repository contains evidence for:

- Clean migration and repeated startup
- Deterministic dataset generation and metric cross-checking
- Stable protocol fingerprints
- Shared concurrency and QPS enforcement
- 1,000-sample capacity runs
- Retry classification and failed-sample retry
- Cancellation without new dispatch after the cancellation boundary
- Worker crash and claim-expiry recovery
- Service restart plus PostgreSQL backup/restore validation
- Browser evaluation flow, refresh recovery, exports, and responsive layout
- Secret non-disclosure and SSRF policy enforcement

See the [MVP Exit Report](MVP_Benchmark_Regression_Experiment_Plan.md) for the summarized evidence.

## Known MVP gaps

- SSO/OIDC, role-based access control, and tenant isolation
- Automatic provider circuit breaking and run pause/resume
- Automated encryption-key rotation
- Fully finalized aggregate metrics for cancelled runs
- Official `lm-evaluation-harness` log-likelihood adapters
- Multimodal, RAG, agent-trajectory, and LLM-as-judge evaluation
- Statistical run comparison and CI regression gates
- Object storage, retention policies, and multi-node control-plane redundancy

## Future roadmap

### Phase 2: comparison and governance

- Baseline/candidate compatibility checks
- Paired deltas, confidence intervals, and regression sample lists
- Configurable pass/warn/fail gates for CI
- SSO/OIDC and project-scoped roles
- Run-level circuit breaker with pause/resume
- Provider profiles and richer protocol adapters
- Encryption-key rotation and managed secret-store integration

### Phase 3: broader evaluation modes

- Log-likelihood harness execution with pinned framework commits
- Multimodal request and artifact support
- RAG and agent trace evaluation
- Calibrated LLM-as-judge registries
- Distributed workers, object storage, and retention automation

No Phase 2 or Phase 3 feature should weaken the frozen run specification or the per-sample fact
model that defines Phase 1 correctness.
