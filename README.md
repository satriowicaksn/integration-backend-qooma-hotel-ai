# Qooma Integration / Channels — Backend Service

> Service **Integration / Channels** di ekosistem **Qooma** (microservices) — owns every conversation with the outside world: WhatsApp Cloud API, Telegram Bot, OTA email parser, QR provisioning, webhook ingress, outbound dispatch + retry, channel health probes. Per H12 2026-06-29 PO ruling: integration config CRUD moved here from Hotel Core, so ALL `/api/integrations/*` surface lives here (config + actions + webhook ingress + dispatch). Repo ini di-bootstrap dari `core-backend-qooma-hotel-ai` infra via rsync; pattern reusable (`_template/`, `MODULE_TEMPLATE.md`, ADR-0001..0007) tetap. Sibling service (Auth, Hotel Core, AI) hidup di repo terpisah.
>
> **Authoritative spec**: [`docs/spec/04-integration-channels.md`](./docs/spec/04-integration-channels.md) (endpoints + DDL + RPC catalog) + [`docs/spec/MVP-INTEGRATION-FIRST.md`](./docs/spec/MVP-INTEGRATION-FIRST.md) (slice + AC).
>
> Charter lengkap: **[docs/SERVICE-CHARTER.md](./docs/SERVICE-CHARTER.md)** · Ratifikasi: **[ADR-0008](./docs/decisions/0008-repo-scope-integration.md)**.
>
> Goal: AI-driven development (~80% AI) tetap clean dan maintainable lewat pola **multi-agent workflow** (Planning / PM / Executor) dengan 3 dev paralel.

## 📖 Wajib dibaca dulu

| Dokumen | Untuk siapa | Isi |
|---|---|---|
| **[KICKOFF.md](./KICKOFF.md)** | Onboarding tim | Master kickoff prompt — 3 dev paralel (Nathan/Nanak/Satrio), 3 agent per dev (Planning/PM/Executor), Parent PM cross-coordinator, identity check rule, PROMPT A/B/C copy-paste |
| **[CLAUDE.md](./CLAUDE.md)** | AI agent + developer | Aturan coding, struktur, pattern (Hexagonal Disiplin), security guard, anti-patterns |
| **[PM-AGENT.md](./PM-AGENT.md)** | Parent PM + PM A/B/C | Role spec PM — validation procedure, drift scans, roll-up protocol, escalation |
| **[EXECUTOR-PROTOCOL.md](./EXECUTOR-PROTOCOL.md)** | Executor A/B/C | Workflow rulebook — session bootstrap, PLAN/SUBMIT format, self-validate, block protocol |
| **[docs/PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md)** | Semua | Penjelasan folder-by-folder — apa isinya & gunanya |
| **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | Semua | Arsitektur + rationale (Hexagonal Disiplin, 1-service-1-db) |
| **[docs/SECURITY.md](./docs/SECURITY.md)** | Semua | Enkripsi, HMAC, masking PII, JWT |
| **[docs/TESTING.md](./docs/TESTING.md)** | Semua | Unit, integration, coverage target |
| **[docs/MODULE_TEMPLATE.md](./docs/MODULE_TEMPLATE.md)** | AI saat buat modul baru | Pola file-by-file modul |
| **[docs/NEW_BACKEND_SERVICE_PROMPT.md](./docs/NEW_BACKEND_SERVICE_PROMPT.md)** | Saat scaffold service baru | Prompt copy-paste ke Claude Code |
| **[docs/decisions/](./docs/decisions/)** | Audit keputusan | Architecture Decision Records |

## 🤖 Multi-agent workflow (3 dev paralel)

3 dev paralel, masing-masing punya **3 Claude Code session** (Planning / PM / Executor) + 1 shared Parent PM session.

| Slot | Nama   | PM file (per-dev)                | Default domain                                                                                       |
| ---- | ------ | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A    | Nathan | [PM-STATUS-A.md](./PM-STATUS-A.md) | Foundation — Prisma + migrations, encryption helper, signature verify, slug lookup, BSP adapter, queue infra |
| B    | Nanak  | [PM-STATUS-B.md](./PM-STATUS-B.md) | WA + outbound dispatch — wa_configs, verify-webhook, WA ingress, dispatch (DND + quota two-phase + retry), Meta template relay |
| C    | Satrio | [PM-STATUS-C.md](./PM-STATUS-C.md) | Telegram + OTA + QR + health — telegram_configs, per-dept routing, Telegram commands, OTA IMAP, QR PNG, health probes |

