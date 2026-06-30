# CLAUDE.md — Panduan AI untuk Qooma Backend Service Boilerplate

> Dokumen wajib dibaca SETIAP kali Claude Code (atau AI lain) mengerjakan repo ini atau service turunannya. 80% pengembangan akan ditangani AI — disiplin dokumen ini = disiplin kode.

---

## 0. Cara membaca dokumen ini

- **WAJIB** = no exception, pelanggaran wajib di-revert.
- **DEFAULT** = ikuti kecuali ada alasan kuat. Kalau menyimpang, tulis alasan di komentar 1 baris.
- **HINDARI** = ada masalah konkret di balik larangan. Lihat referensi sebelum melanggar.

Saat ragu: **tanya user, jangan tebak**. Bug akibat AI tebak-tebak lebih mahal dari delay 5 menit klarifikasi.

---

## 1. Konteks repo

Ini adalah **boilerplate/pondasi** untuk backend service di ekosistem Qooma (microservices). Boilerplate menyediakan:

- Struktur folder konsisten
- Pattern arsitektur (Hexagonal Disiplin)
- Tooling lengkap: TypeScript strict, ESLint, Prettier, Jest, Docker, CI
- Konfigurasi siap pakai (env validator, logger, error handler)
- Modul referensi (`src/modules/_template/`)

Service nyata di-clone/scaffold dari sini, lalu tambah business logic sendiri.

**Prinsip Qooma**: 1 service = 1 database = 1 Prisma schema. Komunikasi antar service via API/event, BUKAN shared DB.

---

## 2. Tech stack — gunakan ini, jangan substitusi

| Layer | Pilihan resmi | Alasan jangan ganti |
|---|---|---|
| Runtime | Node.js 20 LTS | LTS sampai 2026-04, stabil |
| Bahasa | TypeScript 5.x strict | Type safety lokal & runtime guard di boundary |
| HTTP | **Fastify 4.x** | Lebih cepat dari Express, plugin system rapih |
| ORM | **Prisma 5.x** | Type-safe schema → query → result |
| Queue | **Bull 4.x** + ioredis | Stabil, banyak production track record |
| Validation | **zod 3.x** | Runtime + compile-time type |
| Date | **dayjs** + plugin timezone/utc | Ringan, immutable |
| HTTP client | **axios** | Untuk external API call |
| Log | **winston 3.x** | Structured JSON output |
| Test | **Jest 29.x** + ts-jest | Default ecosystem, mocking matang |
| Package mgr | **pnpm 9** | Strict node_modules, anti-phantom dep |
| Container | **Docker multi-stage** | Image kecil, build cepat |

**HINDARI**:
- Express (kita Fastify)
- TypeORM/Sequelize (kita Prisma)
- moment.js (deprecated, kita dayjs)
- node-fetch (kita axios)
- npm/yarn (kita pnpm — phantom dep risk)
- `any` type (lihat §7)

---

## 3. Struktur folder

Detail lengkap di **[docs/PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md)**. Ringkasan:

```
src/
├── entrypoints/            api.ts | worker.ts
├── core/                   Infrastruktur cross-cutting (BUKAN business logic)
│   ├── config/             Validasi env via zod
│   ├── logger/             Winston factory + correlation id
│   ├── errors/             AppError hierarchy
│   ├── prisma/             Prisma client singleton
│   ├── redis/              ioredis client + key namespacing
│   ├── queue/              Bull factory + naming convention
│   └── http/               HttpClient wrapper axios
├── plugins/                Fastify plugins (auth, hmac, rate-limit, error-handler)
├── shared/
│   ├── types/              Type lintas-modul
│   ├── utils/              Helper murni (masking, crypto, test-setup)
│   └── constants/          Konstanta lintas-modul (kalau ada)
└── modules/                Business modules — hexagonal-disiplin di dalam
    └── _template/          Pola REFERENSI — copy saat bikin modul baru
```

**Aturan struktur**:
- 1 modul = 1 bounded context. Modul tidak boleh import internal modul lain (`adapters/`, `*.service.ts` internal). Public API lewat barrel `index.ts`.
- Folder `_template/` adalah referensi pola, **JANGAN edit isinya**.

