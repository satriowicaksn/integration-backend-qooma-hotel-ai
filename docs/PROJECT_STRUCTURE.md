# Project Structure

> 1 dokumen, 1 sumber kebenaran tentang struktur folder. Tidak ada per-folder README di repo ini.

## Top-level

```
.
├── .claude/                      Konfigurasi Claude Code: MCP servers + permissions
├── .github/                      CI workflows, PR template
├── docs/                         Semua dokumentasi panduan + ADR + runbooks
├── prisma/                       Schema Prisma + migrations + seed
├── scripts/                      Util scripts CLI (provisioning, batch jobs, dll)
├── src/                          Source code
├── .editorconfig                 Indent/EOL convention (semua editor)
├── .env.example                  Template env vars (commit safe; .env asli di-gitignore)
├── .eslintrc.cjs                 Lint rules — type-aware, hexagonal-disiplin enforce
├── .gitignore
├── .npmrc                        pnpm config: strict deps, isolated linker
├── .nvmrc                        Node version pin
├── .prettierrc.json              Format rules
├── CLAUDE.md                     ★ Panduan AI (wajib dibaca)
├── Dockerfile                    Multi-stage, target: api | worker
├── docker-compose.yml            Local dev stack (postgres, redis)
├── jest.config.ts                Jest config (ESM, ts-jest)
├── Makefile                      ★ Command shortcuts: make start, make commit, dst
├── package.json                  Scripts + deps (pnpm 9, type: module)
├── README.md                     Entry point developer
├── tsconfig.json                 TS config strict semua flag
└── tsconfig.build.json           TS config production build (no test, no source map)
```

## `docs/` — Dokumentasi panduan

```
docs/
├── ARCHITECTURE.md              Arsitektur tinggi + rationale per keputusan
├── MODULE_TEMPLATE.md           Pola file-by-file saat buat modul baru
├── NEW_BACKEND_SERVICE_PROMPT.md  Prompt copy-paste untuk scaffold service baru
├── PROJECT_STRUCTURE.md         (dokumen ini)
├── SECURITY.md                  Enkripsi, HMAC, masking, JWT, PDPA
├── TESTING.md                   Strategi unit/integration/AC, testcontainers
├── decisions/                   ADR (Architecture Decision Records)
│   ├── 0000-template.md         Template ADR baru — copy saat buat ADR baru
│   ├── 0001-hexagonal-disiplin.md
│   ├── 0002-package-manager.md
│   ├── 0003-coding-standards.md
│   ├── 0004-one-service-one-db.md
│   ├── 0005-deployment-target.md
│   ├── 0006-fastify-vs-express.md
│   ├── 0007-prisma-vs-alternatives.md
│   └── README.md                Index daftar ADR
└── runbooks/                    Ops runbooks (incident, backup, deploy) — diisi saat ada operasional
```

## `prisma/`

```
prisma/
├── schema.prisma                Schema utama service (1 schema per service)
├── migrations/                  Auto-generated migrations Prisma
└── seeds/
    └── index.ts                 Seed entry point — sesuaikan kebutuhan service
```

**1 service = 1 DB = 1 schema** (ADR-0004). Tidak ada split master/tenant di repo ini.

## `scripts/`

CLI scripts untuk operasional: data migration, batch processing, audit. Default kosong. Tambah saat butuh.

## `src/`