Cross-dev roll-up & gates: **[PM-STATUS-PARENT.md](./PM-STATUS-PARENT.md)** (Parent PM authority).

Onboard via **[KICKOFF.md](./KICKOFF.md)** — di sana ada PROMPT A (Planning), PROMPT B-PARENT (Parent PM), PROMPT B (sub-PM per slot), PROMPT C (Executor per slot) yang bisa langsung paste ke fresh Claude Code session.

## 📊 Progress board

> Auto-updated by Parent PM. Detail per-dev di file PM-STATUS-{A,B,C}.md. Global tracker di PM-STATUS-PARENT.md §1.

### Current snapshot (H12+ — task tracker activated 2026-06-30)

| Slot | Dev    | Active task                                | Status   | Last approved | Branch |
| ---- | ------ | ------------------------------------------ | -------- | ------------- | ------ |
| A    | Nathan | T01 / T02 / T03                            | assigned | —             | —      |
| B    | Nanak  | T10 (skeleton-only, impl blocked on T02)   | assigned | —             | —      |
| C    | Satrio | T17 (skeleton-only, impl blocked on T02)   | assigned | —             | —      |

**Gates** (target H per PO, criteria default `PM-AGENT.md §5`):

| Gate | Target H | Status        | Notes                                                                    |
| ---- | -------- | ------------- | ------------------------------------------------------------------------ |
| G1   | TBD      | not started   | Boilerplate ready: `make check` green, `make start` jalan, `_template` jalan |
| G2   | TBD      | not started   | Modul auth + 1 modul business + coverage ≥ 80%                            |
| G3   | TBD      | not started   | Semua endpoint kontrak + webhook HMAC + CI green                          |
| G4   | TBD      | not started   | Feature freeze                                                            |
| G5   | TBD      | not started   | UAT pass, AC P0 = 100%, runbook ready                                     |

**Counters** (global):

- ✅ Tasks approved: **0** / 25
- 🔄 Tasks in progress: **0** (5 assigned · 20 backlog)
- ⛔ Tasks rejected today: **0**
- 🚨 Open contract Qs: **0**
- 📅 Days into project: H12+

> Update protocol: Parent PM edit table di section ini setiap end-of-day, mirroring dari `PM-STATUS-PARENT.md §1` + §5 + §6. Sub-PM A/B/C tidak edit progress board ini langsung — push status via PM-STATUS-PARENT.md, Parent PM yang sync ke README.

## 🧱 Tech stack

Node.js ≥20 LTS (diuji di Node 20 + 22) · TypeScript 5 (strict) · Fastify 4 · Prisma 5 · PostgreSQL 15 · Redis 7 · Bull 4 · zod 3 · winston 3 · Jest 29 · **pnpm 9** · Docker multi-stage · AWS ECS Fargate (default deploy target)

## 🏗️ Pattern arsitektur

**Hexagonal Disiplin** — Ports & Adapters HANYA untuk external I/O (HTTP API eksternal, queue producer, notifier, object storage). Prisma/Redis/logger dipakai langsung (sudah jadi abstraksi).

**1 service = 1 database = 1 Prisma schema** (microservices). Cross-service communication lewat API atau event, BUKAN shared DB.

Detail rationale: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) + ADR di [docs/decisions/](./docs/decisions/).

## 🚀 Quick start

> **Prasyarat**: Node.js ≥20, pnpm (auto-install via `corepack enable` — sudah di-handle `make install`), Docker Desktop.

> **📖 Panduan lengkap end-to-end** (init → env → DB GUI → smoke-test 3 MVP endpoint): [**`docs/runbooks/local-dev.md`**](./docs/runbooks/local-dev.md).

