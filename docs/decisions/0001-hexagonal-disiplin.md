# ADR-0001: Hexagonal Disiplin sebagai pattern arsitektur modul

- **Status**: accepted
- **Tanggal**: 2026-06-11
- **Pengambil keputusan**: Founder + AI co-architect

## Konteks

Repo ini akan dikerjakan 80% oleh AI. Pattern arsitektur akan menentukan: (a) konsistensi kode lintas modul, (b) kemudahan AI memahami konteks per fitur, (c) testability eksternal IO.

Spec mengharuskan integrasi banyak external service: Claude (LLM), Whisper (STT), WA BSP, Telegram Bot, S3, SMTP. Tradeoff utama: berapa banyak abstraksi yang berguna vs jadi overhead?

## Opsi yang dipertimbangkan

### Opsi A: DDD klasik (entity/VO/aggregate + use case + infra)
- Pros: Sangat eksplisit, domain logic isolated, scalable untuk codebase 100k+ LOC
- Cons: Boilerplate sangat banyak (3-5x file per fitur), curve belajar tinggi, overkill untuk modul CRUD sederhana, AI context window cepat penuh

### Opsi B: Hexagonal murni (semua dependency lewat port)
- Pros: Konsistensi total, semua testable
- Cons: Boilerplate ~2x lipat termasuk untuk Prisma/Redis yang sebenarnya sudah jadi abstraksi. Anti-pattern "ports everywhere" mudah terjadi

### Opsi C: Modular monolith pragmatis (no port sama sekali)
- Pros: Cepat tulis, AI-friendly minimum file
- Cons: External call susah di-mock, swap implementasi = refactor banyak titik, testability menurun

### Opsi D: Hexagonal Disiplin (pilihan) — port HANYA untuk external IO
- Pros: Testability untuk yang penting (external), no overhead untuk yang sudah abstraksi (Prisma/Redis), konsistensi via ESLint enforcement
- Cons: Aturan "kapan port kapan tidak" harus terdokumentasi tegas (mitigasi: CLAUDE.md §5 + ESLint rule)

## Keputusan

**Opsi D — Hexagonal Disiplin.**

Definisi tegas:
- **WAJIB port + adapter** untuk: external HTTP API call, outbound notification, object storage, Bull queue producer (yang dipanggil dari service)
- **DILARANG bikin port** untuk: Prisma query, Redis cache, logger, config, internal util

Enforcement:
1. CLAUDE.md §5 — aturan tertulis
2. ESLint `no-restricted-imports`: blokir import lintas `adapters/` antar modul
3. Code review checklist: "apakah port baru ini untuk external IO?"

## Konsekuensi

### Positif
- AI memproduksi kode konsisten karena aturan deterministik (`if external IO → port; else → langsung`)
- Test unit cepat (mock port saja)
- Bisa swap WA provider (1engage ↔ IOH), bisa swap LLM provider tanpa refactor service
- File count per modul terkontrol (~5-10 file)

### Negatif (yang kami terima)
- Tidak bisa unit test repository tanpa real DB → mitigasi: integration test dengan testcontainers
- Tidak bisa swap Prisma → ORM lain tanpa refactor query. Kami terima karena kemungkinan rendah dan Prisma stabil
- Onboarding developer baru butuh baca CLAUDE.md §5 (kosakata: port, adapter, driving, driven)

### Migrasi / rollout
- Mulai dari hari 1. Semua modul ikuti pattern.
- `modules/_template/` jadi referensi pola — JANGAN diubah.

## Trigger untuk revisit

- Saat 1 modul punya >5 port (kemungkinan over-engineering, perlu split modul)
- Saat tim grow > 10 dev (mungkin perlu DI container)
- Saat ingin migrasi modul → microservice terpisah (port jadi RPC interface)