---

## 4. Hexagonal Disiplin — kapan pakai port, kapan tidak

Aturan **terpenting** di repo ini. Salah pakai = inkonsistensi → AI generate kode tidak prediktabel.

### WAJIB port + adapter:

| Kategori | Contoh |
|---|---|
| External HTTP API call | Claude API, OpenAI, payment gateway, vendor B2B |
| Outbound notification | Email send, SMS send, push notification, webhook callback |
| Object storage | S3 / R2 upload/download |
| Queue producer (saat dipanggil dari service) | Enqueue Bull job — untuk testability |

**Mengapa**: external IO punya 3 sifat: (a) lambat/mahal saat test, (b) bisa swap implementasi, (c) butuh mock di unit test.

### TIDAK perlu port (DILARANG bikin interface):

| Kategori | Pakai langsung |
|---|---|
| Database query | Prisma client langsung — Prisma sudah lapisan abstraksi |
| Redis | `ioredis` langsung |
| Logger | `winston` langsung |
| Config / env | `import { config } from '@core/config'` langsung |
| Internal util | `import` langsung dari `@shared/utils/...` |
| Helper dalam 1 modul | Langsung import |

**Mengapa**: wrapping Prisma/Redis = wrap-on-wrap, menambah boilerplate tanpa value. Anti-pattern "ports everywhere".

### Pola standard

**Port** (interface):
```ts
// modules/foo/ports/external-api.port.ts
export interface ExternalApiPort {
  send(input: { id: string; payload: unknown }): Promise<{ messageId: string }>;
}
```

**Adapter** (implementasi):
```ts
// modules/foo/adapters/vendor-x.adapter.ts
export class VendorXAdapter implements ExternalApiPort { ... }
```

**Service** (consume port, tidak tahu adapter):
```ts
// modules/foo/foo.service.ts
export class FooService {
  constructor(private readonly api: ExternalApiPort) {}
}
```

**Wiring** (di entrypoint atau plugin):
```ts
// src/entrypoints/api.ts
const adapter = new VendorXAdapter(httpClient, config);
const service = new FooService(adapter);
```

DI container (tsyringe/inversify): **DEFAULT tidak pakai**. Manual wiring lebih eksplisit & AI-friendly. Kalau wiring jadi unmanageable (>50 modul), baru pertimbangkan.

---

## 5. Coding standards

### TypeScript