```bash
# 1. Install pnpm & deps (termasuk corepack enable otomatis)
make install

# 2. Setup env
cp .env.example .env
# Generate real secrets (WAJIB — boot fails-fast kalau ENCRYPTION_KEY ≠ 64 chars):
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 36)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 36)"
echo "INTERNAL_RPC_SECRET=$(openssl rand -base64 36)"
# → paste 4 baris di atas ke .env, replace placeholders

# 3. Start dev stack (Postgres + Redis) + run migration
make start
# atau, kalau mau FRESH database (DROP volume → migrate → seed):
make start-fresh
#
# Default host port: Postgres → 5433, Redis → 6380 (digeser dari 5432/6379
# untuk hindari bentrok dengan Postgres/Redis lokal). Internal container
# port tetap 5432/6379, jadi service di compose network tidak terdampak.
# Kalau mau ubah, edit `docker-compose.yml` + `.env`.

# 4. Run dev process (di terminal terpisah)
make dev-api
make dev-worker   # kalau service punya background job
```

## 📝 Command penting (Makefile)

```bash
make help              # daftar semua command
make start             # start dev (DB persist)
make start-fresh       # FRESH: drop volume + migrate + seed
make stop              # stop containers
make clean             # stop + drop volumes + clean node_modules

make dev-api           # run HTTP server (hot reload)
make dev-worker        # run Bull worker (hot reload)

make db-migrate        # apply migration
make db-seed           # run seed
make db-studio         # Prisma Studio (DB UI browser)

make test              # semua test
make lint              # ESLint check
make typecheck         # TypeScript check
make format            # Prettier write
make check             # lint + format-check + typecheck + unit test

make commit MSG="feat(modul): tambah X"   # auto-check + git commit
```

## 🧪 Test

```bash
make test              # semua
make test-unit         # unit saja (cepat, no DB)
make test-integration  # dengan DB + Redis nyata (perlu `make start` dulu)
make test-coverage     # dengan coverage report
```

Target coverage: 80% line. Detail di [docs/TESTING.md](./docs/TESTING.md).

## 📦 Build & deploy

```bash
make build             # tsc → dist/
make docker-build      # docker image (api + worker)
```

Default deploy: AWS ECS Fargate (multi-target image: `api`, `worker`).

## 🔐 Security ringkas

- Token sensitif: AES-256-GCM at rest
- Webhook: HMAC validation timing-safe
- PII (nomor WA, email): mask di log (`maskWaPhone`, `maskEmail`)
- JWT: access 8h + refresh 30d
- Rate limit: 100 req/menit per IP (configurable)

Detail: [docs/SECURITY.md](./docs/SECURITY.md).

## 🤝 Cara berkontribusi (manusia ATAU AI)

### Bila kamu Claude Code session baru

1. Baca **[KICKOFF.md](./KICKOFF.md)** dulu — di sana ada PROMPT untuk Planning / Parent PM / sub-PM / Executor sesuai role.
2. Di response pertama kamu **WAJIB** confirm identitas: `Role: PM | Executor | Parent PM | Planning` + `Slot: A (Nathan) | B (Nanak) | C (Satrio)`. Bila user belum sebut slot — STOP, tanya dulu.
3. Baca file PM-STATUS yang sesuai slot kamu (PM A → PM-STATUS-A.md + PM-STATUS-PARENT.md; Executor A → PM-STATUS-A.md only; dst).
4. Baca [CLAUDE.md](./CLAUDE.md) untuk code rules.
5. Follow work loop di [EXECUTOR-PROTOCOL.md §4](./EXECUTOR-PROTOCOL.md) (executor) atau [PM-AGENT.md §3](./PM-AGENT.md) (PM).

### Bila kamu human dev

1. Baca [CLAUDE.md](./CLAUDE.md) untuk pattern & rule.
2. Cek [docs/decisions/](./docs/decisions/) untuk konteks keputusan.
3. Patuhi struktur modul ([docs/MODULE_TEMPLATE.md](./docs/MODULE_TEMPLATE.md)) — copy `src/modules/_template/`.
4. `make check` lulus sebelum PR.
5. Isi PR template lengkap.

## Lisensi

UNLICENSED — proprietary internal Qooma.
