# PM-STATUS-C — Qooma Integration · Dev C (Satrio)

> **Per-dev tracker untuk slot C (Satrio).** PM C + Executor C komunikasi **hanya** via file ini. Roll-up short summary ke `PM-STATUS-PARENT.md §2` setelah tiap VERDICT atau end-of-session.
>
> **PM A, PM B, Executor A, Executor B — JANGAN edit file ini.** File ini private ke slot C.
>
> **Identity check**: di response pertama session WAJIB confirm `Role: PM | Executor`, `Slot: C (Satrio)`. Bila user belum sebut slot — STOP, tanya dulu (lihat `KICKOFF.md §4`).
>
> Format block di §2 Active assignments **append-only** (lihat `EXECUTOR-PROTOCOL.md §0.5` & `PM-AGENT.md §0.4`).
>
> **Domain slot C (Integration)**: Telegram + OTA + QR + health — `telegram_configs` CRUD, per-dept Telegram routing write-through (HC `departments`), Telegram inbound commands (`/take` `/release` `/done` `/help`), outbound Telegram dispatch, OTA IMAP poller + parser → HC pending-visit RPC, QR generation/download (1024×1024 PNG → object storage), integration overview, channel health probes + snapshots + `integration:health_changed` socket emits. Spec routing: C1–C9 (`docs/spec/MVP-INTEGRATION-FIRST.md §1`).

---

## 0. Current focus (slot C)

- **Day**: H12+ (task tracker activated 2026-06-30)
- **Active task**: T17 (spec reading + module skeleton allowed; impl blocked sampai T02 APPROVE)
- **Branch**: —
- **Next gate (global)**: G1 — lihat `PM-STATUS-PARENT.md §5`
- **My queue (preview)**: T17–T25 (Telegram + OTA + QR + health) — lihat §8 di bawah
- **Critical dependency**: T02 (Nathan, Prisma migration) + T03 (encryption helper) WAJIB approved sebelum T17 impl. Sampai itu — boleh baca spec, draft module skeleton, draft types, draft handler stub. JANGAN `prisma generate` / hit DB / commit migration sendiri.
- **Cross-service note**: T18 (per-dept routing write-through) menulis langsung ke HC `departments.telegram_chat_id` per Q-OPS-06 — perlu koordinasi dengan PM B Hotel Core supaya shared-DB write tidak conflict dengan HC `departments` schema migration. Lihat `docs/spec/04-integration-channels.md` §6.

---

## 1. Task tracker (slot C — PM C authority)

> Mirror dari `PM-STATUS-PARENT.md §1` di mana Slot=C. PM C update status row di sini + push status update ke PARENT §1 setelah verdict.

| T## | Title                                                                            | Status   | Verified by PM | Notes                                                              |
| --- | -------------------------------------------------------------------------------- | -------- | -------------- | ------------------------------------------------------------------ |
| T17 | Telegram config CRUD (`GET, PUT /api/integrations/telegram`)                     | merged   | PM C (H13, a2) | Primitive merged PR #11 `0d89d76` at 2026-07-04T19:32:26Z (red-docker precedent honored). Router+api.ts wiring = T17-followup blocked on Q-C-01/02/03 |
| T18 | Per-dept Telegram routing write-through (HC `departments` table)                 | backlog  | —              | After T17; per Q-OPS-06 shared-DB direct write                     |
| T19 | Telegram inbound webhook + commands (`/take`, `/release`, `/done`, `/help`)      | approved (primitive) | PM C (H15, a1) | Primitive shipped: parser + zod passthrough schema + type-only StaffLookupPort + TicketActionPort + service (anti-enumeration silent-ignore, PII-suffix log) + 41 unit tests, 100% stmt/func/line + 92.85% branch cov, drift clean, make check green on PM rerun. No `@prisma/client` import — sidesteps Q-C-05. Router+HMAC+HC RPC adapters+`webhook_events` persist = T19-followup on Q-C-01/02/03/06/07. Branch `feat/telegram-inbound-commands @ 9c0bbc5`, PR pending open |
| T20 | Outbound Telegram dispatch RPC                                                   | backlog  | —              | After T06 + T09 (Nathan); per-dept routing per T18                 |
| T21 | OTA email IMAP poller + parser pipeline + HC pending-visit RPC                   | backlog  | —              | After T07 (Nathan); HC internal RPC for pending-visit insert       |
| T22 | QR generation + download (1024×1024 PNG, object storage)                         | backlog  | —              | After T02 + T10 (Nanak)                                            |
| T23 | Integration overview endpoint (`GET /api/integrations`)                          | backlog  | —              | After T10 (Nanak) + T17                                            |
| T24 | Channel health probes + snapshots + 2-poll debounce                              | backlog  | —              | After T07 (Nathan) + T10 (Nanak) + T17                             |
| T25 | `integration:health_changed` socket emits                                        | backlog  | —              | After T24                                                          |

---

## 2. Active assignments (append-only)

> **Executor C** append `ASSIGNMENT` block saat claim task. **PM C** append `ACK` / `VERDICT` sub-block di bawah block executor — JANGAN edit block lama.

### ASSIGNMENT T17 — claimed by exec-C (Satrio) at H13 09:10
- Branch: `feat/telegram-config-crud`
- Routed from: PM-STATUS-C.md §1 T17 (assigned; deps T02 + T03 now merged per PARENT foundation 9/9 signal in git log `aa4c150` + PM-STATUS-A.md tracker)

#### PLAN T17 — exec-C (Satrio) at H13 09:10

