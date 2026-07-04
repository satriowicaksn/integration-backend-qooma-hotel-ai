# PM-STATUS-B — Qooma Integration · Dev B (Nanak)

> **Per-dev tracker untuk slot B (Nanak).** PM B + Executor B komunikasi **hanya** via file ini. Roll-up short summary ke `PM-STATUS-PARENT.md §2` setelah tiap VERDICT atau end-of-session.
>
> **PM A, PM C, Executor A, Executor C — JANGAN edit file ini.** File ini private ke slot B.
>
> **Identity check**: di response pertama session WAJIB confirm `Role: PM | Executor`, `Slot: B (Nanak)`. Bila user belum sebut slot — STOP, tanya dulu (lihat `KICKOFF.md §4`).
>
> Format block di §2 Active assignments **append-only** (lihat `EXECUTOR-PROTOCOL.md §0.5` & `PM-AGENT.md §0.4`).
>
> **Domain slot B (Integration)**: WhatsApp + outbound dispatch — `wa_configs` CRUD, verify-webhook action, WA inbound ingress (signature → persist → HC guest upsert → AI RPC), outbound WA dispatch (DND check + quota two-phase), retry queue, delivery receipts, WA template Meta relay. Spec routing: B1–B8 (`docs/spec/MVP-INTEGRATION-FIRST.md §1`).

---

## 0. Current focus (slot B)

- **Day**: H12+ (task tracker activated 2026-06-30)
- **Active task**: T10 (spec reading + module skeleton allowed; impl blocked sampai T02 APPROVE)
- **Branch**: —
- **Next gate (global)**: G1 — lihat `PM-STATUS-PARENT.md §5`
- **My queue (preview)**: T10–T16 (WA + dispatch) — lihat §8 di bawah
- **Critical dependency**: T02 (Nathan, Prisma migration) + T03 (encryption helper) WAJIB approved sebelum T10 impl. Sampai itu — boleh baca spec, draft module skeleton, draft types, draft handler stub. JANGAN `prisma generate` / hit DB / commit migration sendiri.

---

## 1. Task tracker (slot B — PM B authority)

> Mirror dari `PM-STATUS-PARENT.md §1` di mana Slot=B. PM B update status row di sini + push status update ke PARENT §1 setelah verdict.

| T## | Title                                                                            | Status   | Verified by PM | Notes                                                              |
| --- | -------------------------------------------------------------------------------- | -------- | -------------- | ------------------------------------------------------------------ |
| T10 | WA config CRUD (`GET, PUT /api/integrations/whatsapp`)                           | assigned | —              | Spec read + skeleton OK; impl blocked on T02 + T03                 |
| T11 | Verify webhook action (`POST /api/integrations/whatsapp/verify-webhook`)         | backlog  | —              | After T10                                                          |
| T12 | WA inbound webhook ingest (signature → persist → HC guest upsert → AI RPC)       | backlog  | —              | After T04 (Nathan) + T05 + T10                                     |
| T13 | Outbound WA dispatch RPC + DND check + quota two-phase                           | backlog  | —              | After T06 + T09 (Nathan); HC `check_and_reserve_outbound_quota` RPC|
| T14 | Outbound retry queue (3 attempts exponential backoff)                            | backlog  | —              | After T07 (Nathan) + T13                                           |
| T15 | Delivery receipts ingest (WA Cloud webhook stream)                               | backlog  | —              | After T04 + T12                                                    |
| T16 | WA template Meta relay (submit/resubmit/callback to HC)                          | backlog  | —              | After T06; HC internal `updateWaTemplateStatus` callback           |

---

## 2. Active assignments (append-only)

> **Executor B** append `ASSIGNMENT` block saat claim task. **PM B** append `ACK` / `VERDICT` sub-block di bawah block executor — JANGAN edit block lama.

### ASSIGNMENT T10 — claimed by exec-B (Nanak) at H16 21:46
- Branch: feat/whatsapp-config-crud (WIP on `main` — will branch before first commit)
- Routed from: PM-STATUS-PARENT.md §1 T10 (Parent PM assigned, mirrored to §1 above)

#### PLAN T10 — exec-B (Nanak) at H16 21:46

