.PHONY: bootstrap generate-fixtures test test-integration test-capacity test-qps test-faults test-cancel test-worker-crash test-restart-restore lint up down logs migrate web-dev api-dev

bootstrap:
	python3 -m venv .venv
	.venv/bin/pip install --upgrade pip
	.venv/bin/pip install -e '.[dev]'
	cd apps/web && npm install

generate-fixtures:
	.venv/bin/python -m tests.fixtures.generate_mvp_dataset --output datasets/experiments

test:
	.venv/bin/pytest

test-integration:
	docker compose --profile test build integration-tests
	docker compose --profile test run --rm integration-tests

test-capacity:
	docker compose --profile experiment build capacity-experiment
	EVALHUB_GIT_SHA=$$(git rev-parse HEAD) docker compose --profile experiment run --rm capacity-experiment

test-qps:
	docker compose up -d --build --force-recreate mock-openai
	docker compose --profile experiment build qps-experiment
	EVALHUB_GIT_SHA=$$(git rev-parse HEAD) docker compose --profile experiment run --rm qps-experiment

test-faults:
	docker compose up -d --build --force-recreate mock-openai
	docker compose --profile experiment build faults-experiment
	EVALHUB_GIT_SHA=$$(git rev-parse HEAD) docker compose --profile experiment run --rm faults-experiment

test-cancel:
	docker compose up -d --build --force-recreate mock-openai
	docker compose --profile experiment build cancel-experiment
	EVALHUB_GIT_SHA=$$(git rev-parse HEAD) docker compose --profile experiment run --rm cancel-experiment

test-worker-crash:
	EVALHUB_GIT_SHA=$$(git rev-parse HEAD) bash tests/experiments/run_worker_crash.sh

test-restart-restore:
	EVALHUB_GIT_SHA=$$(git rev-parse HEAD) bash tests/experiments/run_restart_restore.sh

lint:
	.venv/bin/ruff check apps packages workers tests

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f api worker web

migrate:
	docker compose run --rm api alembic upgrade head

api-dev:
	.venv/bin/uvicorn apps.api.app.main:app --reload --port 18000

web-dev:
	cd apps/web && npm run dev -- --host 0.0.0.0 --port 15173