- `strict: true` semua flag (`noImplicitAny`, `strictNullChecks`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- **HINDARI `any`** — pakai `unknown` + narrow, atau type guard. External lib tidak typed: `@ts-expect-error` dengan komentar alasan.
- `type` untuk shape data, `interface` untuk contract (port). Konsisten.
- Hindari `enum` numerik — pakai string union atau `as const` object.
- Function return type **wajib eksplisit** untuk public function.
- Export `type` pakai `import type` (ESLint enforce).
- TIDAK ADA default export (kecuali config file & entrypoint). Lihat ESLint rule.

### Naming

| Apa | Konvensi | Contoh |
|---|---|---|
| File | `kebab-case.ts` | `external-api.port.ts` |
| Class | `PascalCase` | `FooService`, `VendorXAdapter` |
| Function | `camelCase` | `createFoo`, `validateInput` |
| Constant | `SCREAMING_SNAKE_CASE` | `DEFAULT_TIMEOUT_MS` |
| Type / Interface | `PascalCase` | `FooDomain`, `FooStatus` |
| Folder | `kebab-case` | `external-api`, `email-intake` |
| Test file | `<name>.test.ts` / `<name>.integration.test.ts` | `foo.service.test.ts` |

### Komentar

- Default: **tidak menulis komentar.** Nama variable/fungsi yang baik = self-doc.
- Tulis komentar HANYA kalau alasan non-obvious: workaround bug, invariant tersembunyi, referensi issue.
- TIDAK boleh komentar tipe `// Ambil data` untuk `const data = await db.foo.findMany()`.

### Error handling

- Hierarchy `AppError` di `core/errors/`:
  - `ValidationError` (400)
  - `AuthError` (401)
  - `ForbiddenError` (403)
  - `NotFoundError` (404)
  - `ConflictError` (409)
  - `RateLimitError` (429)
  - `ExternalServiceError` (502/503) — info upstream untuk Sentry
- Service throw `AppError` subclass. Plugin `error-handler` translate ke HTTP response.
- TIDAK BOLEH `throw new Error('string')` di service — pakai class.
- Untuk Bull job, error bubble up → Bull retry sesuai config job.

---

## 6. Security — aturan WAJIB

Detail di [docs/SECURITY.md](./docs/SECURITY.md). Ringkasan absolut:

1. **Token sensitif WAJIB enkripsi at-rest** (AES-256-GCM). Pakai helper `shared/utils/crypto.ts`.
2. **Webhook WAJIB validasi HMAC** sebelum business logic. Pakai `timingSafeEqual` (bukan `===`).
3. **PII WAJIB di-mask di log** (nomor HP, email): pakai helper `maskWaPhone()`, `maskEmail()`.
4. **JWT**: access 8 jam, refresh 30 hari. Refresh token disimpan hashed.
5. **Rate limit**: 100 req/menit per IP untuk public API.
6. **TIDAK BOLEH log secrets**: token, password, API key. Winston redact otomatis.

---

## 7. Logging & observability

- Structured logging via winston, output JSON di production.
- Setiap log line punya: `level`, `timestamp` (ISO UTC), `correlationId`, `msg`, `module`.
- TIDAK BOLEH `console.log` di code (ESLint enforce). `console.warn`/`error` OK untuk script.
- Setiap request HTTP punya correlation ID (header `x-correlation-id` atau di-generate).
- Sentry untuk error tracking (env `SENTRY_DSN` kosong = disabled, OK untuk lokal).
- Setiap call ke external API: log `external_call` dengan `service`, `duration_ms`, `status`.

---

## 8. Testing — aturan WAJIB

Detail di [docs/TESTING.md](./docs/TESTING.md). Ringkasan:

| Jenis | Kapan | Tool | Coverage minimal |
|---|---|---|---|
| Unit | Setiap service method dengan branching logic | Jest, mock port | 80% line |
| Integration | Tiap repository, tiap modul dengan side-effect | Jest + testcontainers (real PG/Redis) | sesuai kebutuhan |
| E2E | Critical user flow | super_test untuk HTTP | golden path only |

- Setiap PR yang menambah/ubah business logic WAJIB ada test baru atau modifikasi.
- TIDAK BOLEH skip test (`it.skip`) di main. Disable: hapus + buat issue.
- Mock external port di unit. JANGAN mock Prisma — gunakan integration test.
- Test naming: `it('should <expected> when <condition>')`.

---

## 9. Common patterns

### Pattern: Fastify route + zod validation

```ts
import type { FastifyPluginAsync } from 'fastify';
import { CreateFooSchema, type CreateFooDto } from './foo.schema.js';

export const fooRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateFooDto }>(
    '/foo',
    { schema: { body: CreateFooSchema } },
    async (req, reply) => {
      const result = await fastify.services.foo.create(req.body);
      return reply.code(201).send(result);
    },
  );
};
```

### Pattern: Bull job enqueue + processor

```ts
import { Queue } from 'bull';
import type { FooJobData } from './foo.types.js';

export const fooQueue = new Queue<FooJobData>('foo', { redis: redisConfig });

fooQueue.process('process_something', WORKER_CONCURRENCY.DEFAULT, async (job) => {
  await fooService.processSomething(job.data.id);
});
```

### Pattern: Service dengan port (Hexagonal Disiplin)

```ts
export class FooService {
  constructor(
    private readonly repo: FooRepository,
    private readonly externalApi: ExternalApiPort,
  ) {}

  async create(input: CreateFooDto): Promise<FooDomain> {
    const created = await this.repo.create(input);
    await this.externalApi.notify({ id: created.id });
    return created;
  }
}
```

---

## 10. Anti-patterns — HINDARI ini

| ❌ Anti-pattern | ✅ Alternatif | Alasan |
|---|---|---|
| Bikin `IUserRepository` interface untuk wrap Prisma | Pakai Prisma client langsung | Wrap-on-wrap |
| `throw new Error('Not found')` | `throw new NotFoundError('Foo', id)` | Tidak terklasifikasi di handler |
| `const result: any = await ...` | zod parse + typed result | Loss of type safety |
| Import dari `../foo/adapters/X` di modul lain | Import dari `@modules/foo` (barrel) atau via event | Cross-boundary leak |
| Hardcode token: `const TOKEN = '123'` | `config.token` (dari env) | Secret commit |
| `setTimeout(fn, 1000*60*15)` untuk delay | Bull job dengan `delay` option | Lost on restart |
| Logic di Fastify handler langsung | Tipis: validate → call service → return | Susah test |
| Webhook tanpa HMAC validation | Validate signature dulu | Spoofing |
| Mock Prisma di unit test | Pakai integration test dengan real DB | Mock drift |
| `console.log(req.body)` saat debug | `logger.debug({ body: redact(req.body) })` | Secret leak |
| Pakai default export | Named export (ESLint enforce) | Refactor-friendly |
| `enum` numerik | string union `as const` | Predictable serialization |

---

## 11. Workflow — kapan AI ngerjain langsung vs tanya user

### AI lanjut tanpa nanya:
- Implementasi sesuai task yang sudah jelas + AC ada.
- Refactor minor tanpa ubah kontrak public.
- Tulis test untuk function yang sudah ada.
- Bug fix dengan root cause jelas.

### AI WAJIB tanya user dulu:
- Mau bikin dependency baru (tambah package.json).
- Mau buat migration baru / ubah schema.
- Mau ubah kontrak API yang sudah dipublish.
- Mau hapus file/folder non-trivial.
- Mau bypass aturan security WAJIB.
- Trade off serius antar 2-3 opsi teknik.

### Workflow saat receive task baru
1. Baca CLAUDE.md (ulangi) + README modul yang relevan.
2. Cek `docs/decisions/` apakah ada ADR terkait.
3. Cek `src/modules/_template/` untuk pola modul.
4. Buat task list (TaskCreate).
5. Implementasi → unit test → integration test → lint → typecheck.
6. Sebutkan AC/issue mana yang sudah di-cover di response.

---

## 12. Git & commit

- Branch: `feat/<modul>-<short>`, `fix/<modul>-<short>`, `chore/<short>`, `docs/<short>`.
- Commit message **conventional commits**: `feat(modul): tambah X`, `fix(modul): perbaiki Y`.
- 1 PR = 1 fitur/fix logis. Jangan campur.
- Squash merge ke `main`.
- Wajib lewat CI (lint, typecheck, test, build).
- TIDAK BOLEH push ke `main` langsung.
- TIDAK BOLEH `git push --force` ke branch shared.

Gunakan `make commit MSG="feat(modul): X"` — auto lint + typecheck + format-check sebelum commit.

---

## 13. PR checklist (yang AI WAJIB pastikan sebelum minta review)

- [ ] Code mengikuti struktur modul (`docs/MODULE_TEMPLATE.md`)
- [ ] Secrets tidak hardcoded
- [ ] AC/issue referensi disebutkan
- [ ] Unit test ditambah, lulus
- [ ] Integration test ditambah (jika ada side-effect), lulus
- [ ] Structured logging + correlation ID
- [ ] Update dokumentasi modul (jika kontrak berubah)
- [ ] `make check` hijau
- [ ] Tidak ada `any`, `console.log`, `@ts-ignore`

---

## 14. Jika dokumen ini bertentangan dengan dirinya sendiri

Laporkan ke user. Jangan asumsi. Aturan WAJIB tidak boleh konflik — kalau terjadi, salah satu adalah typo/draft. Default behavior: **pilih opsi yang paling restriktif** sampai user konfirmasi.
