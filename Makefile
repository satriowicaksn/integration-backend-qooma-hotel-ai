# ============================================================================
# Qooma Backend Service Boilerplate — Makefile
# ============================================================================
# Jalankan `make help` untuk lihat semua command.
# ============================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help
.PHONY: help install start start-fresh stop clean restart logs ps \
        db-migrate db-reset db-seed db-studio \
        prisma-generate \
        dev dev-api dev-worker \
        lint lint-fix format format-check typecheck test test-unit test-integration test-coverage \
        check pre-commit commit \
        build docker-build

# ----------------------------------------------------------------------------
# Help
# ----------------------------------------------------------------------------
help: ## Tampilkan daftar command yang tersedia
	@echo ""
	@echo "Qooma Backend Boilerplate — Make commands:"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "Contoh:"
	@echo "  make start             # start deps + prepare project"
	@echo "  make start-fresh       # FRESH start: drop DB, migrate, seed"
	@echo "  make dev               # info cara run dev process"
	@echo "  make commit MSG=\"feat: tambah modul foo\""
	@echo ""

# ----------------------------------------------------------------------------
# Install & dependencies
# ----------------------------------------------------------------------------
install: ## Install pnpm dependencies + generate Prisma client
	@command -v pnpm >/dev/null || (corepack enable && corepack prepare pnpm@9.0.0 --activate)
	pnpm install --frozen-lockfile || pnpm install
	$(MAKE) prisma-generate

# ----------------------------------------------------------------------------
# Lifecycle: start / stop
# ----------------------------------------------------------------------------
start: ## Start dev stack (DB persistence dipertahankan)
	@echo "→ Starting deps (postgres, redis)..."
	docker compose up -d postgres redis
	@echo "→ Waiting for Postgres healthy..."
	@until docker compose exec -T postgres pg_isready -U app >/dev/null 2>&1; do sleep 1; done
	$(MAKE) prisma-generate
	$(MAKE) db-migrate
	@echo ""
	@echo "✓ Stack siap. Jalankan: make dev-api  (atau make dev untuk info)"

start-fresh: ## FRESH start: drop volume DB, re-migrate, seed
	@echo "→ DROP volume DB (semua data lokal hilang)..."
	docker compose down -v
	@echo "→ Start deps..."
	docker compose up -d postgres redis
	@echo "→ Waiting for Postgres healthy..."
	@until docker compose exec -T postgres pg_isready -U app >/dev/null 2>&1; do sleep 1; done
	$(MAKE) prisma-generate
	@echo "→ Migrate schema..."
	pnpm prisma:migrate:deploy
	@echo "→ Seed initial data..."
	pnpm seed
	@echo ""
	@echo "✓ Fresh stack siap. Jalankan: make dev-api"

stop: ## Stop dev stack (volume tetap)
	docker compose down

restart: stop start ## Restart dev stack

clean: ## Stop + hapus semua volume + node_modules + build artifact
	docker compose down -v
	rm -rf node_modules dist coverage .tsbuildinfo .jest-cache .eslintcache

logs: ## Tail logs container deps
	docker compose logs -f postgres redis

ps: ## Status container
	docker compose ps

# ----------------------------------------------------------------------------
# Database (Prisma)
# ----------------------------------------------------------------------------
prisma-generate: ## Generate Prisma client (perlu setelah schema berubah)
	pnpm prisma:generate

db-migrate: ## Apply migration (dev)
	pnpm prisma:migrate:dev

db-reset: ## DROP + re-create schema (HATI-HATI: data hilang)
	pnpm prisma:migrate:reset --force

db-seed: ## Run seed
	pnpm seed

db-studio: ## Buka Prisma Studio (DB browser UI)
	pnpm prisma studio

# ----------------------------------------------------------------------------
# Development (run process)
# ----------------------------------------------------------------------------
dev: ## Info cara jalanin dev process
	@echo "Dev process tidak dijalankan lewat make (perlu terminal interaktif)."
	@echo "Buka 2 terminal lalu jalankan:"
	@echo "  Terminal 1:  make dev-api      (HTTP server)"
	@echo "  Terminal 2:  make dev-worker   (Bull queue worker — kalau service punya job)"

dev-api: ## Run API process (hot reload)
	pnpm dev:api

dev-worker: ## Run Worker process (hot reload)
	pnpm dev:worker

# ----------------------------------------------------------------------------
# Quality
# ----------------------------------------------------------------------------
lint: ## ESLint (read-only)
	pnpm lint

lint-fix: ## ESLint auto-fix
	pnpm lint:fix

format: ## Prettier write
	pnpm format

format-check: ## Prettier check only
	pnpm format:check

typecheck: ## TypeScript check tanpa emit
	pnpm typecheck

test: ## Semua test
	pnpm test

test-unit: ## Unit test saja
	pnpm test:unit

test-integration: ## Integration test (perlu deps via `make start`)
	pnpm test:integration

test-coverage: ## Test + coverage report
	pnpm test:coverage

# Kombinasi: gate sebelum commit (lint + format + typecheck + unit test)
check: lint format-check typecheck test-unit ## Lint + format-check + typecheck + unit test

# ----------------------------------------------------------------------------
# Pre-commit & commit
# ----------------------------------------------------------------------------
pre-commit: ## Gate: pastikan lint + typecheck + format hijau sebelum commit
	@echo "→ Lint..."
	@pnpm lint
	@echo "→ Typecheck..."
	@pnpm typecheck
	@echo "→ Format check..."
	@pnpm format:check
	@echo "✓ Pre-commit checks passed"

commit: pre-commit ## Commit dengan auto lint+typecheck. Usage: make commit MSG="feat: ..."
	@if [ -z "$(MSG)" ]; then \
		echo ""; \
		echo "✗ Usage: make commit MSG=\"feat(modul): ringkasan singkat\""; \
		echo "  Conventional commit prefix: feat | fix | docs | chore | refactor | test"; \
		exit 1; \
	fi
	git add -A
	git commit -m "$(MSG)"
	@echo ""
	@echo "✓ Commit dibuat. Cek dengan: git log -1"

# ----------------------------------------------------------------------------
# Build
# ----------------------------------------------------------------------------
build: ## Build TypeScript → dist/
	pnpm build

docker-build: ## Build Docker image (api + worker)
	docker build --target api -t qooma-backend-api:latest .
	docker build --target worker -t qooma-backend-worker:latest .
