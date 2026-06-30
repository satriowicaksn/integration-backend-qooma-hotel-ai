# Arsitektur — Qooma Backend Service Boilerplate

> Menjelaskan **arsitektur, keputusan, dan alasan** di balik tiap pilihan. Coding-day-to-day: lihat [CLAUDE.md](../CLAUDE.md). Struktur folder: lihat [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md).

## 1. Konteks

Qooma adalah ekosistem **microservices**. Tiap service:
- Punya **1 database sendiri** (1 Prisma schema)
- Punya **deployment lifecycle independen**
- Komunikasi antar service via **HTTP API** atau **event bus** — BUKAN shared DB

Boilerplate ini adalah **pondasi konsisten** untuk semua service Qooma. Service baru = clone boilerplate → tambah business logic.

## 2. Service topology (per service)

Setiap service punya **2 process** dari **1 codebase**:

```
┌────────────┐      ┌────────────┐
│   api      │      │   worker   │
│ (Fastify)  │      │   (Bull)   │
└─────┬──────┘      └─────┬──────┘
      │                   │
      └─────────┬─────────┘
                │
       ┌────────┴────────┐
       │                 │
   ┌──────────┐    ┌──────────────┐
   │ Postgres │    │ Redis        │
   │   (1 DB) │    │ queue+cache  │
   └──────────┘    └──────────────┘
```

| Process | Tanggung jawab | Scale strategi |
|---|---|---|
| **api** | HTTP server (REST + webhook receivers + optional Socket.io) | Horizontal, di belakang ALB. Stateless. |
| **worker** | Bull queue processor (background jobs, scheduler) | Horizontal. Bull lock memastikan no duplicate. |

> Service yang butuh process lain (mis. SMTP inbound, gRPC server) tambahkan entrypoint sendiri + target Dockerfile baru.

### Kenapa 2 process, bukan 1 monolith?

| Alasan | Detail |
|---|---|
| **Lifecycle berbeda** | api restart cepat, worker harus drain job dulu. Mixing = downtime risk. |
| **Resource profile berbeda** | api bursty CPU. worker long-running job, RAM-heavy. Scale independent. |
| **Crash isolation** | OOM di worker tidak menjatuhkan webhook receiver. |
| **Deploy independence** | Hotfix worker tanpa restart api. |

### Kenapa BUKAN microservices dalam-service (split repo)?

Untuk 1 service, monolith modular cukup. Microservice-level split sudah terjadi di level Qooma (multiple services).

## 3. Pattern: Hexagonal Disiplin

### Definisi tegas

Hexagonal "Disiplin" = **port HANYA untuk external I/O**. Bukan hexagonal murni klasik (yang wrap segala dependency).

### WAJIB port + adapter

- HTTP call ke external API (vendor, partner, AI provider, payment gateway)
- Outbound notification (email, SMS, push, webhook callback)
- Object storage (S3, R2)
- Bull queue producer (saat dipanggil dari service — agar dapat di-mock)

### TIDAK pakai port

- Prisma query (Prisma = abstraksi yang cukup)
- Redis cache (langsung `ioredis`)
- Logger, config, internal util

### Mengapa disiplin ini?

| Drawback hexagonal murni | Mitigasi kami |
|---|---|
| Boilerplate 2-3x | ~50% kurangi — Prisma/Redis tidak wrapped |
| Context window AI besar | Modul CRUD sederhana cukup 5 file |
| "Ports everywhere" antipattern | Hard rule di CLAUDE.md + ESLint `no-restricted-imports` |

### Trade-off yang KAMI TERIMA

- ❌ Tidak bisa swap Prisma → ORM lain tanpa refactor query. Kami terima — kemungkinan rendah, Prisma stabil.
- ❌ Tidak bisa unit test repository tanpa real DB. Kami terima — integration test dengan testcontainers cukup cepat.
- ✅ Bisa swap vendor external (mis. payment provider, AI provider) tanpa ubah service.
- ✅ Mock semua external IO di test → CI murah dan deterministik.

Detail rationale: [ADR-0001](./decisions/0001-hexagonal-disiplin.md).

### Pattern modul tipikal

```
modules/foo/
├── foo.routes.ts          (HTTP entry — driving adapter)
├── foo.service.ts         (orchestrator)
├── foo.repository.ts      (Prisma langsung — TIDAK pakai port)
├── foo.schema.ts          (zod validation)
├── foo.types.ts           (domain types)
├── ports/
│   └── external-api.port.ts   (interface)
└── adapters/
    └── vendor-x.adapter.ts    (implementasi konkret)
```

