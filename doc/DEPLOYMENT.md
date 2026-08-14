# Deployment Guide

This guide describes a portable single-host deployment of LLM Eval Hub. The deployment is
appropriate for an internal service, lab, or trusted LAN. Use an external TLS reverse proxy
and organizational identity controls before exposing it to a wider network.

## 1. Deployment model

[compose.deploy.yml](../compose.deploy.yml) runs these services:

| Service | Purpose | Host exposure |
| --- | --- | --- |
| `web` | Static React UI and `/api/` reverse proxy | `0.0.0.0:18080` by default |
| `api` | FastAPI and automatic Alembic migration | `127.0.0.1:18000` by default |
| `worker` | Celery evaluation execution | None |
| `postgres` | Durable metadata and sample results | None |
| `redis` | Celery broker and shared scheduling state | None |
| `artifact-init` | One-shot artifact-volume permission setup | None |

PostgreSQL, Redis, and artifact data use Compose-managed named volumes. The deployment has no
dependency on a host GPU or a host Python/Node installation.

## 2. Prerequisites

- Linux with Docker Engine 24 or newer
- Docker Compose v2.20 or newer (`docker compose version`)
- `openssl`
- A hostname or stable IP address for the web UI
- Network reachability from the worker container to each model endpoint
- Sufficient disk for PostgreSQL, imported datasets, and response history

Recommended starting capacity is 4 CPU cores, 8 GB RAM, and 20 GB free disk. Large datasets
or retained raw responses require additional storage.

## 3. Create the deployment environment

Generate secrets and a mode-0600 environment file:

```bash
./scripts/generate_deploy_env.sh .env.deploy http://SERVER_IP:18080
```

The script refuses to overwrite an existing file. Review every value before deployment.

Important settings:

| Variable | Required | Description |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | Yes | URL-safe PostgreSQL password used internally |
| `ADMIN_API_KEY` | Yes | Shared administrator key used by the API and browser |
| `SECRET_ENCRYPTION_KEY` | Yes | Fernet key used to encrypt endpoint credentials |
| `WEB_ORIGIN` | Yes | Exact browser origin allowed by API CORS |
| `WEB_BIND_ADDRESS` | No | Web listener address; default `0.0.0.0` |
| `WEB_PORT` | No | Web listener port; default `18080` |
| `API_BIND_ADDRESS` | No | Direct API listener; default `127.0.0.1` |
| `API_PORT` | No | Direct API port; default `18000` |
| `ALLOWED_ENDPOINT_HOSTS` | No | Comma-separated exact public endpoint hostnames |
| `ALLOWED_ENDPOINT_CIDRS` | No | Comma-separated private endpoint networks |
| `ALLOW_INSECURE_HTTP` | No | Permit plain HTTP endpoints when `true` |
| `WORKER_CONCURRENCY` | No | Celery process concurrency; default `4` |
| `GLOBAL_MAX_CONCURRENCY` | No | Platform-wide evaluation concurrency ceiling |

`WEB_ORIGIN` must contain only the scheme, host, and optional port. Do not include a path or a
trailing slash. Examples:

```dotenv
WEB_ORIGIN=http://10.20.30.40:18080
WEB_ORIGIN=https://eval.example.internal
```

### Endpoint network policy

The endpoint policy is deny-by-default for unknown public hosts and restricted network ranges.
For a public endpoint:

```dotenv
ALLOWED_ENDPOINT_HOSTS=api.example.com,developer.amd.com.cn
```

For an internal endpoint, include only the network ranges that are intentionally reachable:

```dotenv
ALLOWED_ENDPOINT_CIDRS=10.20.0.0/16,192.168.50.0/24
ALLOW_INSECURE_HTTP=true
```

Exact public-host allowlisting does not bypass DNS/IP safety checks. Redirects remain disabled,
and workers revalidate the destination before model requests.

## 4. Start the stack

Build, migrate, start, and wait for health checks:

```bash
./scripts/deploy.sh --env-file .env.deploy
```

To idempotently register the bundled benchmark datasets after startup:

```bash
./scripts/deploy.sh --env-file .env.deploy --with-benchmarks
```

