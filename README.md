# LLM Eval Hub

LLM Eval Hub is a self-hosted evaluation platform for OpenAI-compatible model APIs. It
provides endpoint registration, immutable endpoint revisions, versioned datasets,
asynchronous evaluation runs, per-sample diagnostics, metrics, exports, and audit logs.

The current release is the completed Phase 1 MVP. It is designed for an internal trusted
network and a small operator group. It is not a multi-tenant public service.

## What is included

- OpenAI-compatible `/v1/chat/completions` endpoint registration and capability probing
- Encrypted endpoint credentials and immutable configuration revisions
- Editable endpoint settings and guarded endpoint deletion
- YAML + JSONL dataset import with checksums and schema validation
- PostgreSQL-backed run state and Celery workers with Redis scheduling limits
- Shared endpoint concurrency and QPS enforcement across runs and workers
- Retry, cancellation, worker recovery, live progress, per-sample inspection, and exports
- Numeric, exact-match, and classification parsers/scorers with reproducible run fingerprints
- Frozen native-chat benchmark packs for GSM8K and MMLU
- Unit, contract, integration, browser, capacity, fault, recovery, and security tests

## Production deployment

Prerequisites:

- Linux with Docker Engine 24 or newer
- Docker Compose v2.20 or newer
- `openssl`
- At least 4 CPU cores, 8 GB RAM, and 20 GB free disk for a small installation

No GPU is required. LLM Eval Hub calls remote or network-accessible model APIs.

```bash
git clone <repository-url> llm-eval-hub
cd llm-eval-hub

./scripts/generate_deploy_env.sh .env.deploy http://SERVER_IP:18080
# Edit .env.deploy and configure ALLOWED_ENDPOINT_HOSTS/CIDRS.

./scripts/deploy.sh --env-file .env.deploy --with-benchmarks
```

Open `http://SERVER_IP:18080`. In the application settings, enter the `ADMIN_API_KEY`
from `.env.deploy`. The API documentation is bound to localhost by default at
`http://localhost:18000/docs`.

The production deployment uses [compose.deploy.yml](compose.deploy.yml). It contains only
PostgreSQL, Redis, the API, the worker, the web UI, and optional maintenance/bootstrap jobs.
The original [docker-compose.yml](docker-compose.yml) remains the development and regression
test stack and includes mock and experiment services.

Read [Deployment Guide](doc/DEPLOYMENT.md) before exposing the service outside a trusted LAN.

## Register an OpenAI-compatible endpoint

Given a provider request such as:

```bash
curl https://provider.example/v1/chat/completions \
  -H "Authorization: Bearer <provider-key>" \
  -H "Content-Type: application/json" \
  -d '{"model":"example-model","messages":[{"role":"user","content":"Hello"}]}'
```

register it with these values:

- Base URL: `https://provider.example/v1`
- Authentication: `Bearer`
- Model ID: `example-model`
- API key: the provider key, entered only in the encrypted credential field

The public hostname must be listed in `ALLOWED_ENDPOINT_HOSTS`. Private endpoints must fall
inside `ALLOWED_ENDPOINT_CIDRS`. Set `ALLOW_INSECURE_HTTP=true` only when a trusted internal
endpoint requires plain HTTP.

Do not place `Authorization`, `api-key`, `X-API-Key`, cookies, or other credentials in custom
headers. The API rejects sensitive headers so secrets cannot enter ordinary JSON config,
fingerprints, or worker messages.

## Bundled benchmark packs

| Dataset | Samples | Protocol |
| --- | ---: | --- |
| `gsm8k-native` | 1,319 | Test split, zero-shot generated numeric answer |
| `mmlu-lite-native` | 570 | Ten fixed samples from each of 57 subjects |
| `mmlu-full-native` | 14,042 | Full test split across 57 subjects |

MMLU Lite is a strict subset of MMLU Full. Select one of them for a run to avoid duplicate
requests. These are native chat-generation protocols; their results are not directly
equivalent to official log-likelihood-based leaderboard scores.

Benchmark source revisions, checksums, and sampling rules are frozen in
`datasets/benchmarks/source-lock.json`.

## Backup

Run backups only when no evaluation is being started or modified:

```bash
./scripts/backup.sh --env-file .env.deploy
```

The backup contains PostgreSQL state, dataset artifacts, checksums, and a protected copy of
the deployment environment. Store the complete directory securely. The encryption key is
required to decrypt registered endpoint credentials after a restore.

Restore with `scripts/restore.sh`, which requires an explicit destructive-confirmation flag and
checks that the encryption key matches the backup. See
[Operations Guide](doc/OPERATIONS.md) for recovery, upgrades, monitoring, and troubleshooting.

## Development

The development stack uses `.env` and includes a deterministic mock OpenAI service:

```bash
cp .env.example .env
python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
# Put the generated value in SECRET_ENCRYPTION_KEY.

docker compose up -d --build
```

Default development addresses:

- Web UI: `http://localhost:18080`
- API docs: `http://localhost:18000/docs`
- Mock OpenAI API: `http://localhost:18001/v1`

Local setup and validation:

```bash
make bootstrap
make test
make test-integration
make lint
cd apps/web && npm run lint && npm run build
```

Additional experiment targets are available in the [Makefile](Makefile), including browser
E2E, capacity, shared-QPS, cancellation, worker-crash, restart/restore, and security runs.

## Repository layout

```text
apps/api/          FastAPI application and Alembic migrations
apps/web/          React/Vite UI served by Nginx
packages/          Evaluation engine, adapters, parsers, scorers, and aggregators
workers/           Celery worker and Redis-backed scheduling
datasets/          Dataset schemas, deterministic fixtures, and benchmark packs
scripts/           Benchmark preparation, deployment, and backup tools
tests/             Unit, contract, integration, browser, and fault experiments
doc/               English project, deployment, and operations documentation
```

## Current limitations

- Authentication is a single administrator API key; SSO, OIDC, and RBAC are not implemented.
- The native engine currently supports text chat completions only.
- There is no automatic circuit breaker for long sequences of provider 403/5xx responses.
- Cancelled runs may not have aggregate metrics and can retain a non-terminal child-dataset
  display state even though sample facts remain available.
- Endpoint revisions used by existing runs are immutable. Editing an endpoint affects only
  future runs.
- Secret-encryption-key rotation requires an explicit migration and is not automated.

The detailed MVP evidence and remaining roadmap are summarized in
[MVP Exit Report](doc/MVP_Benchmark_Regression_Experiment_Plan.md) and
[Project Plan](doc/LLM_Evaluation_Platform_Project_Plan.md).
