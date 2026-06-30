# ADR-0004: 1 Service = 1 Database = 1 Prisma Schema

- **Status**: accepted
- **Tanggal**: 2026-06-11

## Konteks

Qooma adalah ekosistem microservices. Setiap service punya domain sendiri (mis. core, billing, ai, chat, dll). Pertanyaan: apakah tiap service punya database sendiri, atau share database?

## Opsi yang dipertimbangkan

### Opsi A: 1 service = 1 database (pilihan)
- Pros: Domain boundary clear, schema migration independen, scale per-domain, compliance per-domain
- Cons: Cross-service query susah, butuh API/event bus untuk komunikasi, distributed transaction harus saga

### Opsi B: Shared database, schema-per-service (Postgres schemas)
- Pros: 1 backup, 1 connection pool
- Cons: Migration coordination, scaling jadi shared bottleneck, ownership ambigu

### Opsi C: Shared database tanpa pemisahan
- Pros: Sederhana awal
- Cons: Tight coupling antar service, ownership tidak jelas, scale susah

## Keputusan

**Opsi A — 1 service = 1 database = 1 Prisma schema**.

Konsekuensi konkret untuk boilerplate:
- Hanya 1 `prisma/schema.prisma`
- Tidak ada master/tenant split di repo ini
- Multi-tenancy strategi (kalau diperlukan) = keputusan per-service, dokumentasikan di ADR service tersebut

Service yang butuh data dari service lain:
- Sync read: HTTP API call (cache jika perlu)
- Event-driven: publish/subscribe ke message bus (Redis Streams, NATS, atau Kafka — pilih saat butuh)
- Tidak boleh: cross-service DB JOIN, atau shared table

## Konsekuensi

### Positif
- Setiap service punya schema migration yang independen
- Boilerplate jadi sederhana — fokus 1 schema saja
- Boundary domain dipaksa jelas
- Bisa pilih DB engine berbeda per service kalau perlu (mis. service analytics pakai ClickHouse)

### Negatif (yang kami terima)
- Cross-service query = code, bukan SQL JOIN
- Eventual consistency antar service (saga / event sourcing saat butuh)
- Operational overhead: multiple DB instances (mitigasi: 1 RDS instance dengan multiple databases di awal, split cluster saat scale)

### Migrasi / rollout
- Mulai hari 1
- Setiap service baru clone boilerplate ini, edit `prisma/schema.prisma` sesuai domain

## Trigger untuk revisit

- Saat cross-service query terlalu mahal (latency tinggi) → CQRS read model di salah satu service
- Saat consistency requirement ketat (mis. financial) → consider event sourcing + outbox pattern
- Saat operational overhead jadi blocker → consider schema-per-service di shared cluster