**Scope recap** (spec: `docs/spec/MVP-INTEGRATION-FIRST.md §1.2 B1` + `docs/spec/04-integration-channels.md §2.1 + §4.1`)

T10 = WA config CRUD → `GET /api/integrations/whatsapp` (returns config with `access_token` MASKED) + `PUT /api/integrations/whatsapp` (upserts `wa_configs` row, encrypts `access_token` via `shared/utils/crypto.ts` before persist). Roles: `gm_admin`. One `wa_configs` row per hotel (PK = `hotel_id`). Fields: `bsp` (default `1engage`), `phone_number_id`, `phone_number` (E.164), `access_token_enc`, `webhook_url`, `webhook_verify_token`, `verified_at` (nullable, set by T11 verify-webhook action — out of T10 scope), `created_at`, `updated_at`.

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot B (Nanak) ✓
- CLAUDE.md loaded ✓
- Task spec read: `docs/spec/MVP-INTEGRATION-FIRST.md §1/§4/§5` ✓ · `docs/spec/04-integration-channels.md §2.1/§4.1/§8/§9` ✓
- Parent docs spot-read: `docs/MODULE_TEMPLATE.md` ✓ · `src/modules/_template/*` ✓ · `src/shared/utils/crypto.ts` ✓ · `prisma/schema.prisma` (WaConfig model) ✓ · `src/entrypoints/api.ts` (stub) ✓ · `src/core/prisma/prisma-client.ts` (stub) ✓ · `src/plugins/*.ts` ✓ · existing `src/modules/whatsapp/*` (T17 BSP primitive) ✓
- Dependencies check:
  - T02 (Prisma init migration `20260703064249_init_integration_channels` + `WaConfig` model): LANDED on `main` ✓
  - T03 (encrypt/decrypt helper `src/shared/utils/crypto.ts` + tests): LANDED on `main` ✓
  - Foundation T01–T09 (per git log `6fdb110`): COMPLETE 9/9 on `main` ✓
- `make typecheck`: PASS (0 errors) — via Node 22 (nvm) + pnpm 9 ✓
- `make lint`: PASS (0 warnings) ✓
- Scaffolder risk: **none proposed** in this PLAN. Explicitly WILL NOT run `pnpm prisma generate` (PM-STATUS-B §0 blocks it) nor any `pnpm create` / `pnpm dlx` generator. NOT modifying `prisma/schema.prisma`, `prisma/migrations/*`, `package.json`.

**Files to create** (T10 scope — skeleton files under existing `src/modules/whatsapp/`)

```
src/modules/whatsapp/whatsapp-config.types.ts
src/modules/whatsapp/whatsapp-config.schema.ts
src/modules/whatsapp/whatsapp-config.service.ts
src/modules/whatsapp/whatsapp-config.repository.ts   (see GAP #2 — depends on Q-C-01)
src/modules/whatsapp/whatsapp-config.routes.ts
src/modules/whatsapp/__tests__/whatsapp-config.schema.test.ts
src/modules/whatsapp/__tests__/whatsapp-config.service.test.ts
```

**Files to modify**

- `src/modules/whatsapp/index.ts` — append new public exports (routes plugin + service factory + domain types). Preserve existing T17 BSP re-exports byte-for-byte.

**Files explicitly NOT touched in this task**