## 4. Single Database (1 service = 1 DB)

### Keputusan

Setiap service Qooma punya **1 Prisma schema** dan **1 database fisik**. Boilerplate ini hanya define satu `prisma/schema.prisma`.

### Konsekuensi

| ✅ Positif | ❌ Negatif (yang kami terima) |
|---|---|
| Domain boundary clear | Cross-service query susah → komunikasi lewat API/event |
| Migration sederhana (1 schema) | Data eventual consistency antar service |
| Scale per-domain | Operational overhead lebih banyak (multiple DB) |
| Compliance per-domain (PDPA, retention) | Distributed transaction tidak ada (saga pattern saat butuh) |

### Multi-tenancy

Boilerplate ini **tidak meng-impose** strategi multi-tenancy. Tiap service tentukan sendiri sesuai domainnya:
- Shared DB + `tenant_id` filter (kebanyakan service)
- Database-per-tenant (saat butuh isolasi fisik kuat)
- Hybrid

Dokumentasikan keputusan di ADR service masing-masing.

Detail: [ADR-0004](./decisions/0004-one-service-one-db.md).

## 5. External integrations (boilerplate-level)

Boilerplate sediakan **infrastruktur** (config, logger, error, queue, http client), bukan integration spesifik. Setiap service tambah integration sesuai domain.

Wajib pakai pattern Port + Adapter untuk integration HTTP external. Contoh lengkap di `src/modules/_template/`.

## 6. Observability

| Layer | Tool | Pakai untuk |
|---|---|---|
| Logs | winston (JSON) → stdout → CloudWatch | Debug, audit, correlation tracing |
| Errors | Sentry | Capture exceptions, slow traces |
| Uptime | Better Stack | Status page, alerting |
| Metrics | OpenTelemetry (planned) → Grafana | Latency p95, queue depth |

### Correlation ID

Setiap request HTTP / job:
- Header `x-correlation-id` ada → pakai
- Tidak ada → generate `uuidv7` (ordered by time)
- Propagate ke semua log line, external API call, Bull job data

### Sensitive data redaction

Winston format dengan `redactPaths`:
- `*.password`, `*.token`, `*.apiKey`
- `*.wa_phone`, `*.email` → mask via helper
- `headers.authorization`

## 7. Non-functional defaults (boilerplate)

Target generic untuk service Qooma. Service spesifik bisa override.

| Aspek | Target | Verify |
|---|---|---|
| API response (p95) | < 500ms | k6 load test |
| Webhook processing | < 2 detik | Webhook timestamp delta |
| Uptime | > 99.5%/bulan | Better Stack |
| Zero message loss | Burst 500, 0 lost | Load test dengan Bull queue |
| Test coverage | 80% line, 75% function | Jest threshold |

## 8. Rationale rekap (TL;DR per keputusan)

| Keputusan | Pilihan | Alasan singkat | ADR |
|---|---|---|---|
| Pattern | Hexagonal Disiplin | Testable external IO + hindari over-boilerplate Prisma wrap | [0001](./decisions/0001-hexagonal-disiplin.md) |
| Package manager | pnpm | Strict deps mencegah AI phantom import | [0002](./decisions/0002-package-manager.md) |
| Coding standards | TS strict + ESLint type-check | Catch bug di compile, AI-friendly | [0003](./decisions/0003-coding-standards.md) |
| DB strategy | 1 service = 1 DB | Microservices boundary clear, scale per-domain | [0004](./decisions/0004-one-service-one-db.md) |
| Deploy | AWS ECS Fargate (default) | Match team familiarity, can swap | [0005](./decisions/0005-deployment-target.md) |
| HTTP framework | Fastify | Perf > Express, plugin system | [0006](./decisions/0006-fastify-vs-express.md) |
| ORM | Prisma | Type safety, migration tooling | [0007](./decisions/0007-prisma-vs-alternatives.md) |

Setiap ADR berisi: konteks, opsi yang dipertimbangkan, tradeoff, keputusan, konsekuensi, trigger revisit.

## 9. Glossary

| Istilah | Arti di repo ini |
|---|---|
| **Port** | Interface untuk external I/O |
| **Adapter** | Implementasi konkret port |
| **Modul / Bounded context** | 1 folder di `src/modules/` |
| **Driving adapter** | Memicu service (HTTP route, queue consumer) |
| **Driven adapter** | Dipakai service (HTTP client, DB, queue producer) |
| **Boilerplate** | Repo ini sebagai pondasi/template service Qooma |
