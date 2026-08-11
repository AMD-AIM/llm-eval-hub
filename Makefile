.PHONY: bootstrap test lint up down logs migrate web-dev api-dev

bootstrap:
	python3 -m venv .venv
	.venv/bin/pip install --upgrade pip
	.venv/bin/pip install -e '.[dev]'
	cd apps/web && npm install

test:
	.venv/bin/pytest

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