```
src/
├── entrypoints/                 Process entry points (main file per process)
│   ├── api.ts                   Fastify HTTP server (port HTTP)
│   └── worker.ts                Bull queue worker (no port)
├── core/                        Infrastruktur cross-cutting (BUKAN business logic)
│   ├── config/
│   │   └── env.ts               Loader env via zod — single source of truth runtime config
│   ├── logger/
│   │   └── logger.ts            Winston factory + correlation id + sensitive redaction
│   ├── errors/
│   │   └── app-errors.ts        AppError hierarchy (ValidationError, NotFoundError, dll)
│   ├── prisma/
│   │   └── prisma-client.ts     Prisma client singleton
│   ├── redis/
│   │   └── redis-client.ts      ioredis client + key namespacing helper
│   ├── queue/
│   │   └── bull-factory.ts      Bull queue factory dengan default config
│   └── http/
│       └── http-client.ts       axios wrapper (timeout, retry, correlation propagation)
├── plugins/                     Fastify plugins
│   ├── auth-jwt.plugin.ts       JWT verifier + inject req.user (kalau perlu auth)
│   ├── hmac-validator.plugin.ts HMAC webhook validator
│   ├── rate-limit.plugin.ts     @fastify/rate-limit dengan Redis store
│   ├── cors.plugin.ts
│   ├── helmet.plugin.ts
│   ├── correlation-id.plugin.ts Set x-correlation-id ke setiap request
│   ├── error-handler.plugin.ts  Translate AppError → HTTP response + Sentry
│   └── zod-type-provider.plugin.ts  Integrasi zod validator native Fastify
├── shared/                      Utility lintas-modul
│   ├── types/                   Types cross-module (RequestContext, dll)
│   ├── utils/
│   │   ├── crypto.ts            AES-256-GCM helpers (encrypt/decrypt)
│   │   ├── masking.ts           maskWaPhone, maskEmail, maskTokenForLog
│   │   └── test-setup.ts        Jest global setup (testcontainers, dll)
│   └── constants/               Konstanta lintas-modul (kalau ada)
└── modules/                     Business modules (1 folder = 1 bounded context)
    └── _template/               ★ POLA REFERENSI — JANGAN edit, copy untuk modul baru
        ├── index.ts             Barrel export public API
        ├── _template.routes.ts          HTTP routes
        ├── _template.service.ts         Business logic orchestrator
        ├── _template.repository.ts      Prisma queries (no interface)
        ├── _template.schema.ts          zod schemas (req/res validation)
        ├── _template.types.ts           Domain types
        ├── _template.events.ts          Events emitted
        ├── _template.jobs.ts            Bull processor
        ├── ports/                       Interfaces external IO (wajib)
        │   └── example-external.port.ts
        ├── adapters/                    Implementasi port (1 per vendor/strategi)
        │   └── example-vendor.adapter.ts
        └── __tests__/
            ├── _template.service.test.ts            Unit (mock port)
            └── _template.repository.integration.test.ts  Real DB
```

### Aturan per layer

| Layer | Boleh import | Tidak boleh import |
|---|---|---|
| `core/` | `shared/` | `modules/*`, `plugins/` |
| `shared/` | `core/` (types only) | `modules/*`, `plugins/` |
| `plugins/` | `core/`, `shared/` | `modules/*/adapters/*` (internal) |
| `modules/X/` | `core/`, `shared/`, `@modules/Y` (barrel only) | `@modules/Y/adapters/*` (ESLint enforce) |
| `entrypoints/` | semua (wiring layer) | — |

## `.github/`

```
.github/
├── workflows/
│   └── ci.yml                  CI: lint, typecheck, test unit + integration, docker build
└── PULL_REQUEST_TEMPLATE.md    PR checklist (security, test, AC)
```

## `.claude/`

```
.claude/
└── settings.json               MCP servers (sequential-thinking, postgres, serena, sentry) + permissions
```

## Konvensi penamaan ringkas

| Apa | Konvensi | Contoh |
|---|---|---|
| File source | `kebab-case.ts` | `foo-bar.service.ts` |
| Folder | `kebab-case` | `email-intake/` |
| Class | `PascalCase` | `FooService`, `VendorXAdapter` |
| Function | `camelCase` | `createFoo`, `validateInput` |
| Type / Interface | `PascalCase` | `FooDomain`, `FooStatus` |
| Constant | `SCREAMING_SNAKE_CASE` | `DEFAULT_TIMEOUT_MS` |
| Tabel DB | `snake_case` (`@map`) | `example_resources` |
| Field DB | `snake_case` (`@map`) | `created_at` |
| Field Prisma client | `camelCase` | `createdAt` |
| Test file | `<name>.test.ts` / `<name>.integration.test.ts` | `foo.service.test.ts` |

Path alias TS (`tsconfig.json`):
- `@core/*` → `src/core/*`
- `@modules/*` → `src/modules/*`
- `@plugins/*` → `src/plugins/*`
- `@shared/*` → `src/shared/*`