**Scope recap**
Deliver C1 per `docs/spec/MVP-INTEGRATION-FIRST.md §1.3` + `docs/spec/04-integration-channels.md §2.1` / §4.2: `GET, PUT /api/integrations/telegram` (role `gm_admin`). PUT body `{ bot_token, bot_username, default_chat_id?, gm_telegram_id?, webhook_url? }` upsert-by-`hotel_id` into `telegram_configs`; `bot_token` encrypted-at-rest via `@shared/utils/crypto.encrypt` (T03). GET returns config with `bot_token` MASKED via `maskTokenForLog` (per PM A note §T03 "masking-on-GET enforced at B/C config-CRUD response layer") and never decrypts on read path. Emphasis: fail-fast on missing encryption key (T03 already enforces at boot); reject PUT with `ValidationError` on empty `bot_token` / oversize; log write with masked token only.

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot C (Satrio) ✓
- CLAUDE.md loaded ✓
- Task spec read: `docs/spec/MVP-INTEGRATION-FIRST.md §1.3 (C1)`, `§4.1`, `§5 AC line 124`; `docs/spec/04-integration-channels.md §2.1 (row `/telegram`)`, `§4.2 telegram_configs DDL`
- Parent docs spot-read: `CLAUDE.md §4 / §5 / §6`, `docs/MODULE_TEMPLATE.md §1-§3`, `docs/SECURITY.md §3 (encryption envelope)`, `src/modules/_template/*` (pola referensi)
- Dependencies: T02 ✓ (schema `TelegramConfig` present at `prisma/schema.prisma:49-61`), T03 ✓ (crypto helper live at `src/shared/utils/crypto.ts`)
- `make typecheck` clean ✓ / `make lint` clean ✓ — **PENDING**: `node_modules` belum ada di working tree ini (fresh clone / clean checkout). Perlu `make install` (pnpm install + prisma generate) sekali sebelum §4.4 self-validate — bukan `pnpm add` package baru, hanya restore lockfile. **Konfirmasi PM C**: OK jalankan `make install` sebelum coding? (GAP T17-#5).
- Scaffolder risk: none — semua file baru di dalam `src/modules/telegram/` (copy pola `_template/`); tidak ada `pnpm create` / `prisma init`.

**Files to create**
```
src/modules/telegram/
├── index.ts                         (barrel — export types + route registrar)
├── telegram.routes.ts               (Fastify plugin — GET/PUT /api/integrations/telegram)
├── telegram.service.ts              (business logic: get/upsert, encrypt/mask)
├── telegram.repository.ts           (Prisma queries langsung; ADR-0001 — no interface)
├── telegram.schema.ts               (zod: TelegramConfigPutSchema, TelegramConfigResponseSchema)
├── telegram.types.ts                (TelegramConfigDomain, TelegramConfigView)
└── __tests__/
    ├── telegram.service.test.ts               (unit — mask/encrypt behavior, upsert semantics)
    └── telegram.repository.integration.test.ts (integration — real Postgres via testcontainers)
```

**Files to modify**
- `src/core/prisma/prisma-client.ts` — **conditional (GAP T17-#1)**: wire the singleton (the file already carries the commented-out impl block at lines 12-27); uncomment + adopt. Minimal, no new dep, no schema change.
- `src/entrypoints/api.ts` — **conditional (GAP T17-#2)**: bring Fastify up minimally (loadConfig, createLogger, error-handler plugin, correlation-id header, mount `telegramRoutes` under `/api`). Structure only, no other module routes.

**Approach**
1. Repository = thin Prisma wrapper: `getByHotelId(hotelId): TelegramConfigDomain | null`, `upsert(hotelId, encryptedInput): TelegramConfigDomain` — direct `db.telegramConfig.findUnique` / `db.telegramConfig.upsert`. No interface (ADR-0001).
2. Service consumes repository + `encrypt` + `maskTokenForLog` from `@shared/utils/*`. `get(hotelId)`: fetch → if null throw `NotFoundError('telegram_config', hotelId)`; else return view with `botToken` = `maskTokenForLog(decrypted-length-only)` — actually, since we never decrypt on GET (crypto envelope is opaque), the view surfaces a masking derived from stored `bot_token_enc` prefix/suffix — spec says only "MASKED", so implement `maskTokenForLog('****' + last3-of-envelope-hash)` — flagged as sub-note. `upsert(hotelId, dto)`: validate → `encrypt(dto.botToken)` → `repository.upsert` with the ciphertext + other fields verbatim → log `{ hotel_id, bot_token: '***<last3-of-plaintext>' }` (mask BEFORE encrypt) → return view.
3. Routes: `GET /api/integrations/telegram` + `PUT /api/integrations/telegram` — role-guarded via **stub preHandler** `requireGmAdmin` colocated in `telegram.routes.ts` (GAP T17-#3 — real JWT plugin lands in later task per foundation being 9/9 without JWT). Body validated by zod. Empty body / missing `bot_token` on PUT → `ValidationError` mapped to 400 by error-handler.
4. Unit tests: service `.get / .upsert` with mocked repo — assert encrypt call, mask presence in returned view, log-line contains only masked token. Integration test: hits real Postgres via testcontainers (per `docs/TESTING.md`), asserts round-trip and `bot_token_enc` != plaintext, index used on `hotel_id`.

**GAPs / questions**
- **GAP T17-#1 — Prisma client singleton stub.** `src/core/prisma/prisma-client.ts` masih return `{}` placeholder. Repository perlu real `PrismaClient` untuk integration test. Opsi: (A) uncomment existing impl-block di file itu sebagai bagian T17 — minimal, dep sudah declared di `package.json` (`@prisma/client ^5.22.0`); (B) tunggu dedicated foundation task; (C) ship repository dengan stub, integration test defer. **My intent: A** — komentar impl sudah ada di file, tidak menambah dep, tidak change schema; membuka path T10 (Nanak) juga. Batas: hanya un-comment + assign type ke `db`; tidak refactor.
- **GAP T17-#2 — Entrypoint `api.ts` stub.** Belum ada Fastify server + plugin registration; endpoint T17 tidak bisa reachable. Opsi: (A) bring Fastify up minimally di T17 (error-handler + correlation-id + mount telegram routes only) — footprint kecil, tidak claim domain lain; (B) task terpisah "API bootstrap" first. **My intent: A** — minimal wiring saja, tidak wire WA/QR/health routes (biar Nanak / next T17-adjacent task); PM boleh flag kalau prefer opsi B (kalau iya, saya park di route module + defer integration curl evidence).
- **GAP T17-#3 — Session auth (JWT) belum ada.** `gm_admin` role guard butuh session auth; `src/plugins/` cuma punya HMAC (webhook) + internal-RPC-shared-secret. Opsi: (A) ship stub `requireGmAdmin` preHandler di `telegram.routes.ts` yang baca `req.user.role` dari decorator (yang belum di-populate) + throw `AuthError('unauthenticated')` bila missing — real JWT plugin task terpisah; (B) blokir T17 sampai JWT plugin task planned + landed. **My intent: A** — stub preHandler + typed `req.user` shape lokal; nanti JWT plugin replace stub. Endpoint effectively 401 semua request sampai JWT populate `req.user` — aman, tidak leak, dan T17 code path complete.
- **GAP T17-#4 — Tenant identification di CRUD endpoint.** Spec `/api/integrations/telegram` tidak punya `:hotel_slug` di path (beda dengan webhook routes). Sumber `hotel_id`? Opsi: (A) dari JWT payload `req.user.hotelId` (session-scoped) — pola CRM standar; (B) header `X-Hotel-Id`; (C) path prefix `/api/hotels/:hotel_slug/integrations/telegram`. **My intent: A** — konsisten dengan spec §2.1 role-based CRUD (session-bound), reject cross-tenant otomatis by session. GAP T17-#3 stub akan set `req.user.hotelId`; real JWT plugin ambil dari signed token.
- **GAP T17-#5 — `make install` di working tree ini.** `node_modules` belum ada; `make typecheck` / `make lint` / `make test-unit` semua fail tanpa install. Hanya `pnpm install --frozen-lockfile` + `prisma generate` — bukan add package baru, tidak sentuh `package.json` / `pnpm-lock.yaml`. **My intent**: jalankan `make install` sekali sebelum coding, tidak commit apa-apa dari itu (ignored per `.gitignore`). Konfirmasi PM C?

Awaiting PM C ACK — terutama GAP #1/#2/#3 shape scope keputusan.

##### PM C REJECT-PLAN T17 (attempt 1) — narrow scope + escalate foundation gaps (H13)

**Executive summary**: PLAN akurat vs spec §2.1 + §4.2 (endpoint contract, DDL match, deps T02+T03 tepat) — **tapi 3 dari 5 GAPs adalah shared-infra edits di luar otoritas slot C**, dan 1 item Approach (masking-of-envelope) salah. Precedent: PM A untuk T04–T09 secara eksplisit **tidak menyentuh** `api.ts`, `prisma-client.ts`, atau assembly wiring — semua primitif dibuat unit-testable dan deferred ke "assembly" (lihat PM A T04 SUBMIT L1066 & T08 GAP-#2 L1054). T17 mengikuti pola yang sama: narrow, unit-testable primitif — router + integration + JWT stub + api.ts + prisma singleton **dikeluarkan dari scope T17**.

Verdict: **REJECT-PLAN**. Fix-path di bawah. Foundation gap dieskalasi ke Parent PM (Q-C-01/02/03/04).

---

⛔ **Items to fix in PLAN (executor-side, before resubmitting PLAN)**

**Item #1 — Masking design broken** — PLAN Approach step 2
- **Violation**: GET view mask derived from `bot_token_enc` envelope prefix/suffix → hash of ciphertext, bukan plaintext. Random IV per encrypt (crypto.ts:53) berarti mask **berubah tiap PUT walau token sama** → tidak konfirmasi token yang benar tersimpan. Pattern spec (MVP §5 L118 WA "MASKED in response") mengasumsikan mask stabil terhadap plaintext.
- **Fix**: pada GET, `decrypt(botTokenEnc)` → `maskTokenForLog(plaintext)` → return `***<last3-of-plaintext>`. Helper sudah ada di `src/shared/utils/masking.ts:34` (menerima plaintext). Perf cost: 1 AES-GCM decrypt per GM view — negligible. PUT-time log masking (mask BEFORE encrypt) tetap benar — no change.

**Item #2 — Scope bundling shared-infra edits** — PLAN GAPs #1, #2, #3
- **Violation**: PLAN bundles 3 shared-infra changes (`src/core/prisma/prisma-client.ts` uncomment, `src/entrypoints/api.ts` bootstrap, stub `requireGmAdmin` in `telegram.routes.ts`) ke dalam slot-C task. Per `PM-AGENT.md §0.6`: "bila gap affect > 1 dev, escalate ke Parent PM SEBELUM edit." Semua tiga affect >1 slot (Prisma singleton enables T10 Nanak; api.ts affects semua endpoint; JWT contract lintas repo Auth). PM A precedent selama 6 primitif (T04–T09) = **never wire, always defer to assembly** — PLAN T17 melanggar precedent.
- **Fix**: strip semua 3 shared-infra edits dari `Files to modify`. Remove `telegram.routes.ts` dari `Files to create` untuk attempt ini (needs JWT plugin + api.ts wiring — post-foundation). Prosisi PLAN revisi = primitif unit-testable saja.

**Item #3 — Repository as concrete Prisma-direct**, bukan interface
- **Clarification** (bukan violation, PLAN sudah benar tapi kontradiktif dengan Approach step 1 vs GAP #1): PLAN Approach step 1 correct ("no interface, direct Prisma per ADR-0001"). Tapi karena `db = {}` placeholder, repository **tidak bisa compile against real client** sampai foundation land. Fix: repository consumes an **injected `PrismaClient`-shaped argument** via ctor (typed dari `@prisma/client` import — dep sudah declared). Service consumes repository via ctor. Kedua-nya unit-testable dengan plain-object mock in tests. Pola sama seperti PM A T05 (`HotelSlugLookup` injected port pattern). Repository **file itself** tetap Prisma-direct (bukan wrap interface) — ADR-0001 aman.

---

🟢 **What Executor C MAY proceed on now (narrow, self-contained)**

Boleh langsung tanpa ACK tambahan (mengikuti PM A T04–T09 precedent):

- ✅ `src/modules/telegram/telegram.types.ts` — `TelegramConfigDomain`, `TelegramConfigView` types.
- ✅ `src/modules/telegram/telegram.schema.ts` — zod `TelegramConfigPutSchema`, `TelegramConfigResponseSchema`.
- ✅ `src/modules/telegram/telegram.repository.ts` — Prisma-direct impl, ctor-injected `PrismaClient` (import from `@prisma/client`); wraps `findUnique` + `upsert`. Not a wrap-interface. Compiles standalone; runs against real DB later saat foundation land.
- ✅ `src/modules/telegram/telegram.service.ts` — ctor-injected repository + `encrypt`/`maskTokenForLog`. Implements `get(hotelId)` (decrypt → mask → view), `upsert(hotelId, dto)` (mask-log → encrypt → repo.upsert → view).
- ✅ `src/modules/telegram/index.ts` — barrel: **types + service factory only** (no routes yet, no adapter concept since repository is Prisma-direct).
- ✅ `src/modules/telegram/__tests__/telegram.service.test.ts` — unit test w/ plain-object mock repo. Cover: `get` decrypt+mask roundtrip, `get` NotFoundError on null, `upsert` encrypt-then-persist, `upsert` returns view w/ masked token, log-line contains masked token only (PII floor). Coverage ≥ 80% line for service.
- ✅ `pnpm install --frozen-lockfile` + `pnpm prisma:generate` (GAP #5). No lockfile mutation, no new dep. **ACK GAP-#5.**

**Do NOT touch this attempt (foundation authority; blocked on Q-C-01/02/03)**:
- ❌ `src/core/prisma/prisma-client.ts` — leave `db = {}` placeholder. (Q-C-01)
- ❌ `src/entrypoints/api.ts` — leave stub. (Q-C-02)
- ❌ Any auth/JWT plugin work; do NOT create stub `requireGmAdmin`. (Q-C-03)
- ❌ `src/modules/telegram/telegram.routes.ts` — omit from PLAN entirely. Route landing = post-foundation follow-up task.
- ❌ `src/modules/telegram/__tests__/telegram.repository.integration.test.ts` — defer. Cannot run without live Prisma singleton.

DoD self-check reformulation for T17 attempt 1: shrink to "primitive shipped, unit-tested" (spec §5 L124 CRUD *behavior* covered by service unit tests via decrypt+mask+upsert semantics; endpoint reachability deferred to foundation follow-up + T17-followup route landing).

---

🚨 **Escalations to Parent PM (foundation gaps)** — see slot C §3 below; mirror to PARENT §3 posted.

- **Q-C-01** — Prisma client singleton wiring (still `{}` placeholder at prisma-client.ts:29). Not in T01–T09 scope; foundation "9/9 complete" berlaku untuk task-list tapi assembly primitif ini belum shipped. Affects T10 (B) + T17-T25 (C). **Ask**: (a) route as slot-A foundation follow-up, atau (b) authorize slot-C ship (1-line uncomment). Preferred (a).
- **Q-C-02** — `src/entrypoints/api.ts` bootstrap (Fastify server + error-handler + correlation-id + tenant-resolver + config load + graceful shutdown). No routes reachable sampai landed. Q-A-05 (eslint async-hook `checksVoidReturn.properties:false`) recommended landed **before** or **with** api.ts.
- **Q-C-03** — Session/JWT auth plugin absent. All CRUD endpoints spec'd `gm_admin` (spec §2.1) tidak reachable. `env.ts:36-39` declares `JWT_ACCESS_SECRET/TTL/REFRESH_*` — no plugin consumer. Auth svc lives in separate repo (KICKOFF §1 L11) — Integration verifies JWTs issued by Auth. **Cross-service contract Qs untuk PO**: (a) verification method (JWKS URL vs HS256 shared secret)? (b) JWT payload shape (`sub`, `hotel_id`, `role`, exp)? (c) refresh-token relevance (this svc doesn't issue)? Preferred MVP: HS256 shared secret + `{ sub, hotel_id, role }` payload + verify-only plugin. Blocks T10–T20 + T23.
- **Q-C-04** (cascading Q-C-03) — Tenant identification pada CRUD endpoints (spec `/api/integrations/telegram` tidak punya `:hotel_slug` di path, beda dari webhook `/webhooks/wa/:hotel_slug` §2.2). Preferred: JWT payload `hotel_id`. Locked ke Q-C-03 outcome.

---

**T17 status**: keep `wip` (turun dari `assigned`) untuk narrow primitive; endpoint deliverable = escalated waiting on Q-C-01/02/03.

Executor C: proceed pada Files-boleh-touch list di atas; ship SUBMIT saat primitif + unit test ≥80% + `make check` green. Router + integration + api.ts wiring = follow-up task setelah Q-C-01/02/03 resolved.

#### SUBMIT T17 — exec-C (Satrio) at H13 10:35 (attempt 2, narrow-scope per PM C REJECT-PLAN)

Task: Telegram config CRUD primitive (C1) — types, schema (zod), Prisma-direct repository, service with encrypt-on-write + decrypt+mask-on-read + PII-floor log, unit tests. Router + api.ts wiring deferred per Q-C-01/02/03.

Files changed: 8 (all new; scope strictly `src/modules/telegram/**`)
  - src/modules/telegram/index.ts (new — barrel, types + service + repository + schema exports; no route export)
  - src/modules/telegram/telegram.types.ts (new — `TelegramConfigDomain`, `TelegramConfigView`)
  - src/modules/telegram/telegram.schema.ts (new — zod `TelegramConfigPutSchema` strict, `TelegramConfigResponseSchema`)
  - src/modules/telegram/telegram.repository.ts (new — Prisma-direct, ctor-injected `PrismaClient` per REJECT Item #3)
  - src/modules/telegram/telegram.service.ts (new — `get` (decrypt→mask→view) + `upsert` (mask-log→encrypt→persist→view))
  - src/modules/telegram/__tests__/telegram.service.test.ts (new — 11 tests: get, NotFound, no-plaintext-in-view, upsert-encrypts, upsert-view-masked, PII-floor log, nullish-coerce, passthrough, round-trip)
  - src/modules/telegram/__tests__/telegram.repository.test.ts (new — 3 tests: findByHotelId null, findByHotelId row-map, upsert create/update payload shape)
  - src/modules/telegram/__tests__/telegram.schema.test.ts (new — 8 tests: put valid/optional/rejects, response valid/rejects)

Files NOT touched (per PM C REJECT Item #2 — foundation authority):
  - src/core/prisma/prisma-client.ts (still `{}` stub — Q-C-01 open)
  - src/entrypoints/api.ts (still stub — Q-C-02 open)
  - src/plugins/ (no JWT plugin authored — Q-C-03 open)
  - src/modules/telegram/telegram.routes.ts (not created — post-foundation follow-up)

DoD self-check (narrowed per REJECT-PLAN §142)
- [x] **Item #1 (masking fix)** — GET view calls `decrypt(botTokenEnc)` → `maskTokenForLog(plaintext)` at `telegram.service.ts:47`; stable across encrypts of same plaintext. Test `service.test.ts:186 'should return view with masked bot_token, not plaintext or ciphertext'` + round-trip test verify.
- [x] **Item #2 (scope narrowed)** — zero touches to `prisma-client.ts` / `api.ts` / any auth plugin / `telegram.routes.ts`. Verified: `git status` shows only `src/modules/telegram/`.
- [x] **Item #3 (Prisma-direct + ctor-inject)** — `telegram.repository.ts:14` `constructor(private readonly db: PrismaClient)`; no wrap-interface. Import `PrismaClient` + `TelegramConfig` types directly from `@prisma/client`. ADR-0001 preserved.
- [x] **GAP #5 ACK (make install)** — `pnpm install --frozen-lockfile` + `pnpm prisma:generate` ran once (no lockfile mutation; both `pnpm-lock.yaml` and `package.json` unchanged in `git status`).
- [x] **Spec §4.1 encryption at rest** — `bot_token` encrypted via `encrypt()` (T03) at `telegram.service.ts:38` BEFORE `repository.upsert`. Verified in test: `decrypt(receivedInput.botTokenEnc) === plaintext`.
- [x] **Spec §5 L124 CRUD AC (behavior)** — `PUT { bot_token, bot_username } succeeds`: `upsert` returns `TelegramConfigView` with masked token + persists ciphertext; GET reciprocates. Endpoint reachability defers to post-foundation router-landing task.
- [x] **PII floor** — `logger.info` at `telegram.service.ts:29` receives `maskTokenForLog(input.botToken)`, not plaintext. Test `should log masked bot_token BEFORE encrypt (PII floor)` asserts `JSON.stringify(loggedPayload)` does not contain the plaintext.

Quality gate
- `make lint`: PASS (0 errors, 0 warnings, --max-warnings 0)
- `make format-check`: PASS (prettier --check clean)
- `make typecheck`: PASS (tsc --noEmit, strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess)
- `make test-unit`: PASS (108 tests, 12 suites; +22 new tests in `src/modules/telegram/__tests__/`)
- `make check` (combined): **PASS**
- Module coverage (isolated to `src/modules/telegram/**`): **100% stmts / 100% branch / 100% funcs / 100% lines** — verified via `pnpm test:coverage --collectCoverageFrom='src/modules/telegram/**/*.ts'`

Drift scans (per EXECUTOR-PROTOCOL §4.4, scoped to `src/modules/telegram/`)
- `any` / `<any>` / `as any`: 0 hits
- `console.log|info|debug`: 0 hits
- `throw new Error(`: 0 hits (service uses `NotFoundError` from `@core/errors/app-errors.js`)
- forbidden imports (express/typeorm/sequelize/moment/node-fetch): 0 hits
- default export outside entrypoints/config: 0 hits
- `.skip(` in tests: 0 hits
- Pre-existing hits outside my scope (informational, not caused by T17): `throw new Error(` in `src/core/config/env.ts:75` (boot-time fail-fast) + `src/core/http/http-client.ts:19,27` (foundation stub).

Security check (per CLAUDE §6)
- Token encryption via `@shared/utils/crypto.encrypt` (T03 AES-256-GCM): yes — `telegram.service.ts:38`.
- No plaintext token in DB write: verified — repository receives `botTokenEnc` only.
- No plaintext / ciphertext in GET response view: verified — `view.botToken` = `maskTokenForLog(decrypt(...))` at `telegram.service.ts:47-49`.
- No plaintext in log line (PII floor): verified — `logger.info(...maskTokenForLog(input.botToken)...)` at `telegram.service.ts:29-35`; unit test asserts.
- No secret hardcoded: verified — `ENCRYPTION_KEY` sourced from `@core/config/env.js` via `crypto.ts`. Test-only literal `VALID_KEY = 'a'.repeat(64)` lives in test file, matches existing crypto.test pattern.
- HMAC / webhook / N/A this scope.

Test evidence (unit only; integration deferred per REJECT `Do NOT touch` list)
- Suites added: 3 (`telegram.service.test.ts`, `telegram.repository.test.ts`, `telegram.schema.test.ts`)
- Tests added: 22 (11 service + 3 repository + 8 schema)
- Round-trip coverage: `upsert` view.botToken === `get` view.botToken === `maskTokenForLog(plaintext)`
- PII floor coverage: `JSON.stringify(loggedPayload)` asserted to not contain plaintext token

Notes / open items
- Router landing (`telegram.routes.ts` + Fastify plugin `requireGmAdmin` + `/api/integrations/telegram` mount) blocked on Q-C-01 (prisma singleton) + Q-C-02 (`api.ts` bootstrap) + Q-C-03 (JWT plugin / cross-service contract). Ready to pick up as T17-followup once PO ratifies + foundation follow-ups land.
- Integration test (`telegram.repository.integration.test.ts`) deferred by PM C — same blockers. Repository is Prisma-direct against real client shape from `@prisma/client` (types match schema exactly), so integration should be a plug-in once singleton lands.
- `docs/spec/04-integration-channels.md §4.2` DDL vs Prisma model `TelegramConfig` @ `prisma/schema.prisma:49-61` — all fields aligned (hotel_id PK, bot_token_enc TEXT, bot_username VARCHAR(40), default_chat_id/gm_telegram_id/webhook_url nullable, created/updated timestamptz).
- Branch: `feat/telegram-config-crud` (not yet pushed to remote; will push with this SUBMIT commit).

Requesting PM C VERDICT.

##### VERDICT T17 — APPROVED (attempt 2, narrow-primitive) by PM C (H13)

**Scope**: T17 primitive-only per REJECT-PLAN §142 ("primitive shipped, unit-tested; endpoint reachability deferred"). Router + `api.ts` wiring + integration test correctly deferred behind Q-C-01/02/03.

**PM independent verification** (checked out `feat/telegram-config-crud` @ `98f098b` into local worktree, re-ran gate + drift scans):

- ✅ **REJECT Item #1 (masking fix)** — `telegram.service.ts:49` `decrypt(domain.botTokenEnc)` → `maskTokenForLog(plaintext)` at line 52 → `view.botToken`. Stable across encrypts of same plaintext. Round-trip test (`telegram.service.test.ts:275-276`) asserts `getView.botToken === upsertView.botToken === maskTokenForLog(BOT_TOKEN_PLAINTEXT)`. ✓
- ✅ **REJECT Item #2 (scope containment)** — verified via `git diff main..feat/telegram-config-crud --stat`: only `src/modules/telegram/**` + `PM-STATUS-C.md`. Zero touches to `src/core/prisma/prisma-client.ts`, `src/entrypoints/api.ts`, `src/plugins/**`, or `telegram.routes.ts`. ✓
- ✅ **REJECT Item #3 (Prisma-direct + ctor-inject)** — `telegram.repository.ts:17` `constructor(private readonly db: PrismaClient)`. Imports `PrismaClient` + `TelegramConfig` types from `@prisma/client` directly (no wrap-interface). ADR-0001 preserved. ✓
- ✅ **Quality gate (PM rerun)** — `make check` PASS: lint 0/0, format clean, typecheck strict clean, `test:unit` 108 passed / 12 of 14 suites (2 skipped = pre-existing integration suites, unchanged by T17). +22 new tests from T17. ✓
- ✅ **Drift scans (PM rerun, scope `src/modules/telegram/`)** — 0 `any`, 0 `console.log/info/debug`, 0 `throw new Error(`, 0 `default export`, 0 forbidden imports (express/typeorm/moment/node-fetch), 0 `.skip`. Hardcoded URLs = `example.com` + `localhost` in test fixtures + env-override for `resetConfigCache` (allowed exception per PM-AGENT §3 Step 2). ✓
- ✅ **Security floor (CLAUDE §6)** — AES-256-GCM via `crypto.encrypt` T03 (service.ts:37), no plaintext in DB write (repo receives `botTokenEnc` only), no plaintext/ciphertext in GET view (masked at service.ts:52), no plaintext in log line (`maskTokenForLog(input.botToken)` at service.ts:34; test `should log masked bot_token BEFORE encrypt (PII floor)` asserts `JSON.stringify(loggedPayload)` excludes plaintext). `ENCRYPTION_KEY` from `@core/config/env.js`, no hardcode. ✓
- ✅ **Spec alignment** — `telegram_configs` model (`prisma/schema.prisma:49-61`) matches spec §4.2 DDL fields 1:1; PUT accepts `{ bot_token, bot_username, default_chat_id?, gm_telegram_id?, webhook_url? }` per §2.1 row; GET returns view w/ masked token per MVP §5 L118 WA-parallel pattern. Zod schema `strict()` rejects unknown fields (`telegram.schema.test.ts:45-47`). ✓
- ✅ **File inventory vs SUBMIT §163-171** — all 8 files present, no unexpected files, coverage claim `100% stmt/branch/func/line` on module scope aligns with observed test counts (22 tests exercising every branch of get/upsert/toView/toDomain). ✓
- ✅ **Test naming** — `should <expected> when <condition>` pattern honored across all 22 tests. ✓

**Tolerated deviations (flagged, non-blocking)**:

1. **Repository unit test uses mock Prisma** (`telegram.repository.test.ts:29-36` `buildDbMock` cast `as unknown as PrismaClient`). CLAUDE §8 + PM-AGENT §3 Step 7 explicitly disallow mocking Prisma at unit-test tier ("pakai integration test dengan real DB"). **Tolerated here** because integration test is blocked on Q-C-01 (Prisma singleton `{}` placeholder) — executor cannot ship a real DB test yet. The mock test is legitimately verifying **call-shape translation** (`upsert` payload structure, `where` clause, `toDomain` mapping) rather than mocking business logic. **Required follow-up**: when Q-C-01 lands, executor must add `telegram.repository.integration.test.ts` (testcontainers per `docs/TESTING.md`) that exercises real Postgres round-trip. Mock unit test may remain (call-shape regression pressure) or be removed at executor discretion. Tracked in `Notes / open items` (§219-223 above) — no separate incident.
2. **Q-A-03 workaround reappears** (`telegram.service.test.ts:16-26` in-test `BASE_ENV` w/ `NODE_ENV: 'development'` + `resetConfigCache`) — same pattern PM A used for T03/T04. Confirms Q-A-03 (baseline test env in `shared/utils/test-setup.ts`) still needed as shared-infra follow-up; not slot-C's fix to make.

**T17 status**: `wip` → **approved (narrow primitive)**. Router / integration deliverable = separate follow-up task (T17-followup) after Q-C-01/02/03 resolved. Slot C row in §1 tracker + PARENT §1 updated.

**Next actions**:
- Executor C: push `feat/telegram-config-crud` to remote + open PR to `main` (CI must run). PM C will re-verify on green CI + auto-approve merge post-PR-CI-green. Meanwhile, executor C may pick a self-contained task from §8 that doesn't need router/JWT (all remaining C-tasks depend on foundation — parked pending Parent PM).
- PM C: post PARENT §2 roll-up + PARENT §1 status update. Q-C-01/02/03/04 remain open pending Parent PM/PO.
- Parent PM: please prioritize Q-C-01/02/03 — B (T10) + C (T18+) are otherwise blocked from any HTTP endpoint or repo integration test.

##### PR REVIEW T17 — PR #11 CI verdict by PM C (H14, 2026-07-05)

**PR**: [#11 `feat(telegram): T17 Telegram config CRUD primitive (C1)`](https://github.com/satriowicaksn/integration-backend-qooma-hotel-ai/pull/11), head `feat/telegram-config-crud` @ `d8def13` (rebase-merge w/ main resolved PM-STATUS-C.md conflict).

**CI status** (post-push, PM re-verified via `gh pr checks 11`):
- ✅ Lint + Typecheck — SUCCESS (41s)
- ✅ Unit tests — SUCCESS (27s)
- ✅ Integration tests — SUCCESS (39s)
- ❌ **Docker build (api/worker) — FAILURE (33s)** — `pnpm build` (tsc -p tsconfig.build.json) fails with `TS2305: Module '@prisma/client' has no exported member 'TelegramConfig'` AND `no exported member 'WaConfig'`.

**Root-cause analysis** (PM independent investigation):

1. **NOT a T17 code defect.** The failing imports (`TelegramConfig` in `telegram.repository.ts:4`, `WaConfig` in `whatsapp-config.repository.ts:10`) are correct Prisma-generated exports (schema.prisma models line 33 & 49). Locally `make check` green, CI unit + integration + lint + typecheck green — because those steps run `pnpm prisma:generate` before `tsc`.
2. **Dockerfile IS calling `pnpm prisma:generate`** at stage 2 line 25, and stage 3 (build) inherits from stage 2. Generator `output = "../node_modules/.prisma/client"` (schema.prisma:3) resolves to `/app/node_modules/.prisma/client`. In principle types should be visible to `tsc` in stage 3.
3. **Suspected pnpm-strict-hoisting × prisma-custom-output interaction**: `@prisma/client` package's re-export chain isn't picking up the generated `.prisma/client` types when pnpm's strict node_modules layout is used. Known upstream category (pnpm + prisma). Fix candidates: (a) remove custom `output` (use Prisma default `node_modules/@prisma/client/.prisma/client`), (b) add `.npmrc` `public-hoist-pattern[]=*prisma*`, (c) add explicit `RUN ln -s` in Dockerfile between stages, (d) hoist `.prisma/client` before build in Dockerfile.
4. **This bug already exists on `main` — pre-dates T17.** T10 (PM B / Nanak) merged **red** at 2026-07-04T16:28:09Z with the same Docker-build failure (verified via `gh pr view 10`). Main CI has been red since (`gh run list --branch main`: 2 red runs since T10 merge). T17's PR-11 red is inheriting + adding the same class of failure, NOT introducing it.
5. **Precedent conflict flagged for Parent PM**: `PM-AGENT.md §4` explicitly forbids "Merge tanpa lulus CI" — yet T10 was merged in that state. Either (a) T10 rollback for consistency, (b) fix Dockerfile as shared-infra follow-up before any further merges, or (c) Parent PM/PO ratifies that Docker-build check is non-blocking in current CI policy (least preferred).

**PM C verdict on PR #11**:

- **Code approval stands** — T17 code passes all applicable checks (lint, typecheck, unit, integration).
- **Merge decision escalated to Parent PM** — not a per-slot call. If T10 precedent is honored (Docker-build red is not a merge blocker for this batch until Dockerfile fix lands), PR #11 is merge-ready. If PM-AGENT §4 is enforced strictly, both PR #11 AND T10 need the Dockerfile fix first (and T10 should arguably be reverted). PM C does not unilaterally merge with red CI.
- **New Q raised**: **Q-C-05** — Dockerfile × pnpm × prisma custom-output; shared-infra bug affecting every slot with a `@prisma/client` type import. Mirrored to PARENT §3b (tooling).

**Files verified in PR #11 diff vs local review** (`gh pr view 11 --json files`):
- 8 files, 661 additions, 0 deletions — matches local `98f098b` inspection exactly (repository, service, schema, types, index, 3 test files).
- Second commit `d8def13` = clean rebase-merge with main (PM-STATUS-C.md conflict resolution only, no src/ change).
- Mergeable = MERGEABLE (no git conflicts on main).

**Awaiting Parent PM**: merge policy decision + Q-C-05 routing.


### ASSIGNMENT T19 — claimed by exec-C (Satrio) at H14 (2026-07-05) 12:15
- Branch: `feat/telegram-inbound-commands`
- Routed from: PM-STATUS-C.md §8 queue (self-select — no explicit ASSIGNMENT after T17 merge; per §0.3(B) self-select allowed)
- Dependency check per §1: T04 ✓ (webhook HMAC plugin merged in foundation), T05 ✓ (tenant-resolver merged in foundation), T17 ✓ (primitive merged PR #11 `0d89d76`). All deps met at primitive-scope.
- **Precedent**: Following PM C T17 REJECT-PLAN §100 + APPROVED §227 narrow-primitive pattern.

#### PLAN T19 — exec-C (Satrio) at H14 (2026-07-05) 12:15

**Scope recap**
Deliver C3 primitive per `docs/spec/04-integration-channels.md §3.2 Inbound` + `MVP-INTEGRATION-FIRST.md §1.3 (C3)` + `§5 L127 AC`: pure command parser for staff Telegram commands (`/take <ticket_id>`, `/release <ticket_id>`, `/done <ticket_id>`, `/help`), zod schema for Telegram webhook update body, service that maps parsed command → downstream RPC ports (dispatch to HC ticket action or `/help` reply), unit tests. **Consistent with T17 REJECT-PLAN §100 precedent**: primitive-only. Router (`telegram-inbound.routes.ts`), HMAC-guard wiring, RPC adapter impl, integration test — all deferred behind Q-C-01 (Prisma singleton), Q-C-02 (`api.ts` bootstrap), Q-C-03 (JWT / cross-service HC/AI RPC contract). External IO uses ADR-0001 port pattern (ctor-injected) so unit-testable with plain-object mocks.

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot C (Satrio) ✓
- CLAUDE.md loaded ✓
- Task spec read: `docs/spec/04-integration-channels.md §2.3 (webhook route), §3.2 (Inbound commands)`, `MVP-INTEGRATION-FIRST.md §1.3 (C3), §5 L127 AC`
- Parent docs spot-read: `CLAUDE.md §4 (ports for external IO), §5 error handling`, `docs/MODULE_TEMPLATE.md §1 (external IO subshape)`, T17 primitive at `src/modules/telegram/*` as pattern anchor
- Dependencies: T04 ✓ (deferred at HTTP boundary), T05 ✓ (deferred at HTTP boundary), T17 ✓ (primitive in module)
- `make typecheck` clean ✓ / `make lint` clean ✓ / `make test-unit` PASS (108 tests) — verified locally on `main @ 0d89d76`.
- Scaffolder risk: none — all new files under existing `src/modules/telegram/` (co-located with T17 config CRUD, same bounded context per spec §3.2).
- Known shared-infra RED: Q-C-05 (Docker-build failure, pre-dates T17, affects any `@prisma/client`-consuming module type-check via `tsc -p tsconfig.build.json`). This module does NOT import from `@prisma/client` (parser + service consume ports, not Prisma), so should NOT compound Q-C-05. Flagged so PM aware.

**Files to create**
```
src/modules/telegram/
├── telegram-inbound.commands.ts             (pure parser + command discriminated union types)
├── telegram-inbound.schema.ts               (zod TelegramUpdateSchema for webhook body per Telegram Bot API)
├── telegram-inbound.types.ts                (StaffIdentity + DispatchResult types)
├── telegram-inbound.service.ts              (orchestrator: parse → dispatch via ports; returns HelpReply | Ack | Ignored)
├── ports/
│   ├── staff-lookup.port.ts                 (external IO: RPC HC lookup staff by telegram_user_id)
│   └── ticket-action.port.ts                (external IO: RPC HC take/release/done actions)
└── __tests__/
    ├── telegram-inbound.commands.test.ts    (parser: valid + malformed + unknown + edge whitespace/case)
    ├── telegram-inbound.service.test.ts     (dispatch: happy path per command, staff-not-found → ignored, unknown → help, ports called correctly)
    └── telegram-inbound.schema.test.ts      (webhook body: minimal valid + rejects malformed)
```

**Files to modify**
- `src/modules/telegram/index.ts` — extend barrel to re-export new command parser + service + port types. No unrelated changes.

**Files NOT touched** (Q-C-01/02/03 authority; per T17 REJECT-PLAN Item #2)
- `src/entrypoints/api.ts` (still stub — Q-C-02)
- `src/core/prisma/prisma-client.ts` (still stub — Q-C-01)
- `src/plugins/hmac-validator.plugin.ts` (T04 primitive; wiring at route landing not part of T19 primitive)
- `src/modules/telegram/telegram-inbound.routes.ts` — omit; route landing is a post-foundation follow-up

**Approach**
1. `telegram-inbound.commands.ts` — pure `parseCommand(text: string): ParsedCommand` returning discriminated union: `{ kind: 'take'|'release'|'done', ticketId: string } | { kind: 'help' } | { kind: 'unknown', raw: string }`. Case-insensitive prefix, trims leading whitespace, extracts numeric ticket_id via regex per spec `/take 1234`. Ticket ID validated as non-empty digit string (min 1, max 20 chars — over-conservative for future ticket-id widening).
2. `telegram-inbound.schema.ts` — zod `TelegramUpdateSchema` mirroring Telegram Bot API "Update" object (`update_id`, optional `message` with `chat.id`, `from.id`, `text`). Strict `.strict()`? No — Telegram may add fields; use `.passthrough()` on top-level but strict on our extracted subset. Actually keep `.strict()` off since Telegram evolves; extract via zod `.pick`.
3. `staff-lookup.port.ts` — interface `StaffLookupPort { lookupByTelegramUserId(hotelId: string, telegramUserId: string): Promise<StaffIdentity | null> }`. `StaffIdentity = { staffId: string; deptId: string; role: 'staff'|'supervisor'|'gm' }`.
4. `ticket-action.port.ts` — interface `TicketActionPort { take(ticketId, staffId): Promise<TicketActionOutcome>; release(ticketId, staffId): Promise<TicketActionOutcome>; markDone(ticketId, staffId): Promise<TicketActionOutcome> }`. `TicketActionOutcome = { status: 'ok' } | { status: 'not_found' } | { status: 'forbidden' }`.
5. `telegram-inbound.service.ts` — `TelegramInboundService.handleUpdate(hotelId, update)` → parses `.message.text` via `parseCommand`, looks up staff via `StaffLookupPort` (if null → `{ kind: 'ignored', reason: 'staff_not_recognized' }` — never reveal user probe), dispatches via `TicketActionPort`, returns `DispatchResult = { kind: 'reply', text: string } | { kind: 'ignored', reason: string }`. `/help` returns canned help text; unknown returns `{ kind: 'ignored', reason: 'unknown_command' }`. Logger info line per handle w/ maskedTelegramId (using existing `maskTokenForLog` or new tiny masker inside service — I'll reuse `maskTokenForLog` to avoid new util; if PM prefers separate `maskTelegramId`, callable follow-up).
6. Unit tests: parser (~10 cases), service (~8 cases), schema (~4 cases). Zero mocking of Prisma or fastify. Ports mocked as plain jest.fn() per T17 pattern.

**GAPs / questions**
- **GAP T19-#1 — Help text content.** Spec §3.2 lists `/help` command but does not specify reply text. **My intent**: canned English (matching CRM tenor) — `"Available commands:\n/take <ticket_id> — assign ticket to you\n/release <ticket_id> — release your assignment\n/done <ticket_id> — mark ticket resolved\n/help — this message"`. If PM wants Indonesian or product-branded copy, easy tweak — 1 constant. Post as note, not blocker.
- **GAP T19-#2 — Staff-not-recognized behavior.** Spec §3.2 says "identify the staff Telegram user" but doesn't specify what happens when the sender isn't a registered staff. **My intent**: log + return `{ kind: 'ignored', reason: 'staff_not_recognized' }` (never reveal via bot reply — anti-enumeration). Alternative: bot replies "Unauthorized" (leaks that this bot exists). Preferred: silent ignore. Confirm.
- **GAP T19-#3 — Ticket ID format.** Spec examples show `1234` (numeric). Actual ticket IDs may be UUIDs (per data-model conventions). **My intent**: parser accepts `[A-Za-z0-9-]{1,64}` — permissive superset that covers both int shorthand + UUID. Service delegates validation to `TicketActionPort` (HC decides). Rejected-format returns `unknown`. Confirm range OK.
- **GAP T19-#4 — Cross-service RPC auth for HC calls (Q-C-03 dep).** Ports abstract the RPC; adapters land later when `internal-rpc-auth` client patterns exist (T09 gave the server-side guard, not client). **My intent**: port interfaces only in T19 primitive; adapter impl deferred to T19-followup (mirrors T17 pattern). No change from PM C precedent.

Awaiting PM C ACK — especially GAP-#2 (silent ignore vs "Unauthorized" reply, security posture).

##### exec-C SELF-PROCEED T19 — proceeding on narrow primitive (H15, 2026-07-06)
- No PM C ACK observed after H14 PLAN post (`6932b29`); user directive "continue to next T" received.
- Applying **PM C T17 REJECT-PLAN §125 precedent** ("Boleh langsung tanpa ACK tambahan (mengikuti PM A T04–T09 precedent)") to a T19 primitive that mirrors T17's shape: types + zod schema + service + ports + unit tests; NO router, NO api.ts touch, NO JWT/HMAC-wire, NO Prisma import.
- GAP defaults applied per "My intent" in PLAN: (#1) English canned help text at `HELP_TEXT` const, easily tweakable; (#2) staff-not-recognized = silent ignore, anti-enumeration + no bot reveal; (#3) ticket-id regex `^[A-Za-z0-9-]{1,64}$`; (#4) ports type-only, adapter deferred to T19-followup.
- If PM C wants a different GAP-#2 posture or copy tweak, easy 1-const edit → REJECT items should point at `telegram-inbound.service.ts:47-53` (silent-ignore branch) and `telegram-inbound.commands.ts:39-45` (HELP_TEXT). No cross-cutting fix required.

#### SUBMIT T19 — exec-C (Satrio) at H15 (2026-07-06) 09:30 (attempt 1, narrow primitive)

Task: T19 Telegram inbound command parser + intent dispatch primitive (spec §3.2 C3). Parser + zod webhook-update schema + service that maps parsed command → downstream RPC ports + unit tests. Router (`/webhook/telegram/:hotel_slug`), HMAC wire-through, HC/AI RPC adapters, integration test = all deferred to T19-followup behind Q-C-01/02/03.

Files changed: 9 (8 new, 1 modified; scope strictly `src/modules/telegram/**`)
  - src/modules/telegram/telegram-inbound.commands.ts (new — pure parser, `parseCommand`, HELP_TEXT)
  - src/modules/telegram/telegram-inbound.schema.ts (new — zod `TelegramUpdateSchema` + related sub-schemas, passthrough for Telegram evolutions)
  - src/modules/telegram/telegram-inbound.types.ts (new — `ParsedCommand`, `StaffIdentity`, `TicketActionOutcome`, `DispatchResult` unions)
  - src/modules/telegram/telegram-inbound.service.ts (new — `TelegramInboundService.handleUpdate`, guards → staff lookup → dispatch)
  - src/modules/telegram/ports/staff-lookup.port.ts (new — type-only port, StaffLookupPort)
  - src/modules/telegram/ports/ticket-action.port.ts (new — type-only port, TicketActionPort)
  - src/modules/telegram/__tests__/telegram-inbound.commands.test.ts (new — 18 tests: happy paths, help, unknown/malformed, edge cases)
  - src/modules/telegram/__tests__/telegram-inbound.schema.test.ts (new — 6 tests: minimal/full/passthrough/rejects)
  - src/modules/telegram/__tests__/telegram-inbound.service.test.ts (new — 17 tests: guards, staff identification, dispatch happy/edge, outcome reply variants, logging)
  - src/modules/telegram/index.ts (modified — barrel extended to re-export T19 surface; no unrelated changes)

Files NOT touched (per T17 REJECT-PLAN Item #2 precedent — foundation authority; blocked on Q-C-01/02/03)
  - src/entrypoints/api.ts (still stub — Q-C-02)
  - src/core/prisma/prisma-client.ts (still stub — Q-C-01; module doesn't import from `@prisma/client`, sidesteps Q-C-05 Docker-build failure entirely)
  - src/plugins/hmac-validator.plugin.ts (T04 primitive, route-level wiring deferred)
  - src/modules/telegram/telegram-inbound.routes.ts (omitted — post-foundation follow-up)

DoD self-check
- [x] **Spec §3.2 command surface** — `/take <id>`, `/release <id>`, `/done <id>`, `/help` all parsed + dispatched. Verified in `telegram-inbound.commands.test.ts` (3 kinds × happy + case + @suffix + whitespace).
- [x] **Anti-enumeration security posture (GAP #2)** — staff-not-recognized returns `{ kind: 'ignored', reason: 'staff_not_recognized' }`, no bot reply generated; test `should silent-ignore when staff not recognized (anti-enumeration)` asserts + verifies logged payload does NOT contain full Telegram user id (only 4-char suffix).
- [x] **Passthrough schema for Telegram evolutions** — `TelegramUpdateSchema.passthrough()` at top level tolerates future fields; test `should preserve unknown top-level fields (passthrough) so Telegram evolutions do not break intake` asserts.
- [x] **Rejection at wire boundary** — schema rejects missing `update_id`, wrong type, missing `chat.id` — asserted in schema tests.
- [x] **Port abstraction (ADR-0001)** — `StaffLookupPort` + `TicketActionPort` are type-only interfaces consumed via ctor injection; adapters deferred to T19-followup. Consistent with slot-B pattern (`hotel-core-*.port.ts`).
- [x] **PII floor on log lines** — `telegram_inbound.ignored` log for unrecognized sender masks user id (only last-4 suffix); `telegram_inbound.dispatch` log for recognized staff includes `staffId` (internal UUID, no PII).

Quality gate
- `make lint`: PASS (0 errors, 0 warnings)
- `make format-check`: PASS
- `make typecheck`: PASS (strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess)
- `make test-unit`: PASS (397 tests, 37 suites; +41 new for T19)
- `make check` (combined): **PASS**
- T19 module coverage (isolated to `telegram-inbound*.ts` + `ports/*.ts`): **100% stmts / 100% funcs / 100% lines / 92.85% branch avg** — one dead-code fallback branch in `parseCommand` (defensive `?? ''` after `.split('@')[0]` needed for `noUncheckedIndexedAccess`; unreachable at runtime given the earlier `startsWith('/')` guard).

Drift scans (scope `src/modules/telegram/telegram-inbound*.ts` + `src/modules/telegram/ports/`)
- `any` / `<any>` / `as any`: 0 hits
- `console.log|info|debug`: 0 hits
- `throw new Error(`: 0 hits
- forbidden imports (express/typeorm/moment/node-fetch): 0 hits
- default export: 0 hits
- `.skip(` in tests: 0 hits

Security check (spec §3.2 + §4.11)
- Anti-enumeration on unknown sender: ✅ silent-ignore + PII-suffix-only log
- No secret hardcoded / no PII in log: verified via test `should silent-ignore...` (`JSON.stringify(logged)` does not contain full telegram user id)
- Ports type-only → no accidental adapter shipping without Q-C-03 ratification
- HMAC verify at route boundary: N/A this attempt (deferred to router landing)
- Zod `.passthrough()` on top-level Update = intentional for forward-compat with Telegram API evolution; strict validation on the `chat.id` / `update_id` / `message.from.id` subset we consume.

Test evidence (unit only)
- Suites added: 3 (`commands`, `schema`, `service` — under `src/modules/telegram/__tests__/telegram-inbound.*.test.ts`)
- Tests added: 41 (18 parser + 6 schema + 17 service)
- Silent-ignore assertion + PII-floor log assertion in the same test (`should silent-ignore when staff not recognized`)
- All 3 outcome branches (`ok` / `not_found` / `forbidden`) × 3 command kinds covered via representative combinations

Notes / open items
- Router landing (`telegram-inbound.routes.ts` + HMAC wire + `POST /webhook/telegram/:hotel_slug` mount under `api.ts`) blocked on Q-C-01/02/03 — same as T17. Ready as T19-followup.
- HC RPC adapter impls (`http-hotel-core-staff-lookup.adapter.ts`, `http-hotel-core-ticket-action.adapter.ts`) blocked on Q-C-03 (HC internal-RPC client contract). Ports intentionally type-only per slot-B `hotel-core-*.port.ts` precedent (see PM B T12 GAP #3 → Q-B-04).
- AI service handover (spec §3.2 "RPC AI service (for handover)") — T19 primitive currently routes all ticket commands to `TicketActionPort` (HC). AI handover is a separate concern — worth clarifying with PM whether `/take` should first offer AI-handover reply per §3.2. Flagged as open note, not blocker.
- Branch: `feat/telegram-inbound-commands`; PR to be opened post-commit.

Requesting PM C VERDICT.

##### VERDICT T19 — APPROVED (attempt 1, narrow primitive) by PM C (H15, 2026-07-06)

**Scope**: T19 primitive per spec §3.2 (parser + zod webhook schema + dispatcher + type-only HC ports + unit tests). Router / HMAC wiring / `webhook_events` persistence / HC-RPC adapters / integration test correctly deferred to T19-followup. Mirrors T17 REJECT-PLAN §125 narrow-primitive pattern + slot-B `hotel-core-*.port.ts` type-only port precedent.

**PM independent verification** (checked out `origin/feat/telegram-inbound-commands @ 9c0bbc5`, ran gate + drift scans, restored to main after):

- ✅ **Quality gate** — `make check` PASS: lint 0/0, format clean, typecheck strict, `test:unit` **397 passed / 37 suites** (2 pre-existing skipped; +41 new for T19: 18 commands + 6 schema + 17 service). ✓
- ✅ **Drift scans** (scope `telegram-inbound*` + `ports/`) — 0 `any`, 0 `console.log/info/debug`, 0 `throw new Error(`, 0 default exports, 0 forbidden imports (express/typeorm/moment/node-fetch), 0 `.skip`. ✓
- ✅ **Scope containment** — verified via `git show --stat origin/feat/telegram-inbound-commands`: only `src/modules/telegram/telegram-inbound*` + `src/modules/telegram/ports/` + `index.ts` extended + `PM-STATUS-C.md`. Zero touches to `api.ts`, `prisma-client.ts`, `plugins/**`. Q-C-01/02/03 authority respected. ✓
- ✅ **No `@prisma/client` import** — grep confirmed; sidesteps Q-C-05 Docker-build failure entirely. Module is stateless (pure parser + dispatcher over ports), no repo persistence, so this is architecturally correct. ✓
- ✅ **Anti-enumeration security (GAP #2 default)** — `telegram-inbound.service.ts:44-53` returns `{ kind: 'ignored', reason: 'staff_not_recognized' }` on null lookup, no bot reply generated. Log line masks `telegramUserId` to last-4 suffix only (`telegramUserIdSuffix: telegramUserId.slice(-4)`). Test `should silent-ignore when staff not recognized (anti-enumeration)` asserts + verifies full ID not in logged payload. ✓
- ✅ **Port abstraction (ADR-0001)** — `StaffLookupPort` + `TicketActionPort` are type-only interfaces (16 + 22 LOC, zero runtime impl), consumed via ctor injection. Mirrors slot-B `hotel-core-*.port.ts` pattern exactly (verified via file listing on main). Adapters correctly deferred to T19-followup. ✓
- ✅ **Zod schema strategy** — `TelegramUpdateSchema.passthrough()` on top level (Telegram evolves), strict enough on the consumed subset (`update_id`, `message.chat.id`, `message.from.id`, `message.text`) to safely extract sender identity. Test asserts unknown fields preserved. ✓
- ✅ **Discriminated unions** — `ParsedCommand`, `TicketActionOutcome`, `DispatchResult` all use `kind`/`status` discriminants; exhaustive `switch` in `invokeAction` + `renderOutcomeReply` type-narrow correctly (no fallthrough). ✓
- ✅ **Spec §3.2 command surface** — `/take`, `/release`, `/done`, `/help` all parsed; unknown → help reply for recognized staff (defensive); `@bot_username` suffix stripped; case-insensitive; ticket-id regex `^[A-Za-z0-9-]{1,64}$` per GAP #3 (permissive; HC validates). ✓
- ✅ **Test naming** — `should <expected> when <condition>` pattern honored across all 41 tests. ✓
- ✅ **Coverage claim (100/100/100/92.85 branch)** — the 1 uncovered branch (`?? ''` fallback after `.split('@')[0]` for `noUncheckedIndexedAccess`) is a defensive TS-required fallback unreachable at runtime given the earlier `startsWith('/')` guard. Documented in SUBMIT §391. ✓

**Procedural note (tolerated, not faulted)**:

- Executor self-proceeded without PM C ACK, invoking T17 REJECT-PLAN §125 precedent + user directive "continue to next T". The §125 precedent was specifically written for T17-post-REJECT-PLAN, not a blanket rule for future new tasks. **Tolerated here** because: (a) PLAN posted at H14 12:15, SUBMIT at H15 09:30 gives ~21h ACK window, (b) T19 PLAN body was faithful to T17 narrow-primitive pattern with no shared-infra bundling, (c) all 4 GAPs had explicit "My intent" defaults which were reasonable, (d) user directive to continue counted as informal PO/PM authorization. **Going forward**: for new T## tasks, please post PLAN and wait for PM C ACK (or explicit user directive) before self-proceeding. Legitimate self-proceed windows are only those PM C has explicitly opened (like T17 §125).

**Items to register (PM C action, not blocking merge)**:

- **Q-C-06** — StaffLookupPort HC RPC contract (cross-service, HC-team + PO): spec §3.2 "identify the staff Telegram user" — no URL, path, payload, response shape defined. Sibling to Q-B-04/05. Port kept type-only in T19 per PM C precedent; adapter deferred to T19-followup. Mirrored to PARENT §3a below.
- **Q-C-07** — TicketActionPort HC RPC contract (cross-service, HC-team + PO): spec §3.2 "Hotel Core (for ticket status update)" — no URL/signature/response/error catalog for `take` / `release` / `markDone` / handoff to AI service. Sibling to Q-C-06 + Q-B-04. Port kept type-only. Adapter deferred.
- **Deferral acknowledged (not a new Q)** — `webhook_events` raw-payload persistence for Telegram inbound (spec §4.4 CHECK constraint permits `provider='telegram'`; slot-B T12 persists WA inbound to same table). Falls into T19-followup route-landing scope, not primitive. Q-B-06 (`webhook_events.external_id` for dedupe) still applies.
- **Spec §3.2 AI-handover** — spec mentions "RPC AI service (for handover)" as sibling to HC ticket update. T19 currently routes only command messages, all to HC. AI handover semantics (when? on non-command messages? on `/take` chain?) unclear — SUBMIT §417 flagged as open note. If PO wants AI handover in T19 primitive scope, we'd add an `AiHandoverPort` type-only and a routing branch. **PM C default**: keep AI handover out of primitive (spec says "staff commands" for §3.2; guest-side inbound is WA-only per §3.1). Confirm with Parent PM if wrong.

**Tolerated deviations (flagged, non-blocking)**:

1. **Q-A-03 test env workaround** did NOT reappear this task (no `loadConfig()` call in T19 code path — service is pure over ports, no env access). Improvement over T17.
2. **`AuthError` / `AppError` not thrown** — T19 primitive returns `DispatchResult` union, doesn't throw. Correct for a service that maps input → outcome; error semantics live in ports (adapters translate HTTP errors → `TicketActionOutcome.status`). At route boundary, `AuthError` would be raised by JWT/HMAC plugins (not this task's scope).

**T19 status**: `backlog` → **approved (narrow primitive)**. Router / integration deliverable = T19-followup after Q-C-01/02/03/06/07 resolved. Slot C progress: **2/9** (T17 + T19 primitives).

**Next actions**:
- Executor C: push `feat/telegram-inbound-commands` to remote (branch already pushed at `9c0bbc5` — verified via `git branch -a`), open PR to main (analog to PR #11 pattern; expect same 3/4 CI green + Docker-build red pending Q-C-05 fix). PM C will re-verify on PR CI + auto-note merge state per red-docker precedent.
- Executor C: pick next primitive from §8 queue — recommend **T24 (health probes, worker-side, zero HTTP surface, deps all merged)** or **T21 (OTA IMAP poller, also worker-side)**. Both continue the "primitive-then-router-followup" pattern.
- PM C: register Q-C-06 + Q-C-07 in §3 + mirror to PARENT §3a; update §1 T17→merged + T19→approved status; post PARENT §2 roll-up.


### ASSIGNMENT T## — claimed by exec-C (Satrio) at H{N} HH:MM
- Branch: feat/<modul>-<short>
- Routed from: PM-STATUS-PARENT.md §1 T## (Parent PM assigned)

#### PLAN T## — exec-C (Satrio) at H{N} HH:MM

**Scope recap**
- ...

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot C (Satrio) ✓
- CLAUDE.md loaded ✓
- Task spec read: <doc:section>
- Parent docs spot-read: <list>
- Dependencies: T## ✓
- `make typecheck` clean ✓ ; `make lint` clean ✓
- Scaffolder risk: none / <tool>

**Files to create**
```
src/modules/<name>/...
```

**Files to modify**
- src/entrypoints/api.ts — ...

**Approach**
<1 paragraf>

**GAPs / questions**
- (none) / GAP T##-#1 — ...

Awaiting PM C ACK.

##### PM C ACK — T## PLAN APPROVED, proceed to coding (H{N})
- (atau) PM C REJECT-PLAN — fix sebelum mulai: <list>

#### SUBMIT T## — exec-C (Satrio) at H{N} HH:MM (attempt 1)

Task: <title>
Files changed: <count>
  - ...

DoD self-check
- [x] ...

Quality gate
- `make check`: PASS
- ...

Drift scans
- ...

Security check
- ...

Test evidence
- Unit: <n>
- Integration: <n>

Notes
- ...

Requesting PM C VERDICT.

##### VERDICT T## — APPROVED (H{N}, revisi N) by PM C
- All DoD verified ✓
- Drift scans clean ✓
- `make check` PASS confirmed by PM rerun
- → §1 task tracker updated; row mirrored to PARENT §1
- → Short roll-up posted to PARENT §2

(atau)

##### VERDICT T## — REJECT (revisi N) by PM C

⛔ Items to fix:

**Item #1 — <kategori>** `src/.../<file>.ts:<line>`
- **Violation**: <pelanggaran>
- **Fix**: <satu kalimat fix-path>

**Item #2 — ...**
- ...

Re-run `make check` after fix, confirm pass, resubmit (attempt N+1).

(atau)

##### VERDICT T## — ESCALATE by PM C
- Reason: <gap planning / open Q PO>
- Escalated to Parent PM at H{N} HH:MM (will reach PO via PARENT §3)
- Executor C: pick task lain dari §8 sementara

-->

---

## 3. Slot C open questions (mirror to PARENT §3)

> PM C catat di sini ketika executor C raise `GAP` atau `BLOCKED`. Setelah resolve atau eskalasi ke Parent PM, update status. Parent PM consolidate ke `PM-STATUS-PARENT.md §3`.

| ID            | Question | Source         | Status | Resolution |
| ------------- | -------- | -------------- | ------ | ---------- |
| Q-C-01 | **Prisma client singleton wiring — foundation gap; affects B+C.** `src/core/prisma/prisma-client.ts:29` still `export const db = {} as unknown as Record<string, unknown>` placeholder. Not delivered by any T01-T09 (PM A explicit precedent: primitives shipped, wiring deferred to "assembly"). Blocks any repository / integration test in T10 (B) + T17-T25 (C). **Ask Parent PM**: (a) route as slot-A foundation follow-up (F10?), or (b) authorize slot-B/C to ship (1-line uncomment; dep already declared). Preferred (a) for ownership clarity. | PM C (Satrio) H13 | src/core/prisma/prisma-client.ts:11-29; T17 PLAN GAP-#1 | open | — |
| Q-C-02 | **`src/entrypoints/api.ts` bootstrap — foundation gap; affects all HTTP endpoints.** File still stub (line 38 `console.warn`). Fastify server + error-handler plugin (T08) + correlation-id + tenant-resolver (T05) + config load + graceful shutdown not wired. Blocks endpoint reachability for T10-T20 + T23. Q-A-05 (eslint async-hook `checksVoidReturn.properties: false`) recommended land **before** or bundled with this so all future async `preHandler`/hook code passes lint cleanly. **Ask Parent PM**: prioritize/assign api.ts bootstrap task (F11?). | PM C (Satrio) H13 | src/entrypoints/api.ts:11-45; T17 PLAN GAP-#2 | open | — |
| Q-C-03 | **Session/JWT auth plugin absent — cross-service contract Q; blocks all `gm_admin` CRUD (spec §2.1).** `src/plugins/` has hmac-validator + tenant-resolver + internal-rpc-auth + error-handler only. `env.ts:36-39` declares `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` but no plugin consumer. Auth service lives in separate repo (KICKOFF §1 L11); Integration verifies JWTs signed by Auth. Cross-service ratification needed: (a) verification method — JWKS URL fetch vs HS256 shared secret? (b) JWT payload shape — `{ sub, hotel_id, role, exp }`? (c) refresh-token flow — irrelevant to Integration (doesn't issue)? Preferred MVP: HS256 shared secret + `{ sub, hotel_id, role }` + verify-only plugin. Blocks T10 (B), T17 route (C), T18-T20, T23. **Ask Parent PM**: route to PO — cross-service contract. | PM C (Satrio) H13 | KICKOFF §1 L11; env.ts:36-39; src/plugins/*; T17 PLAN GAP-#3 | open | — |
| Q-C-04 | **Tenant identification for CRUD endpoints — cascading from Q-C-03.** Spec `/api/integrations/telegram` has no `:hotel_slug` in path (unlike webhook routes at `/webhooks/wa/:hotel_slug` spec §2.2). Alternatives: (a) JWT payload `hotel_id` (session-bound; preferred if Q-C-03 lands JWT); (b) header `X-Hotel-Id` (weak); (c) path rewrite `/api/hotels/:hotel_slug/...` (spec-drift). Locked to Q-C-03 outcome. | PM C (Satrio) H13 | spec §2.1 vs §2.2; T17 PLAN GAP-#4 | open | — |
| Q-C-05 | **Dockerfile × pnpm × Prisma custom-output — SHARED-INFRA BUG; main is currently RED.** Docker build fails on `pnpm build` (tsc -p tsconfig.build.json) with `TS2305: Module '@prisma/client' has no exported member 'TelegramConfig'` + `no exported member 'WaConfig'`. Locally + on CI unit/integration/lint/typecheck: green. Dockerfile stage 2 line 25 explicitly runs `pnpm prisma:generate`; schema.prisma:3 uses custom `output = "../node_modules/.prisma/client"`. Suspected pnpm strict-hoisting × prisma custom-output interaction (known upstream category). **T10 (PM B PR #10) merged RED with same failure at 2026-07-04T16:28:09Z**, meaning main has been red on Docker-build since T10 landed — this pre-dates T17. Precedent conflict with `PM-AGENT.md §4` "Merge tanpa lulus CI". PR #11 (T17) inherits + repeats same failure; not a T17 code defect. **Ask Parent PM**: (a) which fix candidate — remove custom output, add `.npmrc public-hoist-pattern`, or hoist step in Dockerfile? (b) route as slot-A shared-infra follow-up (F12?)? (c) merge-policy ratify for T10 + T17 pending fix (rollback T10 or waive Docker-build check batch-wide)? | PM C (Satrio) H14 (2026-07-05) | Dockerfile L22-32; prisma/schema.prisma:1-5; GH Actions run 28716832757 job Docker-build FAILURE | open | — |
| Q-C-06 | **StaffLookupPort HC RPC contract — cross-service, HC-team + PO.** Spec §3.2 "identify the staff Telegram user" — no URL, no path, no payload, no response shape, no error catalog for `lookupByTelegramUserId(hotelId, telegramUserId) → StaffIdentity \| null`. `docs/spec/02-hotel-core.md` does NOT exist in this repo. **Options**: A) narrow port `StaffLookupPort` type-only [T19 primitive default; adapter deferred to T19-followup]; B) hard-code assumed `POST /internal/hc/staff/lookup-by-telegram-id`; C) block T19-followup. Sibling to Q-B-04/05/08/09. Blocks T19-followup HC adapter. HC-team + PO ratify. | PM C (Satrio) H15 (2026-07-06) | spec §3.2 vs missing `02-hotel-core.md`; T19 PLAN GAP-#4 | open | — |
| Q-C-07 | **TicketActionPort HC RPC contract — cross-service, HC-team + PO.** Spec §3.2 "Hotel Core (for ticket status update)" — no URL/signature/response/error catalog for `take` / `release` / `markDone(hotelId, ticketId, staffId) → { ok \| not_found \| forbidden }`. Also unclear: is there a fourth action for AI handover (see AI-handover note in T19 VERDICT), or does that flow via a separate `AiHandoverPort`? Sibling to Q-C-06 + Q-B-04. Blocks T19-followup HC adapter. HC-team + AI-team + PO ratify. | PM C (Satrio) H15 (2026-07-06) | spec §3.2 vs missing `02-hotel-core.md`; T19 PLAN GAP-#4 | open | — |

---

## 4. Drift baseline (slot C files only, end of each day)

| Run | Touched files | `any` | console.log | `throw new Error(` | forbidden imports | default export (di luar entry) | `.skip` | hardcoded URL | webhook tanpa HMAC | wrap-Prisma interface |
| --- | ------------- | ----- | ----------- | ------------------ | ----------------- | ------------------------------ | ------- | ------------- | ------------------ | --------------------- |
| H12 baseline | (no src/ touched) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| H13 T17 a2 | 8 files in `src/modules/telegram/` | 0 | 0 | 0 | 0 | 0 | 0 | 0 (test fixtures only: `example.com` + `localhost` env-overrides — allowed) | n/a (no webhook this task) | 0 (Prisma-direct + ctor-inject, ADR-0001) |
| H15 T19 a1 | 9 files (8 new + index.ts) in `src/modules/telegram/telegram-inbound*` + `ports/` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | n/a (webhook route deferred) | 0 (module doesn't import `@prisma/client`; sidesteps Q-C-05) |

> PM C jalankan drift scan per `PM-AGENT.md §3 Step 2` setiap SUBMIT + end-of-day full scan untuk slot C's touched files.

---

## 5. Standup log slot C (latest di atas)

> PM C post daily standup di sini, lalu post 1-2 baris ringkas ke `PM-STATUS-PARENT.md §6` (yang Parent PM consolidate jadi cross-team report).
>
> Format: per `PM-AGENT.md §7`.

### H13 — 2026-07-04 (T17 primitive APPROVED attempt 2; foundation gaps escalated)

```
QOOMA INT C (Satrio) — Standup — H13/TBD

✅ Approved hari ini
- T17 primitive (types+zod+repo+service+22 unit tests, 100% module cov, make check green on PM rerun) — attempt 2 after REJECT-PLAN + narrow scope. Branch `feat/telegram-config-crud @ 98f098b`, PR push pending.

🔄 In progress
- (idle) — router+api.ts wiring for T17 blocked; awaiting Parent PM ratification on Q-C-01/02/03.

⛔ Rejected
- T17 PLAN attempt 1 (scope bundling shared-infra + broken masking design)

🚨 Eskalasi ke Parent PM
- Q-C-01 (Prisma singleton wiring — foundation gap, affects B+C)
- Q-C-02 (api.ts bootstrap — foundation gap, affects all HTTP)
- Q-C-03 (Session/JWT auth plugin — cross-service contract w/ Auth svc repo; needs PO ratification)
- Q-C-04 (Tenant-id source on CRUD endpoints; cascades Q-C-03)

📅 Gate status (global)
- Next gate: G1 — lihat PARENT §5. Foundation task list 9/9, but assembly (prisma+api+JWT) not yet primitive-shipped.

📈 Progress slot C
- 1 / 9 task approved (T17 primitive; router follow-up parked)
- Blocked: T18-T25 all await Q-C-01 at minimum; T19+ await Q-C-03 (JWT).

🎯 Fokus besok
- Executor: push PR for T17 primitive branch; then idle on foundation ratification. Optional: draft OTA-parser types (T21 has same Prisma dep but no HTTP surface — small forward progress possible).
- PM C: wait Parent PM verdict on Q-C-01/02/03; re-verify T17 PR on CI green.
```

### H12 — TBD (Satrio onboard, T17 assigned — skeleton-only sampai T02 land)

```
QOOMA INT C (Satrio) — Standup — H{N}/{total}

✅ Approved hari ini
- (none — belum start)

🔄 In progress
- (none)

⛔ Rejected
- (none)

🚨 Eskalasi ke Parent PM
- (none)

📅 Gate status (global)
- Next gate: G1 — lihat PARENT §5

📈 Progress slot C
- 0 / 9 task (T17 assigned · T18-T25 backlog)
- Blocked: impl T17 menunggu T02 (Nathan)

🎯 Fokus besok
- T17 spec reading + draft module skeleton (`src/modules/telegram/`) + draft types dari spec §4 DDL `telegram_configs`.
```

---

## 6. Slot C incidents / lessons (own-scope only)

> Hal yang affect cuma slot C. Bila affect > 1 dev, escalate ke `PM-STATUS-PARENT.md §7` lewat Parent PM.

_(kosong)_

---

## 7. PM C operating notes (untuk Executor C)

- PM C baca `PM-AGENT.md` (full) + `PM-STATUS-C.md` + scan `PM-STATUS-PARENT.md` (§1 mine, §3, §5, §8).
- PM C **TIDAK** edit `src/`, `prisma/schema.prisma` (kecuali typo non-semantik), `package.json` deps — read-only di area itu.
- PM C **BOLEH** update planning docs untuk sync (per `PM-AGENT.md §0.6`) — TAPI escalation ke Parent PM dulu bila perubahan affect dev lain. Tiap edit planning docs dicatat di `PM-STATUS-PARENT.md §4`.
- PM C **TIDAK** edit `PM-STATUS-A.md` / `PM-STATUS-B.md` — strict per-slot ownership.
- PM C **TIDAK** jawab open contract / package question — hanya PO via Parent PM.
- PM C **TIDAK** negosiasi scope. Descope adalah otoritas PO via Parent PM.
- On REJECT: fix exactly the listed items (file:line). Re-run `make check` self-validate. Resubmit per `EXECUTOR-PROTOCOL §4.5`, sebut item mana yang sudah di-address.
- Rebuttal: bila Executor C yakin PM C flag salah, post one-sentence rebuttal + evidence di sub-block `REBUTTAL T## item-#N`. PM C re-check dalam session yang sama.
- Untuk CLI command apapun yang touch root repo (scaffolder, generator, dll.): tulis exact command di PLAN supaya PM C bisa flag risiko overwrite sebelum executor run.
- Branch naming: `feat/<modul>-<short>`, `fix/<modul>-<short>`, `chore/<short>`, `docs/<short>` (per `CLAUDE.md §12`).
- Commit message: conventional commits — `feat(modul): X`, `fix(modul): Y`.
- Gunakan `make commit MSG="..."` — auto lint + typecheck + format-check sebelum commit.

---

## 8. Slot C queue (filter dari PARENT §1 di mana Slot=C)

> Parent PM authority untuk rewrite — PM C baca only. Executor C self-select dari §1 di atas bila tidak ada explicit ASSIGNMENT.

- **assigned** (claim langsung, spec read + skeleton OK; impl blocked on T02 + T03): T17
- **backlog** (after deps): T18, T19, T20, T21, T22, T23, T24, T25

<!-- Mirror format dari PM-STATUS-PARENT.md §1 template. -->

---

## 9. Roll-up reminder

Setiap kali PM C:

- **APPROVE** task → post 1 line ke `PM-STATUS-PARENT.md §2` (latest di atas) + update row status di PARENT §1
- **REJECT** task → tidak perlu PARENT roll-up (internal to slot C)
- **ESCALATE** task → post status `escalated` ke PARENT §1 + raise di PARENT §3 (Q register)
- **End-of-day** → post 3-line standup summary ke PARENT §6 di bawah Parent PM's daily roll-up block

Jangan paste full SUBMIT/VERDICT ke PARENT — itu tetap di sini.
