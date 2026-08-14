# Operations Guide

This guide covers routine administration of the single-host LLM Eval Hub deployment defined in
`compose.deploy.yml`.

## Service control

Set a reusable shell array for manual administration:

```bash
COMPOSE=(docker compose --env-file .env.deploy -f compose.deploy.yml)
```

Common operations:

```bash
"${COMPOSE[@]}" ps
"${COMPOSE[@]}" logs -f api worker web
"${COMPOSE[@]}" restart api worker web
"${COMPOSE[@]}" up -d --wait
"${COMPOSE[@]}" stop
```

Do not use `docker compose down -v` unless permanent deletion of the database, Redis state, and
artifacts is explicitly intended.

## Health and queue checks

API health:

```bash
curl -fsS http://127.0.0.1:18000/healthz
```

Container and health status:

```bash
"${COMPOSE[@]}" ps
docker stats --no-stream
```

Celery worker visibility:

```bash
"${COMPOSE[@]}" exec -T worker celery -A workers.celery_app inspect ping
"${COMPOSE[@]}" exec -T redis redis-cli -n 1 LLEN native
```

PostgreSQL size:

```bash
"${COMPOSE[@]}" exec -T postgres \
  psql -U evalhub -d evalhub -c "SELECT pg_size_pretty(pg_database_size('evalhub'));"
```

## Backup

Create backups only during a quiet period. A run that changes PostgreSQL and artifact data while
the backup is in progress can produce a cross-store consistency gap.

```bash
./scripts/backup.sh --env-file .env.deploy
```

Each backup directory contains:

- `database.dump`: PostgreSQL custom-format dump
- `artifacts.tar.gz`: imported dataset and artifact volume
- `deployment.env`: protected copy of deployment secrets and settings
- `SHA256SUMS`: integrity checksums when `sha256sum` is available

Treat the complete directory as sensitive. `deployment.env` contains the administrator and
encryption keys, and raw artifacts may contain prompts or model responses.

Recommended retention:

- Keep at least one recent daily backup and one tested monthly backup.
- Store one copy outside the Docker host.
- Encrypt backups at rest.
- Test restore procedures regularly on an isolated host.

## Restore

Restoring overwrites the target PostgreSQL database, clears Redis task state, and replaces the
artifact volume. Verify the target Compose project and backup directory first.

```bash
./scripts/restore.sh \
  --env-file .env.deploy \
  --backup-dir backups/BACKUP_ID \
  --confirm-destructive-restore
```

Add `--no-build` when the deployment uses prebuilt registry images.

The restore script:

1. Requires an explicit destructive-confirmation flag.
2. Verifies backup checksums when available.
3. Refuses to continue if the current encryption key differs from the backup.
4. Stops API, worker, and web traffic.
5. Clears non-authoritative Redis queue/scheduling state.
6. Replaces PostgreSQL and artifact data.
7. Runs the normal deployment health checks.

After restore, probe a registered endpoint and run a small validation dataset before reopening
normal use.

## Logs and error diagnosis

Follow application logs:

```bash
"${COMPOSE[@]}" logs --since 30m -f api worker
```

Use run/sample IDs when correlating events. Application logs intentionally exclude endpoint
secrets and full request/response payloads.

Common provider failure classes:

| Error | Meaning | Operator response |
| --- | --- | --- |
| `http.401` / `http.403` | Credential rejected, quota policy, or temporary provider gate | Probe the endpoint, verify the provider account, and pause large runs |
| `http.429` | Provider rate limit | Lower endpoint QPS/concurrency and retry failures later |
| `http.5xx` | Provider or upstream gateway failure | Check provider health and avoid consuming the remaining dataset during an outage |
| `response.empty` | No final answer text | Inspect `finish_reason`, reasoning fields, and `max_tokens` |
| `timeout` | No response before the configured deadline | Increase timeout or reduce concurrency after checking provider latency |
| `PARSE_ERROR` | Text returned but parser could not extract the expected answer | Review prompt format and parser compatibility |

The current MVP has retry logic for transient failures but no run-level circuit breaker. During
a sustained 403/5xx incident, cancel or pause operationally before hundreds of samples are marked
failed. A future release should stop dispatch after a configurable consecutive-error threshold.

## Token-limit guidance

Reasoning models can spend the entire completion budget in a provider-specific reasoning field
and return an empty final `content`. When this happens, `finish_reason=length` and
`completion_tokens=max_tokens` are the important signals.

For numeric or short-answer benchmarks:

- Start with `max_tokens=1000` only after a small calibration run.
- Increase to `2000` or `3000` when a material percentage of answers ends at the cap.
- Keep prompts explicit about returning only the final answer.
- Report truncation and API-error rates alongside accuracy.

Do not compare runs with different prompts, parsers, dataset checksums, or inference parameters
as if they used the same protocol. The run fingerprint exists to make this distinction auditable.

## Endpoint updates and deletion

Editing an endpoint creates a new immutable revision and re-probes it. Existing runs remain bound
to the exact revision captured when they were created. This preserves reproducibility but means
that editing an endpoint cannot repair an already-created run.

Endpoint deletion is allowed only when no historical run references any revision of that
endpoint. Referenced endpoints must remain as historical configuration records.

## Credential administration

### Administrator key

To rotate `ADMIN_API_KEY`:

1. Choose a quiet period.
2. Update the value in `.env.deploy`.
3. Run `scripts/deploy.sh`.
4. Enter the new key in each operator browser.

### Endpoint API keys

Use the endpoint edit action and enter the new provider key. Leaving the key field empty preserves
the existing encrypted value. A successful edit creates a new endpoint revision for future runs.

### Encryption key

Do not change `SECRET_ENCRYPTION_KEY` during a normal redeploy, upgrade, or host migration. There
is no automated re-encryption workflow in the MVP. Losing this key requires re-entering all
provider credentials; changing it without migration makes existing encrypted values unreadable.

## Known state-display limitations

- Aggregate `run_metrics` may be empty for cancelled runs even though sample rows are preserved.
- A cancelled parent run can leave a child dataset display status as `RUNNING`.
- The reliable cancellation facts are the parent run status plus sample execution counts.

These are presentation/finalization limitations, not loss of completed sample facts.

## Capacity changes

Increase `WORKER_CONCURRENCY` only after checking endpoint concurrency limits, PostgreSQL capacity,
and provider latency. The endpoint-level shared limiter prevents configured QPS/concurrency from
being exceeded across workers, but excessive worker processes still consume memory and database
connections.

For the single-host MVP, scale up gradually and validate with a small deterministic dataset before
running a full benchmark.
