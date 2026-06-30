# ADR-0007: Prisma sebagai ORM

- **Status**: accepted
- **Tanggal**: 2026-06-11
- **Driven by**: spec §2.1

## Konteks

Pilih ORM untuk service Qooma. 1 service = 1 DB (ADR-0004), jadi tidak ada multi-database scenario di level service.

## Opsi

### Opsi A: Prisma 5 (pilihan)
- Pros: Type-safe end-to-end, schema declarative, migration tooling matang, multi-schema support (datasources), dynamic DATABASE_URL per client instance
- Cons: Generated client bisa besar, query engine binary (Rust) butuh proper architecture untuk Alpine, beberapa raw SQL query butuh `$queryRaw`

### Opsi B: Drizzle
- Pros: Ringan, SQL-first
- Cons: Off-spec, ecosystem lebih baru, migration tooling kurang matang

### Opsi C: TypeORM
- Pros: Active record / data mapper
- Cons: Type safety lebih lemah dari Prisma, decorator-heavy, migrations sering buggy

### Opsi D: Knex + manual types
- Pros: Full control
- Cons: Type safety manual, banyak boilerplate

## Keputusan

**Prisma 5.x**.

Konfigurasi:
- 1 schema file: `prisma/schema.prisma`
- 1 generated client (default output `node_modules/.prisma/client`)
- Client singleton di `src/core/prisma/prisma-client.ts`
- Connection pool default Prisma (10 conn) — tuning per service kalau perlu

## Konsekuensi

### Positif
- Type safe schema → query → result
- Migration history tracked di `_prisma_migrations` table per DB
- Studio (`prisma studio`) untuk inspeksi data dev

### Negatif (yang kami terima)
- Raw SQL untuk query kompleks — pakai `$queryRaw` tagged template (parametrized, safe)
- Bundle size lebih besar — mitigasi: Docker multi-stage build dengan `pnpm install --prod`
- Migration drift saat banyak service: tiap service punya migration history sendiri (acceptable trade-off untuk service boundary)

### Migrasi / rollout
- Dari hari 1
- Konvensi: tabel snake_case di DB, model PascalCase di Prisma, field camelCase di TS

## Trigger untuk revisit

- Saat kita perlu raw SQL > 20% query (artinya Prisma bukan fit)
- Saat connection pool issue tidak bisa di-solve dengan PgBouncer
- Saat performa generated client jadi bottleneck (sangat jarang)
