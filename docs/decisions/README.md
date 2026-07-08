# Architecture Decision Records (ADR)

Setiap keputusan arsitektur signifikan dicatat di sini sebagai ADR. Format ringan ([Michael Nygard style](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)).

## Cara pakai

1. **Baca** ADR yang relevan sebelum modifikasi area yang disinggung.
2. **Tulis ADR baru** kalau Anda mengambil keputusan teknis yang:
   - Mengubah pattern lintas modul
   - Menambah/ganti dependency major (DB, queue, framework)
   - Mengubah deployment topology
   - Trade off non-trivial yang akan ditanyakan 6 bulan dari sekarang
3. **Update status** ADR lama: `superseded by ADR-XXXX` saat ada keputusan baru.

## Format

Pakai template di [0000-template.md](./0000-template.md). Filename: `<nomor-4-digit>-<slug>.md`.

## Daftar ADR

| ADR | Judul | Status |
|---|---|---|
| 0000 | Template | — |
| [0001](./0001-hexagonal-disiplin.md) | Hexagonal Disiplin sebagai pattern modul | accepted |
| [0002](./0002-package-manager.md) | pnpm sebagai package manager | accepted |
| [0003](./0003-coding-standards.md) | TypeScript strict + ESLint type-aware + Prettier | accepted |
| [0004](./0004-one-service-one-db.md) | 1 service = 1 database = 1 Prisma schema | accepted |
| [0005](./0005-deployment-target.md) | AWS ECS Fargate default | accepted |
| [0006](./0006-fastify-vs-express.md) | Fastify HTTP framework | accepted |
| [0007](./0007-prisma-vs-alternatives.md) | Prisma ORM | accepted |
| [0008](./0008-repo-scope-integration.md) | Repo scope = Integration / Channels service | accepted |
| [0009](./0009-wa-integration-pure-boundary.md) | WA integration = pure integration layer (DND + quota di Hotel Core) | accepted |
| [0010](./0010-wa-conversation-model.md) | WA conversation + message model (Integration owns storage) | accepted |

## Prinsip

- ADR **immutable** setelah accepted. Berubah pikiran → ADR baru yang superseded ADR lama.
- ADR pendek (1-2 halaman). Kalau panjang, pecah.
- Cantumkan **trigger untuk revisit** — kapan ADR perlu di-review ulang.
