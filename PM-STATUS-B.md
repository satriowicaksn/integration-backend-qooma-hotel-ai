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
| T10 | WA config CRUD (`GET, PUT /api/integrations/whatsapp`)                           | approved (primitive) | PM B (H16, a2) | Primitive shipped: types+zod+Prisma-direct-ctor-inject repo+service (encrypt+decrypt-mask on view + PII-floor log BEFORE encrypt + round-trip mask stability) + 28 unit tests, 100% module cov, drift clean, make check green on PM rerun. Router+api.ts wiring = T10-followup blocked on Q-C-01/02/03. Branch `feat/whatsapp-config-crud @ 175faa5`, PR pending push |
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

##### PM B REJECT-PLAN — T10 PLAN attempt 1 (H16) by PM B (Nanak)

Not ACK. Two code/design defects (Item #2, #3) plus a scope-narrowing to match the Satrio T17-a2 precedent (Item #1). Attempt 2 = narrow **primitive** only — types + schema + repository + service + unit tests. NO `whatsapp-config.routes.ts`, NO `api.ts` touch, NO integration test in this attempt. Precedent: PARENT §2 L120 (`T17 primitive APPROVED (attempt 2) — narrow scope respected`). Same shape here.

⛔ **Items to fix**:

**Item #1 — Scope creep: routes.ts in a primitive** `src/modules/whatsapp/whatsapp-config.routes.ts` (PLAN §Files-to-create L76)
- **Violation**: Same class of bundling as `T17-a1` REJECT (PARENT §2 L119 "bundled 3 shared-infra edits + …"). Routes.ts requires either (a) `api.ts` wiring [Q-C-02 blocked], (b) `hotelId` derivation from session [Q-C-03 blocked], or (c) zod↔Fastify shim [GAP T10-#3 unresolved]. All three block a mergeable routes.ts in this window. T17-a2 approved shape (commit `98f098b`) shipped **without** `telegram.routes.ts` — same discipline here.
- **Fix**: Drop `whatsapp-config.routes.ts` from attempt 2. File it as **T10-followup** in your GAPs section for post-Q-C-01/02/03 landing. All other Files-to-create bullets stay. `src/modules/whatsapp/index.ts` barrel: append only the primitive exports (types, schema, repo class, service class) — no routes plugin export yet.

**Item #2 — Masking helper: roll-own drift from `@shared/utils/masking.ts`** (PLAN §Approach L100, §Approach L106)
- **Violation**: PLAN's `WhatsappConfigResponseSchema` masks `access_token` to `"***<last4>"`, but the existing helper `maskTokenForLog()` at `src/shared/utils/masking.ts:34` returns `"***<last3>"`. CLAUDE.md §6 (WAJIB) + `docs/SECURITY.md §5` mandate helper usage. Executor also proposed "literal `***`" alternative in the same bullet — ambiguous. T17-a2 approved shape (PARENT §2 L120 "masking = decrypt→maskTokenForLog on GET view (stable, round-trip test-verified)") is the mandated pattern.
- **Fix**: In `whatsapp-config.service.ts` GET path — `decrypt(row.accessTokenEnc)` → `maskTokenForLog(plaintext)`. Import from `@shared/utils/masking.js` + `@shared/utils/crypto.js` **directly** (see Item #3). Do NOT introduce a new mask format; do NOT mask the ciphertext. Add a unit test asserting mask is stable across two encrypt-decrypt round trips of the same plaintext (Satrio's `telegram.service.test.ts:*` has this — mirror it).

**Item #3 — Crypto injection: over-engineered vs ADR-0001** (PLAN §Approach L104 "cryptoDeps injected as narrow `{ encrypt, decrypt }` function pair")
- **Violation**: `encrypt`/`decrypt` from `shared/utils/crypto.ts` are pure helpers, NOT external IO. CLAUDE.md §4 "TIDAK perlu port (DILARANG bikin interface): Internal util → `import` langsung dari `@shared/utils/utils/...`" — you agreed in the same bullet ("NOT a port — pure helpers") but then still ctor-injected them. Satrio T17-a2 (approved) imports them directly. Injecting = "wrap-on-wrap" antipattern (CLAUDE.md §10).
- **Fix**: `whatsapp-config.service.ts` — `import { decrypt, encrypt } from '@shared/utils/crypto.js';` at top. Service ctor becomes `(repo: WhatsappConfigRepository, logger: Logger)` — see Item #4. Unit tests do NOT mock crypto — either use a real ephemeral key set via `test-setup.ts` (per Q-A-03 workaround) or exercise round-trip with a stable key. Reference: `src/modules/telegram/telegram.service.ts:5-6` on commit `98f098b`.

**Item #4 — Missing PII-floor log line + `Logger` dep** (PLAN §Approach absent)
- **Violation**: CLAUDE.md §6 #6 "TIDAK BOLEH log secrets" + `docs/SECURITY.md §5`. Satrio T17-a2 service has:
  ```ts
  this.logger.info({ msg: 'telegram_config.upsert', module: 'telegram', hotelId, botToken: maskTokenForLog(input.botToken), … });
  ```
  BEFORE `encrypt()` — and asserts via unit test that `JSON.stringify(loggedPayload)` excludes plaintext (PARENT §2 L120 "PII floor test asserts …"). PLAN §Approach lists no log line and no `Logger` ctor param. Under CLAUDE §6 security WAJIB, missing this pattern = REJECT.
- **Fix**: `whatsapp-config.service.ts` ctor accepts `logger: Logger` from `@core/logger/logger.js`. `upsertForHotel(hotelId, dto)` first line: `this.logger.info({ msg: 'whatsapp_config.upsert', module: 'whatsapp', hotelId, accessToken: maskTokenForLog(dto.accessToken), phoneNumber: maskWaPhone(dto.phoneNumber), phoneNumberId: dto.phoneNumberId, bsp: dto.bsp });`. Unit test asserts `JSON.stringify(logSpy.calls[0])` does NOT contain the plaintext `accessToken`. Same pattern for GET is optional (no plaintext enters GET path).

**Item #5 — Factual attribution error (nit, but fix in attempt 2)** (PLAN §Files-explicitly-NOT-touched L93)
- **Violation**: "T17 Satrio's approved primitive" refers to `src/modules/whatsapp/ports/whatsapp-bsp.port.ts` + `adapters/1engage.adapter.ts` — **wrong owner**. That module = **T06 Nathan (slot A)**, git `3c1274a`, merged PR #6, PARENT §1 T06 row. T17 = Satrio Telegram, on unmerged branch `98f098b` at `src/modules/telegram/*`.
- **Fix**: Attempt 2 PLAN — say "T06 Nathan's BSP port/adapter (merged `3c1274a`)". Preserves byte-for-byte still applies — same discipline, correct attribution.

---

**GAP decisions** (concrete A/B/C answers to PLAN GAPs #1–#6):

- **GAP T10-#1 (scope)** — **B** (skeleton primitive + tests, no wiring). Reasoning above (Item #1). Full-impl-minus-wiring is what Satrio proposed in T17-a1 and was REJECTed for; T17-a2 narrowed further to "primitive only, routes deferred". Same rule for T10-a2.

- **GAP T10-#2 (Prisma codegen)** — **A** (run `make prisma-generate` = `pnpm prisma:generate`). Authorized. Verified `Makefile:87-88` wires it as a first-class dev step (called by `install` / `setup` / `install-fresh` / `dev`). It's schema→client codegen, does NOT hit DB, does NOT modify `schema.prisma`, does NOT scaffold new files in `src/` — writes only to `node_modules/.prisma/client/`. Satrio T17-a2 imports `PrismaClient, TelegramConfig` from `@prisma/client` on `98f098b` and make check green — proves codegen was run there too. **Not** a CLAUDE §11 scaffolder; safe. Explicitly noted in your SUBMIT.

- **GAP T10-#3 (zod↔Fastify shim)** — **moot for attempt 2** (per Item #1 no routes.ts). When you file T10-followup after Q-C-02, the tentative direction is **D** (manual `Schema.safeParse(req.body)` in handler) — no package add (avoids PO gate per CLAUDE §11), keeps route thin. If Q-C-02 chooses to add `fastify-type-provider-zod`, that's a PO decision at that time. Do not decide it now.

- **GAP T10-#4 (integration test scope)** — **B** (defer to T10-INTEG follow-up after Q-C-01 lands). Same precedent as T17-a2 (PARENT §2 L120 "repo unit test mocks Prisma — accepted as stopgap because Q-C-01 blocks integration test; required follow-up when Q-C-01 lands"). PM B **tolerates this deviation** in attempt 2 SUBMIT — declare it explicitly, track as T10-INTEG follow-up in your SUBMIT §Notes. Do **not** write `it.skip` (drift rule §10 forbids). Do **not** use `describe.skip` either — just don't ship the integration file at all in this attempt.

- **GAP T10-#5 (file naming)** — **A** (subject-prefixed at module root): `whatsapp-config.types.ts`, `whatsapp-config.schema.ts`, `whatsapp-config.repository.ts`, `whatsapp-config.service.ts`. Reasoning: the WA module is already multi-concern (Nathan's BSP `ports/` + `adapters/` from T06). Satrio's `telegram.<layer>.ts` shorthand works because his module is single-concern for now; ours already has BSP siblings and will add webhook (T11/T12/T15), dispatch (T13), retry (T14), template-relay (T16). Sub-folders (B) fragment the barrel; single growing file (C) hits CLAUDE §rule-of-thumb 300 LOC by T14. Flat with `whatsapp-<concern>` prefix reads cleanly for T11-T16 follow-ups.

- **GAP T10-#6 (hotelId derivation)** — **moot for attempt 2** (routes.ts dropped per Item #1). When T10-followup files routes after Q-C-03, direction is **A** (routes throw `AuthError('hotel_id not resolved')` if `request.hotelId` undefined). Not decided now; belongs in T10-followup PLAN.

---

**Attempt 2 direction** (mirror T17-a2 shape):

Files to create (7):
```
src/modules/whatsapp/whatsapp-config.types.ts
src/modules/whatsapp/whatsapp-config.schema.ts
src/modules/whatsapp/whatsapp-config.repository.ts
src/modules/whatsapp/whatsapp-config.service.ts
src/modules/whatsapp/__tests__/whatsapp-config.schema.test.ts
src/modules/whatsapp/__tests__/whatsapp-config.repository.test.ts
src/modules/whatsapp/__tests__/whatsapp-config.service.test.ts
```

Files to modify (1):
```
src/modules/whatsapp/index.ts   — append primitive exports (types, schema, repo class, service class). Preserve T06 BSP re-exports byte-for-byte.
```

Files explicitly NOT touched: `prisma/schema.prisma`, `prisma/migrations/*`, `src/entrypoints/api.ts`, `src/core/prisma/prisma-client.ts`, `src/plugins/*`, `package.json`, `src/modules/whatsapp/ports/*`, `src/modules/whatsapp/adapters/*`, `src/modules/whatsapp/__tests__/1engage.adapter.test.ts` (T06 Nathan), `src/modules/telegram/*` (slot C), `src/modules/_template/*`.

Coding order (suggested): types → schema → repository (`import type { PrismaClient, WaConfig } from '@prisma/client'` after `make prisma-generate`) → service (imports `encrypt`, `decrypt`, `maskTokenForLog`, `maskWaPhone` directly; ctor takes `(repo, logger)`) → schema.test → repository.test (mocks Prisma-client double, tolerated per GAP T10-#4) → service.test (round-trip mask + PII-floor assertion) → barrel append → local `make check`.

Also acceptable in attempt 2 SUBMIT:
- Q-B-01 raise on Q-A-04 (WA `app_secret` missing from `wa_configs`) — flag as T12 blocker in your §3 mirror, do NOT try to solve in T10 scope.
- Note in SUBMIT §Notes: T10-followup (router + api.ts wiring + integration test) parked awaiting Q-C-01/02/03 (parallel to T17-followup).

After you address Items #1–#5 + follow GAP decisions above: rewrite the PLAN as attempt 2 (append new `#### PLAN T10 — exec-B (Nanak) at H16 HH:MM (attempt 2)` sub-block below this REJECT — do NOT edit attempt 1), then start coding. PM B will ACK the attempt 2 PLAN before code lands (per EXECUTOR-PROTOCOL §2 gate).

Re-run `make check` after implementation, self-verify drift scans (per `PM-AGENT.md §3 Step 2`), then SUBMIT.

#### PLAN T10 — exec-B (Nanak) at H16 22:18 (attempt 2)

**REJECT items addressed** (attempt 1 → attempt 2):

- **Item #1 (scope creep: routes.ts)** → **DROPPED** `whatsapp-config.routes.ts` from Files-to-create. Attempt 2 = narrow **primitive** matching T17-a2 shape (types + schema + repository + service + unit tests, no router). Routes filed as **T10-followup** parked for post-Q-C-01/02/03. Barrel `index.ts` appends primitive exports only — no routes plugin.
- **Item #2 (mask helper drift)** → GET path decrypts `row.accessTokenEnc` and applies `maskTokenForLog(plaintext)` from `@shared/utils/masking.js` — the mandated `***<last3>` format. NO roll-own `***<last4>` variant. Round-trip stability test added (`service.test.ts` — mask stable across two independent encrypt→decrypt cycles of the same plaintext).
- **Item #3 (crypto ctor-inject → ADR-0001 wrap-on-wrap)** → Service imports `encrypt`, `decrypt` **directly** from `@shared/utils/crypto.js`. Service ctor collapses to `(repo: WhatsappConfigRepository, logger: Logger)`. Unit tests use a real ephemeral `ENCRYPTION_KEY` (64-hex) + `ENCRYPTION_KEY_VERSION` seeded in test-setup (or `beforeAll` env override) — no crypto mock.
- **Item #4 (PII-floor log line missing + `Logger` dep)** → Service ctor accepts `logger: Logger` from `@core/logger/logger.js`. `upsertForHotel(hotelId, dto)` first line logs `{ msg: 'whatsapp_config.upsert', module: 'whatsapp', hotelId, bsp: dto.bsp, phoneNumberId: dto.phoneNumberId, phoneNumber: maskWaPhone(dto.phoneNumber), accessToken: maskTokenForLog(dto.accessToken), webhookUrl: dto.webhookUrl, webhookVerifyToken: maskTokenForLog(dto.webhookVerifyToken) }` **BEFORE** any `encrypt()` call. Unit test asserts `JSON.stringify(logSpy.mock.calls[0][0])` does NOT contain plaintext `dto.accessToken` NOR plaintext `dto.webhookVerifyToken` NOR the raw phone. (`webhook_verify_token` is `VARCHAR(80)` per DDL §4.1 and used by Meta for hub-challenge — treating as secret-adjacent; masking it in logs matches CLAUDE §6 spirit.)
- **Item #5 (attribution: T06 Nathan not T17 Satrio)** → §Files-explicitly-NOT-touched (attempt 2) says "T06 Nathan's BSP port/adapter (merged `3c1274a`, PR #6)". T17 = Satrio Telegram, unmerged at `98f098b`, out-of-scope for slot B.

**GAP decisions applied** (per PM B verdict):

- **#1** → **B** skeleton primitive (types+schema+repo+service+tests), no routes/wiring/integration.
- **#2** → **A** authorized to run `make prisma-generate` (`pnpm prisma:generate`) as prerequisite codegen — safe (writes only `node_modules/.prisma/client/`, no `schema.prisma` mutation, no DB hit, no `src/` scaffold). Verified `Makefile:87` + `package.json:28`. Will run **before** first typecheck; called out again in SUBMIT.
- **#3** → **moot** (routes deferred).
- **#4** → **B** defer integration test → **T10-INTEG** follow-up parked after Q-C-01. Attempt 2 repository unit test mocks Prisma client as a minimal test-double (call-shape verification), tolerated per T17-a2 stopgap precedent. No `it.skip` / `describe.skip`.
- **#5** → **A** subject-prefixed at module root: `whatsapp-config.<layer>.ts`.
- **#6** → **moot** (routes deferred).

**Scope recap** (unchanged from attempt 1)

T10 primitive = types + zod schemas + Prisma-backed repository + service (crypto + logger + masking) + unit tests for the WA config CRUD contract. Public API surface exposed via `index.ts` barrel is the shape that a future T10-followup (routes + `api.ts` wiring) will consume once Q-C-01/02/03 land. Spec refs unchanged: `MVP-INTEGRATION-FIRST.md §1.2 B1` + `04-integration-channels.md §2.1 + §4.1 + §9`.

**Session-start gate** (EXECUTOR-PROTOCOL §2 — re-verified for attempt 2)

- Identity confirmed: Executor, Slot B (Nanak) ✓
- CLAUDE.md loaded ✓
- Task spec re-read: `MVP-INTEGRATION-FIRST.md §1.2/§4/§5` · `04-integration-channels.md §2.1/§4.1/§8/§9` ✓
- PM B REJECT block read + digested (all 5 Items + 6 GAP decisions) ✓
- Parent docs / helpers spot-verified:
  - `src/shared/utils/masking.ts:34` — `maskTokenForLog(token)` returns `***<last3>` ✓
  - `src/shared/utils/masking.ts:13` — `maskWaPhone(phone)` returns `+628****<last4>` shape ✓
  - `src/shared/utils/crypto.ts` — `encrypt/decrypt/CryptoError` public API confirmed ✓
  - `src/core/logger/logger.ts` — `Logger` type + `createLogger` factory (boilerplate stub returns no-op fns; unit tests will inject spy `Logger` — construct via `{ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }`) ✓
  - `prisma/schema.prisma` — `WaConfig` model matches spec §4.1 DDL byte-for-byte ✓
  - `Makefile:87` + `package.json:28` — `make prisma-generate` wired ✓
- `make typecheck`: PASS on `main` (Node 22 nvm + pnpm 9 corepack) ✓
- `make lint`: PASS on `main` ✓
- Scaffolder risk: **one authorized codegen** — `make prisma-generate` (writes only `node_modules/.prisma/client/`, per GAP T10-#2 A). NO other generators. NO scaffolders. NO `pnpm add`.

**Files to create** (7 — mirrors PM B attempt-2 direction verbatim)

```
src/modules/whatsapp/whatsapp-config.types.ts
src/modules/whatsapp/whatsapp-config.schema.ts
src/modules/whatsapp/whatsapp-config.repository.ts
src/modules/whatsapp/whatsapp-config.service.ts
src/modules/whatsapp/__tests__/whatsapp-config.schema.test.ts
src/modules/whatsapp/__tests__/whatsapp-config.repository.test.ts
src/modules/whatsapp/__tests__/whatsapp-config.service.test.ts
```

**Files to modify** (1)

- `src/modules/whatsapp/index.ts` — append primitive exports (types + service class + repository class + zod schemas). **Preserve** existing T06 BSP re-exports byte-for-byte (`BspCredentials`, `BspSendResult`, `SendTemplateInput`, `SendTextInput`, `WhatsappBspPort` from `./ports/whatsapp-bsp.port.js`).

**Files explicitly NOT touched in this attempt**

- `prisma/schema.prisma`, `prisma/migrations/*` — T02/T06 territory
- `src/entrypoints/api.ts` — stub (Q-C-02); no wiring
- `src/core/prisma/prisma-client.ts` — stub (Q-C-01); repository imports `PrismaClient` type directly from `@prisma/client` (after `make prisma-generate`)
- Auth/JWT plugin — MISSING (Q-C-03); moot since routes deferred
- `src/modules/whatsapp/ports/whatsapp-bsp.port.ts`, `src/modules/whatsapp/adapters/1engage.adapter.ts`, `src/modules/whatsapp/__tests__/1engage.adapter.test.ts` — **T06 Nathan's** merged BSP primitive (`3c1274a`, PR #6), byte-for-byte preserved
- `src/modules/telegram/*` — slot C territory
- `src/modules/_template/*` — reference, do not edit
- `src/plugins/*` — foundation, out of slot B scope
- `package.json` / `pnpm-lock.yaml` — no dep add

**Approach** (post-REJECT, T17-a2 discipline)

Coding order per PM B direction:

1. **`make prisma-generate`** (authorized codegen) — writes `node_modules/.prisma/client/`. Verify by re-running `make typecheck` on `main` — must remain PASS.

2. **`whatsapp-config.types.ts`** — domain types with camelCase (matches Prisma model field names):
   ```
   WhatsappConfigDomain = { hotelId, bsp, phoneNumberId, phoneNumber, accessTokenMasked, webhookUrl, webhookVerifyTokenMasked, verifiedAt: Date | null, createdAt, updatedAt }
   WhatsappConfigUpsertInput = { bsp?, phoneNumberId, phoneNumber, accessToken /* plaintext */, webhookUrl, webhookVerifyToken /* plaintext */ }
   ```
   No `any`, no numeric enum, no `interface` for internal shape (use `type` per CLAUDE §5). Public types re-exported through barrel.

3. **`whatsapp-config.schema.ts`** — zod source of truth for the future wire contract (routes will parse against these):
   - `WhatsappConfigPutSchema` — `{ bsp?: z.enum(['1engage']).default('1engage'), phoneNumberId: z.string().min(1).max(80), phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/), accessToken: z.string().min(1), webhookUrl: z.string().url().max(500), webhookVerifyToken: z.string().min(1).max(80) }` — strict-length per DDL §4.1.
   - `WhatsappConfigResponseSchema` — `{ hotelId, bsp, phoneNumberId, phoneNumber, accessToken /* masked string */, webhookUrl, webhookVerifyToken /* masked string */, verifiedAt, createdAt, updatedAt }` (all camelCase over-the-wire).
   - Exported inferred DTOs (`WhatsappConfigPutDto`, `WhatsappConfigResponseDto`).

4. **`whatsapp-config.repository.ts`** — class `WhatsappConfigRepository(private readonly db: PrismaClient)`. NO port interface (ADR-0001 direct Prisma). Methods:
   - `findByHotelId(hotelId: string): Promise<WaConfig | null>` — returns raw Prisma row (ciphertext `accessTokenEnc` intact).
   - `upsert(hotelId: string, encryptedInput: { bsp, phoneNumberId, phoneNumber, accessTokenEnc, webhookUrl, webhookVerifyToken }): Promise<WaConfig>` — Prisma `.upsert({ where: { hotelId }, update: {...encryptedInput}, create: {...encryptedInput, hotelId} })`. `updatedAt`/`createdAt` handled by `@updatedAt`/`@default(now())`.
   - Import: `import type { PrismaClient, WaConfig } from '@prisma/client';`. NO domain mapping in repo (service maps).

5. **`whatsapp-config.service.ts`** — direct imports:
   ```
   import { decrypt, encrypt } from '@shared/utils/crypto.js';
   import { maskTokenForLog, maskWaPhone } from '@shared/utils/masking.js';
   import { NotFoundError } from '@core/errors/app-errors.js';
   import type { Logger } from '@core/logger/logger.js';
   ```
   Class `WhatsappConfigService(private readonly repo: WhatsappConfigRepository, private readonly logger: Logger)`. Methods:
   - `getForHotel(hotelId)` — `repo.findByHotelId` → null → throw `NotFoundError('WaConfig', hotelId)`; else `decrypt(row.accessTokenEnc)` → `maskTokenForLog(plaintext)` → project domain response with `accessToken: masked`, `webhookVerifyToken: maskTokenForLog(row.webhookVerifyToken)`. No plaintext leaves.
   - `upsertForHotel(hotelId, dto: WhatsappConfigUpsertInput)` — **first line** is PII-floor log (see Item #4 fix above). Then `encrypt(dto.accessToken)` → `repo.upsert(hotelId, { …, accessTokenEnc, webhookVerifyToken: dto.webhookVerifyToken /* plaintext at rest per DDL — Meta uses it for hub-challenge, not enciphered per schema */ })` → row → same masked projection as GET.
   - **Note on `webhookVerifyToken`**: schema DDL §4.1 stores it plaintext (`VARCHAR(80)`, no `_enc` suffix). Encrypting would drift from schema. Repository writes plaintext to DB; service masks in log + response only. Documented in a 1-liner comment in service.

6. **`whatsapp-config.schema.test.ts`** — zod parse: happy path for `WhatsappConfigPutSchema`, failure for each required-field-missing + each length/regex violation (E.164, URL, VARCHAR bounds). Golden test for `WhatsappConfigResponseSchema` mask projection shape.

7. **`whatsapp-config.repository.test.ts`** — mock Prisma via minimal test-double (`{ waConfig: { findUnique: jest.fn(), upsert: jest.fn() } as unknown as PrismaClient`). Assert:
   - `findByHotelId(id)` calls `db.waConfig.findUnique({ where: { hotelId: id } })` and returns its result.
   - `upsert(id, input)` calls `db.waConfig.upsert` with `where: { hotelId }`, `create: { …input, hotelId }`, `update: input`.
   - 3 tests (match T17-a2 shape).
   - **Stopgap declaration** in test file docstring (per GAP #4 B): "Prisma-client mock accepted as stopgap — integration test parked as **T10-INTEG** pending Q-C-01 singleton land."

8. **`whatsapp-config.service.test.ts`** — real crypto (ephemeral 64-hex key set via `process.env.ENCRYPTION_KEY` + `ENCRYPTION_KEY_VERSION` in `beforeAll` — matches `crypto.test.ts` shape). Test double for repository (Jest class mock). Spy `Logger` (`{ info: jest.fn(), … }`). Cases:
   - `getForHotel` happy path — decrypt succeeds, `accessToken` field in response = `maskTokenForLog(plaintext)` shape (`***<last3>`).
   - `getForHotel` — `NotFoundError` when repo returns null.
   - `upsertForHotel` — encrypts before repo call; verify `repo.upsert.mock.calls[0][1].accessTokenEnc` starts with `1:` (envelope version prefix per crypto.ts:52) and is round-trip decryptable to the original plaintext.
   - **PII-floor test** (Item #4 gate): `expect(JSON.stringify(logSpy.info.mock.calls[0][0])).not.toContain(inputAccessToken); .not.toContain(inputWebhookVerifyToken); .not.toContain(rawPhoneNumber);` — asserts NO plaintext leak in the log payload.
   - **Round-trip mask stability** (Item #2 gate): two independent encrypt→decrypt→mask cycles of same plaintext yield identical masked value.

9. **`src/modules/whatsapp/index.ts`** — append:
   ```
   export { WhatsappConfigRepository } from './whatsapp-config.repository.js';
   export { WhatsappConfigService } from './whatsapp-config.service.js';
   export {
     WhatsappConfigPutSchema,
     WhatsappConfigResponseSchema,
   } from './whatsapp-config.schema.js';
   export type {
     WhatsappConfigPutDto,
     WhatsappConfigResponseDto,
   } from './whatsapp-config.schema.js';
   export type {
     WhatsappConfigDomain,
     WhatsappConfigUpsertInput,
   } from './whatsapp-config.types.js';
   ```
   Preserve existing T06 BSP `export type { … } from './ports/whatsapp-bsp.port.js';` block byte-for-byte at top.

10. **`make check`** locally (typecheck + lint + format-check + unit tests) — must be green. Drift scans per EXECUTOR-PROTOCOL §4.4 — all 0. Then SUBMIT.

**Deferred (out of attempt 2 scope, tracked as follow-ups)**

- **T10-followup** (routes + `api.ts` wiring + `hotelId` derivation) — awaits Q-C-01 (prisma singleton) + Q-C-02 (`api.ts` bootstrap) + Q-C-03 (JWT/gm_admin session plugin). Filed as a new task after PM B ACK.
- **T10-INTEG** — real-DB integration test for repository (testcontainers Postgres per CLAUDE §8). Awaits Q-C-01 landing.
- **Q-B-01 candidate** — WA `app_secret` field appears in spec §4.11 (HMAC verify for webhook) but is absent from `wa_configs` DDL §4.1. This blocks T12 (inbound webhook signature verification), NOT T10. Will raise formally in SUBMIT §Notes per PM B direction ("do NOT try to solve in T10 scope").

**GAPs / questions** (none new for attempt 2)

- None. All 6 attempt-1 GAPs answered by PM B verdict block above.

Awaiting PM B ACK on attempt 2 PLAN before touching `src/`. Will run `make prisma-generate` immediately after ACK, then code per §Approach ordering.

##### PM B ACK — T10 PLAN attempt 2 APPROVED, proceed to coding (H16) by PM B (Nanak)

All 5 REJECT items independently verified in text; all 6 GAP decisions applied per PM B verdict; scope collapses cleanly to T17-a2 shape. **T10 PLAN attempt 2 APPROVED — proceed to coding.**

**Verification trace** (what I checked in your attempt-2 text before ACK — not just claim, but evidence):

- **Item #1 (routes.ts dropped)**: Files-to-create L253-262 lists exactly 7 files, none is a routes plugin. Barrel append L332-346 exports classes/types/schemas only — no `WhatsappConfigRoutes` / plugin symbol. §Files-explicitly-NOT-touched L271 confirms `api.ts` untouched. ✓
- **Item #2 (mask helper + round-trip)**: L217 statement + L311 service `getForHotel` explicit chain `decrypt(row.accessTokenEnc)` → `maskTokenForLog(plaintext)` (`***<last3>`) + L328 round-trip stability test spec. Directly imports from `@shared/utils/masking.js` per L306. No roll-own format. ✓
- **Item #3 (direct crypto import)**: L305 `import { decrypt, encrypt } from '@shared/utils/crypto.js'`. Ctor L310 `(repo, logger)` — cryptoDeps gone. Unit test uses real crypto with ephemeral key from env (L323, mirrors `crypto.test.ts`). Mirrors Satrio's `telegram.service.ts:5-6` on `98f098b`. ✓
- **Item #4 (PII-floor log line + Logger dep)**: L308 `import type { Logger } from '@core/logger/logger.js'`. L310 ctor accepts. L312 upsertForHotel first line = log. L327 test asserts JSON.stringify excludes plaintext `accessToken`, `webhookVerifyToken`, raw `phoneNumber`. Log fires BEFORE `encrypt()` per L219 explicit. Matches T17-a2 pattern verbatim. ✓
- **Item #5 (attribution)**: L220 + L274 both say "T06 Nathan's BSP port/adapter (merged `3c1274a`, PR #6)". Correct. ✓

GAP decisions L224-229: #1 B, #2 A, #3 moot, #4 B (stopgap declared, T10-INTEG follow-up), #5 A, #6 moot — 6/6 match PM B verdict. ✓

Scope + file inventory: 7-create + 1-modify + explicit NOT-touched list = mirror of PM B direction verbatim. `api.ts` / `prisma-client.ts` / `plugins/*` / `package.json` / T06 BSP / T17 Telegram / `_template` all off-limits. ✓

Coding order (§Approach 1-10): codegen → types → schema → repo → service → schema.test → repo.test → service.test → barrel → `make check`. Respects layering (types-first, tests reference concrete implementations). T17-a2 shape ✓.

---

**Binding conditions for SUBMIT** (PM B will independent-verify these on rerun — mirrors PM A T02/T03 + PM C T17-a2 rigor):

**Quality gate**
1. `make check` PASS on your push — PM B will rerun independently. Zero test failures, zero lint warnings, zero typecheck errors.
2. Drift scans per `PM-AGENT.md §3 Step 2` — all 14 categories = 0 hits on touched files: `any`, `console.log/info/debug`, `throw new Error(`, default export outside entrypoints, forbidden HTTP/ORM/time/fetch imports, package-lock/yarn.lock, hardcoded secrets/URLs, webhook w/o HMAC (N/A here — no routes), `setTimeout` delay (N/A), cross-module internal import, wrap-Prisma interface (N/A — direct Prisma), migrations w/o descriptive name (N/A), logger w/o correlationId in request scope (N/A — no handler), `.skip` / `describe.skip`.
3. Coverage: **100% stmt/branch/func/line** on `src/modules/whatsapp/whatsapp-config.*` (mirror T17-a2 attained per PARENT §2 L120). Report coverage delta in SUBMIT.

**Design gate (each MUST be present in SUBMIT + provable via test evidence)**
4. **PII-floor log test present** — `service.test.ts` asserts `JSON.stringify(logSpy.info.mock.calls[0][0])` does NOT contain plaintext `accessToken`, plaintext `webhookVerifyToken`, or raw `phoneNumber` string. Fail-open would be catastrophic; test is non-negotiable.
5. **Round-trip mask stability test present** — two independent encrypt→decrypt→mask cycles of same plaintext token yield identical `***<last3>` mask string.
6. **Direct helper imports only** — `service.ts` top has literal `import { decrypt, encrypt } from '@shared/utils/crypto.js'` + `import { maskTokenForLog, maskWaPhone } from '@shared/utils/masking.js'`. No ctor-inject of pure helpers.
7. **`NotFoundError` (not raw `Error`)** — `getForHotel` throws `NotFoundError('WaConfig', hotelId)` or equivalent AppError subclass. `throw new Error(` MUST be 0 hits.
8. **Barrel additive-only** — `index.ts` top-of-file T06 BSP re-export block (`export type { BspCredentials, BspSendResult, SendTemplateInput, SendTextInput, WhatsappBspPort } from './ports/whatsapp-bsp.port.js';`) byte-for-byte unchanged. Only appends below.

**Scope gate**
9. `git diff --stat` in SUBMIT — must show exactly the 7-create + 1-modify list. Any unexpected file = REJECT-scope. `PM-STATUS-B.md` (this file) and `package.json` / `pnpm-lock.yaml` explicitly NOT in the diff. If `.gitignore` needs a `.prisma/client` line, mention separately and justify (default is: `.gitignore` already covers `node_modules/` so no change needed).
10. `make prisma-generate` run explicitly called out in SUBMIT §Notes — timestamp + confirmation it wrote only under `node_modules/.prisma/client/` (no `src/` or `prisma/` mutation). Include `git status --short` before-and-after evidence.

**Tolerated deviations to declare explicitly in SUBMIT §Notes** (PM B pre-accepts these; do NOT hide them):
11. Prisma-mock in `repository.test.ts` — stopgap per GAP #4 B, T17-a2 precedent. State "T10-INTEG follow-up parked awaiting Q-C-01 (prisma singleton)".
12. Response-mask on `webhookVerifyToken` — spec §5 AC L118 only mandates `access_token` masked; you additionally mask `webhookVerifyToken` in the GET response. Defensive over-mask (defense-in-depth), non-violating. Flag it: "If FE integration surfaces read-back need, spec-amend post-hoc". Alternatively drop the response-mask (keep only log-mask) — your call, either is ACK-able; just declare which and why.
13. Q-A-03 workaround (env-set for `NODE_ENV=test`) — re-appears in your `service.test.ts` `beforeAll`. Note it. This is not on you to fix (shared-infra Q).

**Do NOT file** these in SUBMIT:
14. **No Q-B-01 for `app_secret`** — that gap already lives at PARENT §3a as **Q-A-04** (Nathan raised at H12, still `open`). Reference `Q-A-04` directly in SUBMIT §Notes as T12 blocker. Filing Q-B-01 duplicate = noise + register drift. §3 mirror table in this file stays empty; PM B routes any new blocker to PARENT only after checking §3a for existing.

**Follow-ups you will file in SUBMIT** (list them, do not implement):
- **T10-followup** — routes + `api.ts` wiring + `hotelId` derivation. Blocked on Q-C-01 + Q-C-02 + Q-C-03. Parallel to Satrio's T17-followup — same triple-block.
- **T10-INTEG** — real-DB integration test for repository (testcontainers Postgres per `CLAUDE.md §8` + `docs/TESTING.md`). Blocked on Q-C-01 (prisma singleton).

**Commit + branch discipline**:
- Branch `feat/whatsapp-config-crud` per `CLAUDE.md §12`.
- Conventional commit — recommended: `feat(whatsapp): T10 config CRUD primitive (types + schema + repo + service + tests)`. Use `make commit MSG="…"` for auto lint+typecheck+format-check.
- ONE commit for the primitive (matches T17-a2 single-commit shape `98f098b`). If you split, PM B will still ACK, but noise up.
- Push branch; **do not open PR yet** — PM B rerun locally on your branch first (per PM-AGENT §3 Step 4 "trust but verify"), then PM B says "open PR" in VERDICT block. This mirrors Satrio T17-a2 flow.

**On rebuttal**: if any of the above 14 conditions feels wrong for T10 (mis-scoped, spec-conflict, etc.), post a one-sentence `REBUTTAL T10 item-#N` sub-block before coding — PM B re-checks in-session. Do not silently override.

**Timeline expectation**: T17-a2 shipped 22 tests / 100% module cov / drift-clean single commit. Same envelope reasonable for T10 (est. 3 test files × 5-10 cases each = ~20 tests). Not a hard deadline — quality > velocity.

Proceed. Run `make prisma-generate` → code per §Approach 2-9 → `make check` → SUBMIT.

#### SUBMIT T10 — exec-B (Nanak) at H16 23:10 (attempt 2)

Task: T10 — WA config CRUD **primitive** (types + schema + repository + service + unit tests). Narrow scope per T17-a2 precedent; routes + `api.ts` wiring parked as T10-followup awaiting Q-C-01/02/03. Branch: `feat/whatsapp-config-crud` @ commit `175faa5`.

Files changed: **8** (7 create + 1 modify) — **806 insertions** total (795 new-file LOC + 11 net barrel delta).
- `src/modules/whatsapp/whatsapp-config.types.ts` (new, 42 LOC)
- `src/modules/whatsapp/whatsapp-config.schema.ts` (new, 51 LOC)
- `src/modules/whatsapp/whatsapp-config.repository.ts` (new, 43 LOC)
- `src/modules/whatsapp/whatsapp-config.service.ts` (new, 105 LOC)
- `src/modules/whatsapp/__tests__/whatsapp-config.schema.test.ts` (new, 138 LOC, 16 tests)
- `src/modules/whatsapp/__tests__/whatsapp-config.repository.test.ts` (new, 106 LOC, 3 tests)
- `src/modules/whatsapp/__tests__/whatsapp-config.service.test.ts` (new, 310 LOC, 9 tests)
- `src/modules/whatsapp/index.ts` (modified, +11 net) — barrel additive-only; T06 BSP re-export block byte-for-byte preserved at top

DoD self-check — **all 14 ACK binding conditions**:
- [x] **#1 `make check` PASS end-to-end** — lint 0/0 (`--max-warnings 0`), format-check clean, typecheck strict (0 errors), test-unit 12/12 suites passed 115/117 tests (2 skipped = pre-existing `_template/` baseline). PM B rerun invited.
- [x] **#2 Drift scans (14 categories → mapped to 6 EXECUTOR §4.4 scans) — 0 hits on module scope**. Any pre-existing hits confined to `_template/*`, `core/config/env.ts`, `core/http/http-client.ts` — files explicitly listed in PLAN §Files-NOT-touched. Detail in §Drift scans below.
- [x] **#3 Coverage 100% stmt/branch/func/line** on `src/modules/whatsapp/whatsapp-config.*.ts` (3 runtime files). `types.ts` erased at compile per ts-jest — expected per ACK caveat. See §Test evidence.
- [x] **#4 PII-floor log test present** — `whatsapp-config.service.test.ts:239-263` "should NEVER include the plaintext accessToken, webhookVerifyToken, or raw phoneNumber in the log payload (PII floor)": asserts `JSON.stringify(logger.info.mock.calls[0]?.[0])` does not contain `PLAINTEXT_ACCESS_TOKEN` / `PLAINTEXT_WEBHOOK_VERIFY_TOKEN` / `PLAINTEXT_PHONE_NUMBER`.
- [x] **#5 Round-trip mask stability test present** — same file "should produce a stable mask across two independent encrypt-decrypt cycles of the same plaintext (round-trip stability)": two `encrypt(PLAINTEXT_ACCESS_TOKEN)` produce distinct ciphertexts, both `decrypt → maskTokenForLog` yield identical `***<last3>` string, matching `maskTokenForLog(PLAINTEXT_ACCESS_TOKEN)` directly.
- [x] **#6 Direct helper imports only** — `whatsapp-config.service.ts:14-15` literal `import { decrypt, encrypt } from '@shared/utils/crypto.js';` + `import { maskTokenForLog, maskWaPhone } from '@shared/utils/masking.js';`. Ctor is `(repo: WhatsappConfigRepository, logger: Logger)` — no cryptoDeps.
- [x] **#7 `NotFoundError` (not raw Error)** — `whatsapp-config.service.ts:53` `throw new NotFoundError(RESOURCE, hotelId)` where `RESOURCE = 'WaConfig'`. Drift scan #3 confirms 0 `throw new Error(` in my touched files.
- [x] **#8 Barrel additive-only** — `src/modules/whatsapp/index.ts:1-7` T06 BSP re-export block byte-for-byte preserved (`BspCredentials`, `BspSendResult`, `SendTemplateInput`, `SendTextInput`, `WhatsappBspPort` from `./ports/whatsapp-bsp.port.js`). New exports appended L9-18.
- [x] **#9 `git diff --stat` scope** — 8 files total (7 create + 1 modify). Zero touches to `src/entrypoints/api.ts`, `src/core/prisma/prisma-client.ts`, `src/plugins/*`, `prisma/schema.prisma`, `prisma/migrations/*`, `package.json`, `pnpm-lock.yaml`, `src/modules/telegram/*`, `src/modules/_template/*`, T06 `whatsapp/ports/*` + `whatsapp/adapters/*` + `whatsapp/__tests__/1engage.adapter.test.ts`. `.gitignore` unchanged (existing `node_modules/` cover handles `.prisma/client/`). PM-STATUS-B.md commit separated per §0.6 2-commit discipline (in commit chain after `175faa5`, not in this file diff).
- [x] **#10 `make prisma-generate` recorded** — ran 2026-07-04 22:36:30 → 22:36:43 WIB. Prisma Client v5.22.0 written to `./node_modules/.prisma/client/` only. `git status --short` before/after: both empty (no `src/`, `prisma/`, `package.json` mutation). Command: `pnpm prisma:generate` via `Makefile:87`.
- [x] **#11 Prisma-mock stopgap declared** — see §Notes.
- [x] **#12 Response-mask on `webhookVerifyToken` declared** — see §Notes.
- [x] **#13 Q-A-03 test env workaround re-appearance noted** — see §Notes.
- [x] **#14 Q-B-01 NOT filed** — T12 `app_secret` gap referenced as existing `Q-A-04` in §Notes; §3 mirror table stays empty (no duplicate).

Quality gate
- `make typecheck`: PASS (0 errors)
- `make lint`: PASS (0 errors, 0 warnings — `eslint . --max-warnings 0`)
- `make format-check`: PASS (all matched files use Prettier code style)
- `make test-unit`: PASS (12 of 14 suites, 115 of 117 tests — 2 pre-existing baseline skips in `_template/`; my 3 new suites 28/28 pass)
- `make check`: PASS end-to-end (concatenation of the above)

Drift scans (all 6 EXECUTOR §4.4 categories — 0 hits on `src/modules/whatsapp/whatsapp-config.*`)
- `any` types: 0 (pre-existing 2 hits in `_template/*`, untouched)
- `console.log/info/debug`: 0 (repo-wide 0)
- `throw new Error(` in `src/modules/` + `src/core/`: 0 in module scope (pre-existing 4 hits in `_template/_template.repository.ts:23`, `core/config/env.ts:75`, `core/http/http-client.ts:19,27` — all untouched)
- Forbidden imports (`express`/`typeorm`/`sequelize`/`moment`/`node-fetch`): 0 (repo-wide 0)
- `^export default ` outside entrypoints/config: 0 (repo-wide 0)
- `.skip(` in `*.test.ts`: 0 in module scope (pre-existing 2 hits in `_template/*`, untouched)

Security check (spec §4.1 encryption-at-rest + CLAUDE §6 PII floor)
- `access_token` encrypted via T03 `encrypt()` from `@shared/utils/crypto.js` BEFORE persist — verified in test `should encrypt the plaintext accessToken before calling the repository`: `passedInput.accessTokenEnc` starts with `v1:` envelope prefix, is `!== PLAINTEXT_ACCESS_TOKEN`, and round-trips via `decrypt()` to the original plaintext.
- PII-floor log line fires BEFORE `encrypt()` call — verified via ordering test `should emit the PII-floor log line BEFORE calling repo.upsert` (events array assertion `['log', 'upsert']`).
- Plaintext never leaves service in view path — `getForHotel` returns domain projection with `accessToken = maskTokenForLog(decrypt(row.accessTokenEnc))` and `webhookVerifyToken = maskTokenForLog(row.webhookVerifyToken)`. Verified in test `should never expose the plaintext accessToken in the returned domain`.
- No secret hardcoded — encryption key sourced from `loadConfig()` via `crypto.ts:16-18`; my code does not reference `ENCRYPTION_KEY` env directly.
- No webhook route in this attempt — HMAC verify N/A (T12 concern).

Test evidence
- Unit: **28 tests, 3 suites** — `whatsapp-config.schema.test.ts` (16), `whatsapp-config.repository.test.ts` (3), `whatsapp-config.service.test.ts` (9)
- Integration: **0 (deferred)** — T10-INTEG follow-up parked awaiting Q-C-01 (see §Notes)
- Coverage (jest, scoped `--collectCoverageFrom='src/modules/whatsapp/whatsapp-config.*.ts'`):
  ```
  File                           | % Stmts | % Branch | % Funcs | % Lines
  -------------------------------|---------|----------|---------|--------
  All files                      |   100   |   100    |   100   |   100
   whatsapp-config.repository.ts |   100   |   100    |   100   |   100
   whatsapp-config.schema.ts     |   100   |   100    |   100   |   100
   whatsapp-config.service.ts    |   100   |   100    |   100   |   100
  ```
  (`whatsapp-config.types.ts` — pure type declarations, erased at compile per ts-jest; not instrumented. Expected shape per ACK §Approach.)

Notes / tolerated deviations (all pre-declared per ACK binding conditions)
- **Item #11 · Prisma-mock stopgap in `whatsapp-config.repository.test.ts`** — Prisma client is mocked as a minimal test-double (`{ waConfig: { findUnique: jest.fn(), upsert: jest.fn() } } as unknown as PrismaClient`) to assert call-shape only. Real-DB integration test parked as **T10-INTEG follow-up** blocked on Q-C-01 (prisma singleton). Stopgap docstring at test file head. No `.skip` / `describe.skip`. Precedent: T17-a2 same shape.
- **Item #12 · Defensive over-mask on `webhookVerifyToken` in GET response** — Spec §5 AC only mandates masking `access_token`; I additionally mask `webhookVerifyToken` in the domain projection (`toDomain(row)` applies `maskTokenForLog` to both). Rationale: `webhook_verify_token` is used by Meta for hub-challenge and is secret-adjacent per CLAUDE §6 spirit. If FE integration surfaces a read-back need in a later spec amendment, we can flip a boolean or split the projection. **Choice declared: KEEP over-mask** (defense-in-depth outweighs the theoretical read-back cost — Meta hub-challenge only requires the token during handshake, not display).
- **Item #13 · Q-A-03 test-env workaround re-appears** — `whatsapp-config.service.test.ts:83-95` stamps a full `BASE_ENV` in `beforeEach` + `resetConfigCache()` and restores in `afterEach`, mirroring `src/shared/utils/__tests__/crypto.test.ts:9-32`. Shared-infra Q, not on slot B to solve.
- **Prettier collapse — diff-stat +11 vs +17 quoted pre-format** — `pnpm prettier --write` collapsed two multi-line `export { … } from './whatsapp-config.schema.js';` blocks into single lines during the round-1 lint iteration. Semantic content identical; no exports added / removed / renamed vs. PLAN §Approach step 9.
- **`types.ts` not in coverage output** — 42 LOC of pure type declarations. ts-jest erases at compile; nothing to instrument at runtime. Types are consumed via barrel re-export + at compile in repo/service imports. Normal ts-jest behavior; matches PM B ACK caveat.

Q register / follow-ups
- **T12 blocker — WA `app_secret` field absence**: `wa_configs` DDL §4.1 does not include an `app_secret` (or similar) column but spec §4.11 needs one for HMAC verify at T12. This is **existing Q-A-04** (Nathan raised at H12, still `open` per parent register per PM B binding #14). Not filing a duplicate Q-B-01. §3 mirror in this file stays empty.
- **T10-followup** — routes + `api.ts` wiring + `hotelId` derivation from JWT session. Blocked on Q-C-01 (prisma singleton) + Q-C-02 (`api.ts` bootstrap) + Q-C-03 (JWT/gm_admin plugin). Parallel to Satrio's T17-followup.
- **T10-INTEG** — real-DB integration test for repository (testcontainers Postgres per `CLAUDE.md §8` + `docs/TESTING.md`). Blocked on Q-C-01 (prisma singleton).

Requesting PM B VERDICT.

##### VERDICT T10 — APPROVED (H16, attempt 2, primitive) by PM B (Nanak)

✅ **APPROVED**. Independent PM rerun on `feat/whatsapp-config-crud @ 175faa5` (code) + `eb732dd` (SUBMIT status). All 14 binding conditions verified against code, not claim. Scope contained per T17-a2 primitive shape. Ready for follow-up wiring.

**Independent verification trace** (rerun on PM shell, Node 22.23.1 + pnpm 9.0.0 via nvm/corepack):

- `make check` — **PASS end-to-end**. Output confirms: `pnpm lint` clean (`eslint . --max-warnings 0`), `pnpm format:check` "All matched files use Prettier code style!", `pnpm typecheck` (`tsc --noEmit`) 0 errors, `pnpm test:unit` 12/14 suites passed (2 pre-existing `_template/*` baseline skips per T01), 115/117 tests passed (my 3 new suites = 28/28 pass, 0 fail). Timing 0.766s.
- **Drift scans (6 EXECUTOR §4.4 categories) on `src/modules/whatsapp/whatsapp-config.*`** — all 0 hits:
  - `any` (`: any|<any>|as any` excluding `unknown`): 0
  - `console.log/info/debug`: 0
  - `throw new Error(`: 0
  - Forbidden imports (`express|typeorm|sequelize|moment|node-fetch`): 0
  - `^export default ` outside entrypoints: 0
  - `.skip(` / `describe.skip`: 0
- **Coverage rerun** (`pnpm test:coverage --collectCoverageFrom='src/modules/whatsapp/whatsapp-config.*.ts' --testPathPattern='whatsapp-config'`):
  ```
  File                           | % Stmts | % Branch | % Funcs | % Lines
  All files                      |   100   |   100    |   100   |   100
   whatsapp-config.repository.ts |   100   |   100    |   100   |   100
   whatsapp-config.schema.ts     |   100   |   100    |   100   |   100
   whatsapp-config.service.ts    |   100   |   100    |   100   |   100
  ```
  `types.ts` erased at compile per ts-jest — expected, matches ACK caveat.
- **`git diff --stat main..feat/whatsapp-config-crud -- src/ prisma/ package.json pnpm-lock.yaml`** — exactly 8 files touched: 7 create (`whatsapp-config.{types,schema,repository,service}.ts` + 3 test files) + 1 modify (`index.ts` +11 net). Zero touches to `api.ts`, `prisma-client.ts`, `plugins/*`, `prisma/schema.prisma`, `prisma/migrations/*`, `package.json`, `pnpm-lock.yaml`, `telegram/*`, `_template/*`, T06 BSP port/adapter/tests.

**14 binding conditions — file:line evidence**:

- **#1 `make check` PASS** — PM rerun output above. ✓
- **#2 Drift scans 0 hits on module scope** — PM rerun above. Pre-existing hits confined to `_template/*` + `core/config/env.ts` + `core/http/http-client.ts` (files in NOT-touched list). ✓
- **#3 Coverage 100%** — PM rerun above (`repository.ts`, `schema.ts`, `service.ts`). ✓
- **#4 PII-floor log test present** — `whatsapp-config.service.test.ts:242-268` asserts `JSON.stringify(logger.info.mock.calls[0]?.[0])` excludes `PLAINTEXT_ACCESS_TOKEN`, `PLAINTEXT_WEBHOOK_VERIFY_TOKEN`, `PLAINTEXT_PHONE_NUMBER`. **Extra rigor**: `service.test.ts:270-297` events-array ordering test proves log fires BEFORE `repo.upsert` (`events: ['log', 'upsert']`) — beyond binding, matches T17-a2 discipline. ✓
- **#5 Round-trip mask stability test present** — `service.test.ts:299-309` two independent `encrypt(PLAINTEXT)` yield distinct ciphertexts (proves GCM nonce randomness), both `decrypt→maskTokenForLog` yield identical `***<last3>` string matching `maskTokenForLog(PLAINTEXT)` directly. ✓
- **#6 Direct helper imports only** — `whatsapp-config.service.ts:14` `import { decrypt, encrypt } from '@shared/utils/crypto.js';` + `:15` `import { maskTokenForLog, maskWaPhone } from '@shared/utils/masking.js';`. Ctor at `:44-47` = `(repo, logger)` — no cryptoDeps. ✓
- **#7 `NotFoundError` (not raw Error)** — `service.ts:52` `throw new NotFoundError(RESOURCE, hotelId)` where `RESOURCE = 'WaConfig'` (:25). Drift scan #3 confirms `throw new Error(` = 0 in module scope. ✓
- **#8 Barrel additive-only** — `src/modules/whatsapp/index.ts:1-7` T06 BSP re-export block (`BspCredentials, BspSendResult, SendTemplateInput, SendTextInput, WhatsappBspPort from './ports/whatsapp-bsp.port.js';`) byte-for-byte preserved vs `main`. New exports appended L9-18 only. `diff` against main shows +11 net = additive. ✓
- **#9 `git diff --stat` scope-clean** — PM rerun above. 7 create + 1 modify, zero cross-boundary touches. ✓
- **#10 `make prisma-generate` declared** — SUBMIT `§DoD #10` line 449 declares timestamp `2026-07-04 22:36:30 → 22:36:43 WIB` writing to `node_modules/.prisma/client/` only. PM independently verified: `node_modules/.prisma/client/` populated (`default.d.ts`, `default.js`, `edge.d.ts`, `edge.js`, `index-browser.js`, …) and `git status --short` on main empty (no `src/`/`prisma/`/`package.json` mutation from codegen). ✓
- **#11 Prisma-mock stopgap declared** — SUBMIT §Notes L492 + `whatsapp-config.repository.test.ts:1-7` docstring both flag stopgap. T10-INTEG follow-up filed at L501. Precedent: T17-a2 PARENT §2 L120. ✓ Accepted.
- **#12 Response-mask on `webhookVerifyToken` declared** — SUBMIT §Notes L493 declares "KEEP over-mask" (defense-in-depth). Verified in `service.ts:99` (`webhookVerifyToken: maskTokenForLog(row.webhookVerifyToken)`). Non-violating vs spec §5 AC (which is minimum-mask AC, not maximum). ✓ Accepted with note: if FE integration reveals read-back need in a later spec amendment, flip via T10-followup PLAN — do not silently regress.
- **#13 Q-A-03 test-env workaround re-appearance** — SUBMIT §Notes L494. `service.test.ts:83-95` mirrors `crypto.test.ts:9-32`. Shared-infra pending (not on slot B). ✓ Noted, no action from PM B.
- **#14 Q-B-01 NOT filed** — §3 mirror table L470 empty. SUBMIT §Q-register L499 references Q-A-04 (existing at PARENT §3a) as T12 blocker instead of duplicating. ✓

**Prettier collapse (SUBMIT §Notes L495)** — `+11 net vs +17 quoted pre-format` on `index.ts` explained as `prettier --write` line-collapsing two multi-line `export { … }` statements. PM diff-audit: L11 + L12 are single-line exports of 3 symbols each; semantically identical to a hypothetical multi-line variant. No exports added/removed/renamed vs PLAN §Approach step 9. ✓ Accepted, non-drift.

**Spec-alignment audit** — Prisma `WaConfig` model (`prisma/schema.prisma:33-46`, from T02) vs zod `WhatsappConfigPutSchema` (`whatsapp-config.schema.ts:23-32`) vs DDL §4.1:
- `bsp` VARCHAR(40) → `z.enum(['1engage'])` — string-literal caps below 40 ✓
- `phone_number_id` VARCHAR(80) → `z.string().min(1).max(80)` ✓
- `phone_number` VARCHAR(20) → `z.string().regex(E164).max(20)` ✓
- `webhook_url` VARCHAR(500) → `z.string().url().max(500)` ✓
- `webhook_verify_token` VARCHAR(80) → `z.string().min(1).max(80)` ✓
- `access_token_enc` TEXT (unlimited, ciphertext) → zod input `accessToken` (plaintext) `min(1)` — length uncapped by design (encryption envelope owns storage sizing). ✓

**Security floor check (CLAUDE §6 + spec §4.1)**:
- AES-256-GCM encrypt via T03 helper BEFORE persist — `service.ts:76` `encrypt(input.accessToken)`; test `service.test.ts:184-186` asserts `passedInput.accessTokenEnc.startsWith('v1:')` (envelope prefix per `crypto.ts:52`) and round-trips via `decrypt()`. ✓
- PII-floor log BEFORE encrypt — ordering test `service.test.ts:270-297` proves `['log', 'upsert']` sequence. ✓
- No plaintext in view — `service.test.ts:151-152` `JSON.stringify(result)` assertion. ✓
- No hardcoded secrets — `crypto.ts:16-18` sources from `loadConfig()`; no `ENCRYPTION_KEY` env reference in module code. ✓
- No webhook route in this attempt — HMAC verify concern belongs to T12. ✓

**Tolerated deviations accepted** (all pre-declared per ACK #11-#13):
- Prisma-mock stopgap (repo test), T10-INTEG follow-up parked
- Defensive over-mask on `webhookVerifyToken` in view
- Q-A-03 shared-infra workaround (env re-stamp in `beforeEach`) — status quo pending PM A resolution

**Follow-ups accepted** (files, do not action):
- **T10-followup**: routes + `api.ts` wiring + `hotelId` from JWT session. Blocked on Q-C-01 + Q-C-02 + Q-C-03. Parallel to Satrio T17-followup.
- **T10-INTEG**: real-DB integration test (testcontainers Postgres per `docs/TESTING.md`). Blocked on Q-C-01.

**Actions taken**:
- → §1 task tracker row for T10 updated (`assigned` → `approved (primitive)` with `PM B (H16, a2)` verified-by).
- → PARENT §1 row for T10 mirrored to slot-B status (Parent PM authority for parent §1; PM B posts row update per §0.4 own-row authorization).
- → PARENT §2 short roll-up posted (1 line, format per `PM-AGENT.md §0.8`).

**Next expected action**: Executor B — PR open on `feat/whatsapp-config-crud` for PO merge review; parallel start on the next slot-B primitive that doesn't depend on Q-C-01/02/03 (options: **T16** WA template Meta relay — depends on T06 which is merged, and does not require api.ts wiring since it's an outbound relay; or park & pick up T11 as skeleton pending routes-wiring window). PM B will re-verify on CI green post-PR before recommending merge. Slot B progress: **1/7 (T10 primitive)** · T10-followup + T10-INTEG parked · T11-T16 backlog.

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
