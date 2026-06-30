# ADR-0006: Fastify sebagai HTTP framework

- **Status**: accepted
- **Tanggal**: 2026-06-11
- **Driven by**: spec §2.1

## Konteks

Spec mandate Fastify 4.x. ADR ini mendokumentasikan alasan & konsekuensi.

## Opsi yang dipertimbangkan

### Opsi A: Express 4/5
- Pros: Most popular, banyak example, banyak middleware
- Cons: Slow (benchmark 4-6x lebih lambat dari Fastify untuk JSON workload), error handling boilerplate, no built-in schema validation

### Opsi B: Fastify 4.x (pilihan, spec mandate)
- Pros: Fast (low overhead, schema-based serialization), plugin system rapih, built-in JSON schema validation, structured logging built-in
- Cons: Plugin lifecycle (encapsulation) curve sedikit, ecosystem lebih kecil dari Express

### Opsi C: Hono / NestJS
- Pros (Hono): edge-friendly, modern
- Pros (NestJS): full framework, DI, decorators
- Cons: Off-spec, butuh klarifikasi user

## Keputusan

**Fastify 4.x** sesuai spec.

Integrasi penting:
- `@fastify/jwt` untuk auth
- `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`
- `fastify-type-provider-zod` untuk schema validation native zod
- Custom plugins untuk: tenant-resolver, hmac-validator, correlation-id

## Konsekuensi

### Positif
- Performance match SLA AC-051 (CRM API p95 < 500ms)
- Schema validation di route → less manual validation di handler
- Plugin encapsulation = boundary jelas untuk hexagonal

### Negatif (yang kami terima)
- Some Express middleware tidak compatible — sebagian besar ada plugin Fastify
- Learning curve untuk plugin lifecycle (`fastify.register` semantics)

### Migrasi / rollout
- Dari hari 1

## Trigger untuk revisit

- Saat butuh Edge runtime (Cloudflare Workers) → Hono
- Saat Fastify 5 release dan breaking change → upgrade plan