- `prisma/schema.prisma`, `prisma/migrations/*` — T02 Nathan's territory (WaConfig already correct)
- `src/entrypoints/api.ts` — stub (Q-C-02 pending); wiring instructions will be documented in PLAN §Approach but NOT committed
- `src/core/prisma/prisma-client.ts` — stub (Q-C-01 pending); repository will use `@prisma/client` PrismaClient type imported directly (types generated by `pnpm prisma generate` in CI/dev-machine; typecheck relies on `.prisma/client` folder locally which pnpm postinstall does NOT auto-run — see GAP #2)
- Auth/JWT plugin — MISSING (Q-C-03 pending); route handlers will read `request.hotelId` (already declared on `FastifyRequest` by existing `tenant-resolver.plugin.ts`) — an actual gm_admin session preHandler is deferred until Q-C-03 lands
- `src/modules/telegram/*` — slot C territory
- `src/modules/_template/*` — reference, do not edit (per KICKOFF/EXECUTOR-PROTOCOL)
- `src/modules/whatsapp/ports/whatsapp-bsp.port.ts`, `src/modules/whatsapp/adapters/1engage.adapter.ts`, `src/modules/whatsapp/__tests__/1engage.adapter.test.ts` — T17 Satrio's approved primitive, byte-for-byte preserved

**Approach**

Hexagonal Disiplin (per `CLAUDE.md §4` + ADR-0001): `wa_configs` is a **Prisma-owned table**, so **NO port/adapter** for the DB layer — repository uses `PrismaClient` directly. The only external IO in T10 scope is encryption at rest (a pure helper from `shared/utils/crypto.ts`, not a port). Structure:

1. **`whatsapp-config.types.ts`** — `WhatsappConfigDomain` (id fields, phone info, webhook fields, verifiedAt, timestamps) + `WhatsappConfigPersistenceInput` (fields service passes to repository — plaintext access_token here, repo encrypts). No `enum`; use `as const` if needed.
2. **`whatsapp-config.schema.ts`** — zod source of truth:
   - `WhatsappConfigResponseSchema` — GET response; `access_token` **masked** to `"***<last4>"` per §5 first AC; other fields as-is; camelCase over-the-wire (matches Prisma model field names).
   - `WhatsappConfigPutSchema` — PUT body: `bsp?` (defaults `1engage`), `phoneNumberId`, `phoneNumber` (E.164 regex), `accessToken` (plaintext, min length), `webhookUrl` (URL), `webhookVerifyToken` (min length). All strict-length per DDL §4.1.
3. **`whatsapp-config.repository.ts`** — class `WhatsappConfigRepository` with constructor `(db: PrismaClient)`. Methods: `findByHotelId(hotelId)` → `Prisma row | null`; `upsert(hotelId, encryptedInput)` → row. Returns Prisma model rows (not domain) — service does row→domain mapping. NO port interface (ADR-0001). See GAP #2 re: PrismaClient import when singleton still stubbed.
4. **`whatsapp-config.service.ts`** — class `WhatsappConfigService` with `(repo, cryptoDeps)` — cryptoDeps injected as narrow `{ encrypt, decrypt }` function pair (NOT a port — pure helpers) for unit-test mockability without spinning real crypto keys. Methods:
   - `getForHotel(hotelId)` — repo lookup → row→domain map → **masked** response projection (last 4 chars of `phone_number` + literal `"***"` for `access_token` — plaintext token NEVER leaves service in GET path).
   - `upsertForHotel(hotelId, dto)` — encrypt(dto.accessToken) → repo.upsert → row→domain → masked response.
   - Throws `NotFoundError` (from `@core/errors/app-errors`) for GET when no row (returns 404 per spec §9 / `WA_CONFIG_INVALID` on PUT validation covered by zod pre-handler).
5. **`whatsapp-config.routes.ts`** — thin Fastify plugin exposing `GET /whatsapp` + `PUT /whatsapp` (mounted with prefix `/api/integrations` at wiring time). Handlers read `hotelId = request.hotelId` (from `FastifyRequest` decoration; asserts non-null else throws `AuthError`), call service, return. zod-to-fastify via existing project pattern (or `fastify.setValidatorCompiler` — see GAP #3). preHandler for RBAC `gm_admin` = TODO comment referencing Q-C-03.
6. **`__tests__/whatsapp-config.schema.test.ts`** — unit: zod parse happy path + failure for each required field, mask projection golden test. Runs without DB.
7. **`__tests__/whatsapp-config.service.test.ts`** — unit: mock repo (in-memory), mock crypto `{ encrypt, decrypt }` (identity fn or reversible tag). Cases: GET happy, GET 404, PUT insert, PUT update, mask correctness (no plaintext leak in response). NO Prisma mock — repo is mocked at its class shape via a test double implementing the same methods (per CLAUDE.md §10 "Mock Prisma di unit test" antipattern — mocking OUR class is fine; forbidden is mocking `PrismaClient` itself). NO integration test in T10 skeleton (deferred until Q-C-01/02 land — see GAP #4).

**Wiring plan (deferred — will be committed together with T10 SUBMIT only if Q-C-02 lands during this task)**

Once `api.ts` bootstraps and `prisma-client.ts` exports `db`, the wiring is:
```ts
const waConfigRepo = new WhatsappConfigRepository(db);
const waConfigService = new WhatsappConfigService(waConfigRepo, { encrypt, decrypt });
fastify.decorate('services', { ...existing, whatsappConfig: waConfigService });
await fastify.register(whatsappConfigRoutes, { prefix: '/api/integrations' });
```
Documented in a `// WIRING SPEC` comment atop `whatsapp-config.routes.ts` so whoever lands Q-C-02 knows the incantation. **NOT** modifying `api.ts` in this task.

**GAPs / questions** (blocking PM B ACK before I write any code)

- **GAP T10-#1 — Scope expansion since PM-STATUS-B written**: current focus §0 says "impl blocked sampai T02 APPROVE + T03 APPROVE". Git log confirms both landed (T09 merge `6fdb110` closes foundation 9/9; T03 helper on `main`). **Question**: is T10 scope now the full CRUD impl + tests (my plan above), or still skeleton-only pending PARENT-level ratification of Q-C-01/02/03? Default I'm proposing: **full-impl minus wiring** — every file above created & tested, wiring left for Q-C-02 land. Confirm A) full-impl-minus-wiring (my default) B) skeleton files with only stub bodies (no crypto, no tests) C) hold until Q-C-01/02/03 all resolved.
- **GAP T10-#2 — Prisma client typing during Q-C-01 window**: `src/core/prisma/prisma-client.ts` is still stub (exports `{}` as `Record<string, unknown>`); `pnpm prisma generate` NOT run per PM-STATUS-B §0 explicit block. My repository code needs `import type { PrismaClient } from '@prisma/client';` to compile. Without prisma-generate, `@prisma/client` package resolves but `PrismaClient` shape has no models on it (default types until generate). **Question**: A) run `pnpm prisma generate` locally as a read-only codegen step (does NOT hit DB, does NOT modify `schema.prisma`, only writes `node_modules/.prisma/client/`) so my TypeScript compiles → I confirm this is a codegen not a scaffolder [my default; explicit PLAN request per §2 CRITICAL] · B) type repository against a hand-rolled minimal shape mirroring `WaConfig` fields (fragile — drifts from schema) · C) mark repository as `.ts` with `@ts-expect-error` blocks, add unit tests that don't compile-check the DB layer (ugly).
- **GAP T10-#3 — zod ↔ Fastify schema binding**: `_template.routes.ts` passes `ExampleRequestSchema` (a zod object) directly to Fastify's `schema.body`, but Fastify's native schema is JSON-Schema, not zod. There must be a validator-compiler shim in the boilerplate (fastify-type-provider-zod or manual). I don't see one wired. **Question**: A) use existing pattern from a registered route elsewhere (I didn't find any registered route yet — `api.ts` is stub) · B) add `fastify-type-provider-zod` (**PACKAGE ADD — requires PO approval per CLAUDE.md §11**) · C) hand-roll the JSON-Schema conversion inline in routes (verbose, error-prone) · D) skip route-level Fastify validation, validate manually via `MySchema.safeParse(request.body)` in the handler (works today, matches "thin route" but not idiomatic Fastify).
- **GAP T10-#4 — Integration test scope for T10**: `docs/TESTING.md` (per CLAUDE.md §8) says integration test for repository is WAJIB. But Q-C-01 blocks the singleton and no `make test-integration` harness has been exercised yet by any slot. **Question**: A) write integration test file with skeleton + `it.skip` (BUT drift rule §10 forbids `.skip` — so I'd need to write it disabled at describe level, still smells) · B) defer integration test to a follow-up T10-INTEG task after Q-C-01 lands · C) write integration test + attempt `make test-integration` — if harness is up (testcontainers Postgres per §8), we're good; if not, mark T10 SUBMIT with red integration status and eskalasi. Default: **B** — file a follow-up T10-INTEG scoped tightly.
- **GAP T10-#5 — File naming for a module holding multiple concerns**: `src/modules/whatsapp/` already holds T17's BSP outbound port/adapter. My T10 files will land there too. Later T11 (verify-webhook), T12 (inbound), T13 (dispatch service), T14 (retry queue), T15 (delivery receipts), T16 (template relay) all go here. **Question**: A) subject-prefixed files at module root: `whatsapp-config.*`, `whatsapp-webhook.*`, `whatsapp-dispatch.*` (my default — kebab-case, follows CLAUDE.md §5 naming) · B) sub-folder per concern: `src/modules/whatsapp/config/*.ts`, `whatsapp/webhook/*.ts` · C) single `whatsapp.routes.ts` / `whatsapp.service.ts` growing over time (will get unwieldy by T16).
- **GAP T10-#6 — hotel_id derivation for authenticated CRUD**: `tenant-resolver.plugin.ts` decorates `FastifyRequest.hotelId` but its `SlugResolver` is scoped to public webhook routes (derives from `:hotel_slug` path param). For `gm_admin` session CRUD (`/api/integrations/whatsapp`), `hotel_id` comes from JWT (Q-C-03 missing). **Question**: A) routes throw `AuthError('hotel_id not resolved')` if `request.hotelId` undefined — safe stub; real JWT preHandler lands with Q-C-03 (**my default**) · B) accept `hotel_id` as query/body param temporarily — dangerous, cross-tenant risk · C) hard-block T10 completion until Q-C-03 lands.

Awaiting PM B ACK on GAPs #1–#6 (esp. #1 scope + #2 codegen + #3 zod shim) before writing any code.

<!--
TEMPLATE — copy untuk task baru:

### ASSIGNMENT T## — claimed by exec-B (Nanak) at H{N} HH:MM
- Branch: feat/<modul>-<short>
- Routed from: PM-STATUS-PARENT.md §1 T## (Parent PM assigned)

#### PLAN T## — exec-B (Nanak) at H{N} HH:MM

**Scope recap**
- ...

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot B (Nanak) ✓
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

Awaiting PM B ACK.

##### PM B ACK — T## PLAN APPROVED, proceed to coding (H{N})
- (atau) PM B REJECT-PLAN — fix sebelum mulai: <list>

#### SUBMIT T## — exec-B (Nanak) at H{N} HH:MM (attempt 1)

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

Requesting PM B VERDICT.

##### VERDICT T## — APPROVED (H{N}, revisi N) by PM B
- All DoD verified ✓
- Drift scans clean ✓
- `make check` PASS confirmed by PM rerun
- → §1 task tracker updated; row mirrored to PARENT §1
- → Short roll-up posted to PARENT §2

(atau)

##### VERDICT T## — REJECT (revisi N) by PM B

⛔ Items to fix:

**Item #1 — <kategori>** `src/.../<file>.ts:<line>`
- **Violation**: <pelanggaran>
- **Fix**: <satu kalimat fix-path>

**Item #2 — ...**
- ...

Re-run `make check` after fix, confirm pass, resubmit (attempt N+1).

(atau)

##### VERDICT T## — ESCALATE by PM B
- Reason: <gap planning / open Q PO>
- Escalated to Parent PM at H{N} HH:MM (will reach PO via PARENT §3)
- Executor B: pick task lain dari §8 sementara

-->

---

## 3. Slot B open questions (mirror to PARENT §3)

> PM B catat di sini ketika executor B raise `GAP` atau `BLOCKED`. Setelah resolve atau eskalasi ke Parent PM, update status. Parent PM consolidate ke `PM-STATUS-PARENT.md §3`.

| ID            | Question | Source         | Status | Resolution |
| ------------- | -------- | -------------- | ------ | ---------- |
| —             | —        | —              | —      | —          |

---

## 4. Drift baseline (slot B files only, end of each day)

| Run | Touched files | `any` | console.log | `throw new Error(` | forbidden imports | default export (di luar entry) | `.skip` | hardcoded URL | webhook tanpa HMAC | wrap-Prisma interface |
| --- | ------------- | ----- | ----------- | ------------------ | ----------------- | ------------------------------ | ------- | ------------- | ------------------ | --------------------- |
| H12 baseline | (no src/ touched) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

> PM B jalankan drift scan per `PM-AGENT.md §3 Step 2` setiap SUBMIT + end-of-day full scan untuk slot B's touched files.

---

## 5. Standup log slot B (latest di atas)

> PM B post daily standup di sini, lalu post 1-2 baris ringkas ke `PM-STATUS-PARENT.md §6` (yang Parent PM consolidate jadi cross-team report).
>
> Format: per `PM-AGENT.md §7`.

### H12 — TBD (Nanak onboard, T10 assigned — skeleton-only sampai T02 land)

```
QOOMA INT B (Nanak) — Standup — H{N}/{total}

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

📈 Progress slot B
- 0 / 7 task (T10 assigned · T11-T16 backlog)
- Blocked: impl T10 menunggu T02 (Nathan)

🎯 Fokus besok
- T10 spec reading + draft module skeleton (`src/modules/whatsapp/`) + draft types dari spec §4 DDL `wa_configs`.
```

---

## 6. Slot B incidents / lessons (own-scope only)

> Hal yang affect cuma slot B. Bila affect > 1 dev, escalate ke `PM-STATUS-PARENT.md §7` lewat Parent PM.

_(kosong)_

---

## 7. PM B operating notes (untuk Executor B)

- PM B baca `PM-AGENT.md` (full) + `PM-STATUS-B.md` + scan `PM-STATUS-PARENT.md` (§1 mine, §3, §5, §8).
- PM B **TIDAK** edit `src/`, `prisma/schema.prisma` (kecuali typo non-semantik), `package.json` deps — read-only di area itu.
- PM B **BOLEH** update planning docs untuk sync (per `PM-AGENT.md §0.6`) — TAPI escalation ke Parent PM dulu bila perubahan affect dev lain. Tiap edit planning docs dicatat di `PM-STATUS-PARENT.md §4`.
- PM B **TIDAK** edit `PM-STATUS-A.md` / `PM-STATUS-C.md` — strict per-slot ownership.
- PM B **TIDAK** jawab open contract / package question — hanya PO via Parent PM.
- PM B **TIDAK** negosiasi scope. Descope adalah otoritas PO via Parent PM.
- On REJECT: fix exactly the listed items (file:line). Re-run `make check` self-validate. Resubmit per `EXECUTOR-PROTOCOL §4.5`, sebut item mana yang sudah di-address.
- Rebuttal: bila Executor B yakin PM B flag salah, post one-sentence rebuttal + evidence di sub-block `REBUTTAL T## item-#N`. PM B re-check dalam session yang sama.
- Untuk CLI command apapun yang touch root repo (scaffolder, generator, dll.): tulis exact command di PLAN supaya PM B bisa flag risiko overwrite sebelum executor run.
- Branch naming: `feat/<modul>-<short>`, `fix/<modul>-<short>`, `chore/<short>`, `docs/<short>` (per `CLAUDE.md §12`).
- Commit message: conventional commits — `feat(modul): X`, `fix(modul): Y`.
- Gunakan `make commit MSG="..."` — auto lint + typecheck + format-check sebelum commit.

---

## 8. Slot B queue (filter dari PARENT §1 di mana Slot=B)

> Parent PM authority untuk rewrite — PM B baca only. Executor B self-select dari §1 di atas bila tidak ada explicit ASSIGNMENT.

- **assigned** (claim langsung, spec read + skeleton OK; impl blocked on T02 + T03): T10
- **backlog** (after deps): T11, T12, T13, T14, T15, T16

<!-- Mirror format dari PM-STATUS-PARENT.md §1 template. -->

---

## 9. Roll-up reminder

Setiap kali PM B:

- **APPROVE** task → post 1 line ke `PM-STATUS-PARENT.md §2` (latest di atas) + update row status di PARENT §1
- **REJECT** task → tidak perlu PARENT roll-up (internal to slot B)
- **ESCALATE** task → post status `escalated` ke PARENT §1 + raise di PARENT §3 (Q register)
- **End-of-day** → post 3-line standup summary ke PARENT §6 di bawah Parent PM's daily roll-up block

Jangan paste full SUBMIT/VERDICT ke PARENT — itu tetap di sini.