The benchmark job is safe to repeat. It verifies immutable manifests and checksums and reports
each version as `created` or `unchanged`.

Equivalent manual commands are:

```bash
docker compose --env-file .env.deploy -f compose.deploy.yml config --quiet
docker compose --env-file .env.deploy -f compose.deploy.yml up -d --build --wait
docker compose --env-file .env.deploy -f compose.deploy.yml run --rm benchmark-register
```

## 5. First login and smoke test

1. Open the web URL configured in `WEB_ORIGIN`.
2. Open application settings in the left navigation.
3. Enter the `ADMIN_API_KEY` value from `.env.deploy`.
4. Confirm that the dashboard loads without a 401 response.
5. Register an endpoint and run capability probing.
6. Create a small evaluation before starting a full benchmark.

Local health checks:

```bash
curl -fsS http://127.0.0.1:18000/healthz
docker compose --env-file .env.deploy -f compose.deploy.yml ps
```

## 6. TLS and network exposure

The built-in Nginx container serves HTTP. For anything outside a trusted isolated LAN:

- Bind `WEB_BIND_ADDRESS` to `127.0.0.1`.
- Put Caddy, Nginx, HAProxy, or an organizational ingress in front of the web service.
- Terminate TLS at the ingress.
- Set `WEB_ORIGIN` to the final HTTPS origin.
- Restrict the direct API port to localhost.
- Add external access control because the application has one shared administrator key and no
  user-level RBAC.

Forward `/` and `/api/` to the web container/port. The web Nginx instance forwards `/api/` to
the internal API and preserves long-running SSE connections.

## 7. Deploy prebuilt images

For an offline host or private registry, build and publish the two application images:

```bash
docker build -f apps/api/Dockerfile --target runtime -t registry.example/llm-eval-hub-api:0.1.0 .
docker build -f apps/web/Dockerfile -t registry.example/llm-eval-hub-web:0.1.0 apps/web
docker push registry.example/llm-eval-hub-api:0.1.0
docker push registry.example/llm-eval-hub-web:0.1.0
```

Set these values on the target host:

```dotenv
EVALHUB_API_IMAGE=registry.example/llm-eval-hub-api:0.1.0
EVALHUB_WEB_IMAGE=registry.example/llm-eval-hub-web:0.1.0
```

Pull the images and disable local builds during deployment:

```bash
docker compose --env-file .env.deploy -f compose.deploy.yml pull api worker web
./scripts/deploy.sh --env-file .env.deploy --no-build
```

A source checkout is still required for the Compose file and management scripts, but Python and
Node build toolchains are not required on the target host.

## 8. Upgrade

Before every upgrade:

1. Confirm that no evaluation is actively running.
2. Create a backup with `scripts/backup.sh`.
3. Record the current Git revision and image tags.
4. Preserve `.env.deploy`, especially `SECRET_ENCRYPTION_KEY`.

Then update the source and redeploy:

```bash
git pull --ff-only
./scripts/deploy.sh --env-file .env.deploy
```

The API applies forward Alembic migrations before it starts accepting traffic. Do not run
multiple API replicas during a schema upgrade in this single-host deployment model.

## 9. Move to another machine

1. Stop creating new runs and wait for active runs to finish or cancel them.
2. Create a backup with `scripts/backup.sh`.
3. Copy the repository checkout, backup directory, and `.env.deploy` to the new host over an
   encrypted channel.
4. Start the new stack once to create its volumes.
5. Stop `api` and `worker` before restoring PostgreSQL and artifacts.
6. Restore the database and artifact archive as described in the Operations Guide.
7. Start the stack and verify endpoint credential decryption and a small test run.
8. Redirect DNS or the client address only after validation.

Never generate a new `SECRET_ENCRYPTION_KEY` during a move. A different key makes existing
endpoint API keys unreadable.

## 10. Development and experiment stack

The root `docker-compose.yml` is intentionally separate. It retains deterministic mock services,
test databases, fixed experiment names, and historical regression constraints. Use it for
development and evidence reproduction, not as the portable production deployment.
