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
| T10 | WA config CRUD (`GET, PUT /api/integrations/whatsapp`)                           | merged | PM B (H16, a2) | Primitive shipped: types+zod+Prisma-direct-ctor-inject repo+service (encrypt+decrypt-mask on view + PII-floor log BEFORE encrypt + round-trip mask stability) + 28 unit tests, 100% module cov, drift clean, make check green on PM rerun. Router+api.ts wiring = T10-followup blocked on Q-C-01/02/03. Merged PR #10 `36462d2` |
| T11 | Verify webhook action (`POST /api/integrations/whatsapp/verify-webhook`)         | merged | PM B (H17, a1) | Narrow primitive per PM ACK 10-file inventory: types + schema + sibling repo (single `markVerified`) + service + `WebhookPingerPort` + `HttpWebhookPingerAdapter` (probe-semantics, no throw) + 32 unit tests, 100% module cov, drift clean, make check green on PM rerun. Simple-GET (no `hub.*` params per spec §2.2 "reachable" wording). Router = T11-followup blocked on Q-C-02/03. Merged PR #13 `b083295` |
| T12 | WA inbound webhook ingest (signature → persist → HC guest upsert → AI RPC)       | merged | PM B (H17, a1) | Narrow primitive per PM ACK 9-file inventory: types + Meta envelope zod schema + `webhook_events` sibling repo (3 methods) + 2-leg service (sync `ingestSync` + async `processEvent` worker-discipline no-throw) + HC guest-upsert port TYPE-ONLY (Q-B-04) + AI inbound port TYPE-ONLY (Q-B-05) + 32 unit tests, 100% module cov, drift clean, make check green on PM rerun. Signature-agnostic (T04 plugin at wiring). `isDuplicate: false` placeholder (Q-B-06 D). `as string` invariant assertion at service.ts:153 (accepted, future refactor: discriminated union). Router+adapters = T12-followup blocked on Q-A-04 + Q-B-04/05/06 + Q-C-02. Merged PR #14 `23bfea1` (**SQUASH** — first squash merge repo-wide, CLAUDE §12 enforced) |
| T13 | Outbound WA dispatch RPC + DND check + quota two-phase                           | backlog  | —              | After T06 + T09 (Nathan); HC `check_and_reserve_outbound_quota` RPC|
| T14 | Outbound retry queue (3 attempts exponential backoff)                            | backlog  | —              | After T07 (Nathan) + T13                                           |
| T15 | Delivery receipts ingest (WA Cloud webhook stream)                               | merged | PM B (H17, a1) | Narrow primitive per PM ACK clean-approval 7-file inventory: types (discriminated-union outcome) + Meta statuses envelope zod schema + cross-table sibling repo (2 methods: `findDispatchByExternalId` tenant-guarded + `persist`) + single-method sync service (orphan skip + count + never throws per-status) + 28 unit tests, **first-pass 100% module cov** (no branch iteration needed), drift clean, make check green on PM rerun. Signature-agnostic (T04 plugin at wiring). Multi-row per triple accepted (Q-B-07 D placeholder). **`as string` recurrence eliminated** — discriminated union up-front successfully applied T12 lesson. Router = T15-followup blocked on Q-A-04 + Q-C-02 + T12-followup structure. Merged PR #15 `780dca9` (**SQUASH** — 2nd in a row after PR #14, CLAUDE §12 pattern established) |
| T16 | WA template Meta relay (submit/resubmit/callback to HC)                          | merged | PM B (H17, a1) | Narrow primitive per PM ACK modified-B: types + zod + service + BSP template port + HC callback port TYPE-ONLY + 1engage template adapter (PATCH-preferred + DELETE+POST fallback) + 48 unit tests, 100% module cov, drift clean, make check green on PM rerun. Q-B-01/02/03 stamped in 4 files; HC adapter dropped to T16-followup pending Q-B-02/Q-C-02. Merged PR #12 `95863c3` |

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

### ASSIGNMENT T16 — claimed by exec-B (Nanak) at H16 23:36
- Branch: feat/wa-template-relay (will branch off latest `main` before first src/ commit; PLAN commit lands on `main`)
- Routed from: PM-STATUS-B.md §8 queue (self-claim per EXECUTOR-PROTOCOL §3B — no explicit PM assignment for T16 yet, deps merged, Q-C-01/02/03 don't block outbound relay primitive)

#### PLAN T16 — exec-B (Nanak) at H16 23:36

**Scope recap** (spec: `MVP-INTEGRATION-FIRST.md §1.2 B8` + `docs/spec/04-integration-channels.md §1/§2.4/§3.1/§7/§10`)

T16 = WhatsApp template **Meta relay** primitive. Three interlocking flows all owned here (Integration owns dispatch; HC owns `wa_templates` table):
1. **Inbound RPC (HC → us)**: `submit_wa_template_to_meta(template_id)` + `resubmit_wa_template_to_meta(template_id)` — HC calls us with a template ID (spec §2.4 signature). We relay to Meta's `/{waba_id}/message_templates` endpoint (see GAP #1 on richer payload shape).
2. **Outbound BSP call (us → Meta)**: HTTPS POST to WA Graph via the 1engage BSP gateway (`/message_templates` — distinct from T06's `/messages` surface used for actual message dispatch).
3. **Async callback (Meta → us → HC)**: Meta pushes template status transitions (`template:approved` / `template:rejected`) through `POST /webhook/whatsapp/:hotel_slug` — same T12 ingress that carries messages + receipts, we branch by payload discriminator. Handler resolves branch and calls HC internal RPC `updateWaTemplateStatus` (spec §3.1 "internal callback to HC").

Following T10-a2 discipline: **primitive only**. No routes.ts (both the HC-facing RPC receiver + the Meta webhook branch belong in the router layer, deferred to T16-followup after Q-C-02). NO Prisma table added (state lives in HC's `wa_templates` table per spec §1 "Does NOT own"). NO existing T06 file mutated. NO api.ts / prisma-client / plugins touched.

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot B (Nanak) ✓
- CLAUDE.md loaded ✓
- Task spec read: `MVP-INTEGRATION-FIRST.md §1.2 B8` (RPC surface) + `§4.11` (internal RPC auth) + `§7` (hand-off) · `04-integration-channels.md §1` (ownership boundary), `§2.3` (webhook ingress includes template status), `§2.4` (RPC catalog exact signatures), `§3.1` (template approval flow narrative), `§7` (retry policy — template-not-approved = NOT retried, permanent), `§10` (Q-CONTRACT-07 ratification), `§11` (slot routing) ✓
- Parent docs spot-read: `docs/MODULE_TEMPLATE.md` (external-IO variant with `ports/` + `adapters/`) · `src/modules/whatsapp/ports/whatsapp-bsp.port.ts` (T06 BSP port for message dispatch — `sendText`, `sendTemplate` — read-only inspection) · `src/modules/whatsapp/adapters/1engage.adapter.ts` (T06 BSP adapter — narrow `HttpPoster` injection pattern, `ExternalServiceError` translation) · `src/plugins/internal-rpc-auth.plugin.ts` (T09 server-side guard — validates incoming `X-Internal-Secret`, out-of-scope for me since I need CLIENT-side header injection for the HC callback OUT) · `src/core/http/http-client.ts` (still stub; will mirror T06's narrow `HttpPoster` interface pattern to avoid coupling) · `src/core/errors/app-errors.ts` (existing `ExternalServiceError` for upstream Meta failures) · `src/core/config/env.ts` (verified: NO `HC_BASE_URL` / `INTERNAL_SECRET` field — config wiring is Q-C-02 concern) ✓
- Dependencies check:
  - T06 (BSP port + 1engage adapter): MERGED on `main` (`3c1274a` PR #6) ✓ — my new adapter targets Meta's `/message_templates` surface, NOT the existing `/messages` port, so it lives in a separate file and does not mutate T06
  - T09 (internal RPC auth guard): MERGED on `main` (`9cc100f` PR #9) ✓ — server-side; my outbound HC callback adapter mirrors the header pattern client-side
  - T10 (WA config primitive): MERGED (`36462d2` PR #10) ✓ — I extend the `whatsapp/index.ts` barrel additively, no T10 file mutation
  - Q-A-04 (WA `app_secret` for HMAC verify): still `open` at PARENT §3a — impacts T12 webhook receiver signature verify, my primitive service is signature-agnostic (see GAP #6)
  - Q-C-01/02/03 (prisma singleton / api.ts bootstrap / JWT plugin): **NOT blockers for T16** — T16 has no DB access, no `api.ts` wiring in the primitive (deferred to T16-followup), no session-auth (HC uses `X-Internal-Secret`, not JWT)
- `make typecheck`: PASS on `main` (Node 22 nvm + pnpm 9 corepack) ✓
- `make lint`: PASS on `main` ✓
- Scaffolder risk: **none proposed**. NO `pnpm add`, NO `pnpm dlx`, NO `pnpm create`, NO `pnpm prisma generate` (no schema change).

**Files to create** (see GAP #7 for narrow vs wide primitive shape — default proposed shape below)

```
src/modules/whatsapp/whatsapp-template.types.ts
src/modules/whatsapp/whatsapp-template.schema.ts
src/modules/whatsapp/whatsapp-template.service.ts
src/modules/whatsapp/ports/whatsapp-template-management.port.ts
src/modules/whatsapp/ports/hotel-core-template-callback.port.ts
src/modules/whatsapp/adapters/1engage-template.adapter.ts
src/modules/whatsapp/adapters/http-hotel-core-callback.adapter.ts
src/modules/whatsapp/__tests__/whatsapp-template.schema.test.ts
src/modules/whatsapp/__tests__/whatsapp-template.service.test.ts
src/modules/whatsapp/__tests__/1engage-template.adapter.test.ts
src/modules/whatsapp/__tests__/http-hotel-core-callback.adapter.test.ts
```

11 files (7 source + 4 tests) — bigger than T10-a2 (7 files) because T16 nature is heavily port/adapter driven with TWO external systems (Meta + HC). GAP #7 offers narrower alternatives.

**Files to modify** (1)

- `src/modules/whatsapp/index.ts` — append primitive exports (service class, port types, adapter factories, schemas). Preserve T06 BSP + T10 config exports byte-for-byte at top.

**Files explicitly NOT touched**

- `prisma/schema.prisma`, `prisma/migrations/*` — no schema change (HC owns `wa_templates`); state is Meta+HC, not us
- `src/entrypoints/api.ts` — stub (Q-C-02); no wiring
- `src/core/prisma/prisma-client.ts` — stub (Q-C-01); T16 has no DB access
- `src/core/http/http-client.ts` — stub; will use T06's narrow `HttpPoster` interface pattern (same file already in-tree) to avoid coupling
- `src/core/config/env.ts` — config additions (HC URL + shared secret) belong at wiring time (Q-C-02 land)
- `src/plugins/*` — T09 internal-rpc-auth exists (server-side); my outbound client mirrors the header without mutating the plugin
- T06 primitive: `src/modules/whatsapp/ports/whatsapp-bsp.port.ts` + `src/modules/whatsapp/adapters/1engage.adapter.ts` + `src/modules/whatsapp/__tests__/1engage.adapter.test.ts` — byte-for-byte preserved (my new `1engage-template.adapter.ts` is a SIBLING, not a mutation)
- T10 primitive: `src/modules/whatsapp/whatsapp-config.*` — byte-for-byte preserved
- `src/modules/telegram/*` — slot C
- `src/modules/_template/*` — reference

**Approach**

Hexagonal Disiplin (CLAUDE §4 + ADR-0001): both external systems (Meta BSP + HC) are external IO → each gets a port + adapter. HC callback is OUTBOUND HTTP (not a DB write, not a pure helper), so it MUST be a port/adapter per §4 "WAJIB port + adapter" (outbound notification / cross-service RPC caller). Coding order:

1. **`whatsapp-template.types.ts`** — domain types:
   - `WaTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'` (Meta's 3-value taxonomy)
   - `WaTemplateStatus = 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED'`
   - `WaTemplateComponent` (header/body/footer/buttons union — narrow shape per Meta's structured components)
   - `SubmitTemplateInput`, `ResubmitTemplateInput`, `TemplateStatusEvent`, `HotelCoreCallbackPayload`
2. **`whatsapp-template.schema.ts`** — zod for HC RPC input (see GAP #1 shape assumption) + Meta status webhook payload branch (extraction from raw webhook envelope — the router layer T12 will parse the outer envelope, we consume the template-branch sub-payload) + HC callback payload (`updateWaTemplateStatus`). Strict, `.strict()`.
3. **`ports/whatsapp-template-management.port.ts`** — NEW port (see GAP #3):
   ```
   interface WhatsappTemplateManagementPort {
     submitTemplate(input: SubmitTemplateInput): Promise<{ metaTemplateId: string; status: WaTemplateStatus }>;
     resubmitTemplate(input: ResubmitTemplateInput): Promise<{ metaTemplateId: string; status: WaTemplateStatus }>;
   }
   ```
   BSP credentials (`waba_id`, `accessToken`) accepted per-call in the input, mirroring T06's `BspCredentials` pattern. Decrypt happens upstream (service or caller) — port is agnostic.
4. **`ports/hotel-core-template-callback.port.ts`** — NEW port:
   ```
   interface HotelCoreTemplateCallbackPort {
     updateWaTemplateStatus(input: { templateId: string; status: WaTemplateStatus; reason?: string; metaTemplateId?: string }): Promise<void>;
   }
   ```
   Adapter receives `{ baseUrl, path, internalSecret }` at construction — actual URL + secret plumbing deferred to Q-C-02 wiring time.
5. **`adapters/1engage-template.adapter.ts`** — implements `WhatsappTemplateManagementPort` via narrow `HttpPoster` injection (SAME pattern as T06's `1engage.adapter.ts:19-21` — no coupling to stubbed core HttpClient). Hits `${baseUrl}/${apiVersion}/${wabaId}/message_templates` with Bearer auth. Resubmit semantics per GAP #4 default. Upstream failure → `ExternalServiceError` (same class T06 uses, `service='1engage-template'`).
6. **`adapters/http-hotel-core-callback.adapter.ts`** — implements `HotelCoreTemplateCallbackPort`. Constructor `(deps: { http: HttpPoster; config: { baseUrl: string; path: string; internalSecret: string } })`. POST with `X-Internal-Secret` header (mirror T09 pattern client-side). Non-2xx → `ExternalServiceError`.
7. **`whatsapp-template.service.ts`** — orchestrator. Ctor `(bspPort: WhatsappTemplateManagementPort, hcCallback: HotelCoreTemplateCallbackPort, logger: Logger)`. Methods:
   - `submit(hotelId, input)` — PII-floor log (mask access token if present in input; log template name + category + hotelId; NO body components unless we determine they're low-risk — see security note below) → `bspPort.submitTemplate` → return result. Log includes `msg: 'whatsapp_template.submit', module: 'whatsapp'`.
   - `resubmit(hotelId, input)` — same shape.
   - `handleMetaStatusUpdate(event: TemplateStatusEvent)` — parse the Meta payload branch (`event` type + status), call `hcCallback.updateWaTemplateStatus`, log with `msg: 'whatsapp_template.status_update'`. See GAP #6 on signature verify (that's T12's plane, service is signature-agnostic).
   - All service methods use `import { maskTokenForLog } from '@shared/utils/masking.js'` for any secret fields, direct import (no ctor-inject — T10-a2 pattern).
8. **`whatsapp-template.schema.test.ts`** — happy path + each field failure for `SubmitTemplateInputSchema`, `ResubmitTemplateInputSchema`, `TemplateStatusEventSchema`, `HotelCoreCallbackPayloadSchema`. `.strict()` rejection tests. Category enum coverage. Status enum coverage.
9. **`whatsapp-template.service.test.ts`** — mock both ports (test-doubles at class-shape level, T10-a2 stopgap-free since ports ARE the boundary here — no Prisma involvement). Cases:
   - `submit` happy path, correct BSP call, correct return shape
   - `submit` PII-floor: `JSON.stringify(loggedPayload)` does NOT contain plaintext access token if present in input
   - `submit` upstream failure → `ExternalServiceError` propagates
   - `resubmit` happy path + upstream failure
   - `handleMetaStatusUpdate` → routes to correct HC callback with correct payload for both APPROVED and REJECTED
   - `handleMetaStatusUpdate` → HC failure → `ExternalServiceError` propagates
10. **`1engage-template.adapter.test.ts`** — mirror T06's `1engage.adapter.test.ts` shape (call-shape assertions on `HttpPoster.post`, non-2xx → `ExternalServiceError`, missing `messages[0].id` → `ExternalServiceError` variant per Meta response shape). Mock `HttpPoster` as `{ post: jest.fn() }`.
11. **`http-hotel-core-callback.adapter.test.ts`** — assert POST to `${baseUrl}${path}`, `X-Internal-Secret` header present with expected value (timing-safe not required client-side), 4xx/5xx → `ExternalServiceError`. Mock `HttpPoster`.
12. **`src/modules/whatsapp/index.ts`** — append new exports. Preserve T06 BSP + T10 config re-exports at top.
13. `make check` locally → drift scans → coverage → SUBMIT.

**Security floor** (CLAUDE §6):
- HC callback OUT auth: `X-Internal-Secret` header only. Never log the secret. Never log the full HC callback payload if it echoes tokens.
- Meta call OUT auth: Bearer token (from `wa_configs.access_token_enc` decrypted upstream in caller — see GAP #1 note on whether HC sends plaintext or ciphertext).
- Log floor: any access_token field in log = `maskTokenForLog(...)`. Template body content (marketing copy) is not PII; log full body OK.
- No hardcoded URLs (all via adapter config injected at construction).
- No `throw new Error` — use `ExternalServiceError` for upstream Meta/HC failures, `ValidationError` for schema parse failures if caught at service boundary.

**Deferred (out of T16 primitive, tracked as follow-ups)**

- **T16-followup** (routes for the inbound HC RPC + branch handler for Meta webhook status updates) — blocked on Q-C-02 (`api.ts` bootstrap) + T12 (Meta webhook router, which itself blocks on Q-A-04 for signature verify)
- **T16-INTEG** — cross-service integration test hitting a mock Meta gateway + mock HC server. Blocked on T16-followup + a test harness for internal RPC (does not exist yet in repo).

**GAPs / questions** (blocking PM B ACK before I write any code)

- **GAP T16-#1 — HC RPC payload shape**: Spec §2.4 signature is `submit_wa_template_to_meta(template_id)` — template_id only. But Meta's `/message_templates` needs `{ name, category, language, components[] }`. Does HC send us the full payload in the RPC body, or just `template_id` and we RPC HC back to fetch it? **Options**: A) HC sends full payload `{ template_id, name, category, language, components[], waba_id, access_token_or_encrypted_ref }` in the RPC body — spec RPC signature is shorthand for a richer payload; my default because it avoids a HC→us→HC round-trip and matches HC's existing `wa_templates` CRUD in `02-hotel-core.md §1.9` [my default] · B) HC sends only `{ template_id }` and we RPC HC back via a new `getWaTemplate(template_id)` internal RPC — cleaner separation, one extra hop, requires cross-service contract addition · C) block T16 until PO ratifies HC-side shape (`02-hotel-core.md §1.9`) — parking option.
- **GAP T16-#2 — `waba_id` (WhatsApp Business Account ID) storage location**: Meta's `/message_templates` requires WABA ID (an account-level identifier, distinct from `phone_number_id` which is per-phone-line). `wa_configs` DDL §4.1 has NO `waba_id` column. **Options**: A) HC sends `waba_id` in the RPC payload (see #1) — deferred to HC-side config, no schema change here [my default] · B) add `waba_id VARCHAR(80) NOT NULL` column to `wa_configs` — schema change, requires migration + Nathan/PM approval (analogous to Q-A-04 `app_secret`) · C) create new table `wa_business_accounts { waba_id PK, hotel_id FK, name, ... }` — cleaner if multi-WABA-per-hotel possible but likely overkill for MVP. **Should this be filed as sibling Q-A-04 (say Q-A-05) or handled inline via A?** — asking PM.
- **GAP T16-#3 — BSP port strategy: NEW port vs EXTEND T06's `WhatsappBspPort`**: T06's port has `sendText` + `sendTemplate` (message dispatch, hits `/messages`). Template CRUD (`submitTemplate` + `resubmitTemplate`) hits `/message_templates` — different Meta surface, different auth scope potentially. **Options**: A) NEW port `WhatsappTemplateManagementPort` at `ports/whatsapp-template-management.port.ts` — SRP, keeps T06's file byte-for-byte (matches PM B's T10-a2 preservation discipline) [my default] · B) extend existing `WhatsappBspPort` with `submitTemplate` + `resubmitTemplate` — cleaner conceptually but MUTATES T06's file · C) NEW port BUT under a sub-folder `ports/template/` (structural signal) — noise for one port.
- **GAP T16-#4 — Resubmit semantics (Meta has no `/resubmit`)**: Meta Graph API `/message_templates` supports POST (create) + DELETE, but there's no dedicated `/resubmit` endpoint. To "resubmit" a rejected template with edits, standard patterns: (a) DELETE old template by name/id + POST new with same name, (b) POST new with versioned name (`_v2`), (c) EDIT via PATCH if template is in `IN_REVIEW` (Meta added this in 2023). Spec §3.1 says "Relay `/resubmit` after edit" — that's shorthand. **Options**: A) my adapter implements resubmit as DELETE + POST atomic-ish sequence — closest to spec's "resubmit after edit" intent [my default] · B) implement as POST with `previous_template_id` metadata (fabricated field) — leaks abstraction · C) file operational Q to PO for canonical semantics, block T16 until answered. **Also — please confirm this is not a Q-CONTRACT ratification I'm missing (spec §10 mentions Q-CONTRACT-07 ratification for §2.7 endpoints)**.
- **GAP T16-#5 — HC callback endpoint contract**: We POST to HC at `updateWaTemplateStatus` — spec §3.1 mentions it, no URL/shape given here. HC-side callback URL, path convention, payload shape, expected HC response? **Options**: A) narrow port `HotelCoreTemplateCallbackPort` — adapter accepts `{ baseUrl, path, internalSecret }` at construction, PM/HC-team resolves exact path via config later [my default; matches T06 pattern] · B) hard-code the assumed `POST /internal/wa-templates/:id/status` with body `{ status, reason?, meta_template_id }` — clean if PM confirms, otherwise refactor churn later · C) block T16 until HC exposes contract in `02-hotel-core.md`.
- **GAP T16-#6 — Meta webhook signature verify for template status updates**: Meta pushes template status via `POST /webhook/whatsapp/:hotel_slug` — same T12 route that handles messages + receipts. Signature verify uses `app_secret` which is **Q-A-04 open** (existing). **My primitive service is signature-agnostic** (signature is verified at the router/plugin layer BEFORE the handler forwards the branch payload to me — service processes an already-trusted payload). **So T16 primitive is NOT blocked by Q-A-04**. Please confirm my read: service = signature-agnostic, router-layer plane handles verify at T12 land, `handleMetaStatusUpdate(event)` in my service accepts the parsed status-branch payload as trusted input. **Options**: A) my read stands, service builds now (signature layer parked to T12) [my default] · B) service also does a defensive re-verify — overengineered, breaks single-source-of-truth for signature · C) block T16 until Q-A-04 resolved.
- **GAP T16-#7 — Primitive scope depth: how many files ship**: T10-a2 shipped 7 files (very narrow). T17-a2 shipped 5 files (port+adapter primitive only). T16 nature is heavily port/adapter driven with TWO external systems. **Options**: A) my proposed 11-file default (7 source + 4 tests) — full primitive: types + schema + service + 2 ports + 2 adapters + 4 test suites [my default, ~ same "envelope" as PM B's T17-a2 22-test reference] · B) narrow to 7 files: types + schema + service + 2 ports + schema.test + service.test (adapters deferred to T16-B sub-task) — service testable via mocked ports · C) even narrower to 5 files: just BSP template management port + adapter + 1 test file (T17-a2 shape). Rest deferred as T16-followup / T16-B / T16-C sub-tasks. **PM B's call — I'll implement whichever shape is ACK-ed.**

Awaiting PM B ACK on GAPs #1–#7 (esp. #1 payload + #2 WABA storage + #7 scope depth) before writing any code.

##### PM B ACK-with-scope-narrow — T16 PLAN attempt 1 (H17, 2026-07-05) by PM B (Nanak)

**ACK conditional** on 3 changes below. NOT a REJECT — the design of the 11-file default is defensible, but per GAP #7 Executor explicitly offered narrower alternatives and per T10-a2 / T17-a2 precedent the narrow variant is the right shape. Also: 3 items are cross-service contracts I cannot decide alone — filing as **Q-B-01 / Q-B-02 / Q-B-03** with primitive built against explicit assumptions so refactor is targeted when PO/HC-team ratifies.

**Independent spec verification** (PM read):
- `04-integration-channels.md §1` L7 confirms "Does NOT own ... WA template approval CRUD (Hotel Core owns `wa_templates`)" — HC state ownership ✓
- `§2.4` L85-86 signatures `submit_wa_template_to_meta(template_id)` + `resubmit_wa_template_to_meta(template_id)` — payload shape ambiguous ✓ (Executor's GAP #1 is real spec-side gap)
- `§3.1` L108 flow narrative confirms 3-leg pattern (HC→us RPC, us→Meta relay, Meta→us→HC callback) ✓
- `§7` L346 template-not-approved permanent (no retry) — informs error class choice ✓
- `§10` L387 Q-CONTRACT-07 is designated for endpoint shape ratification — Executor's GAP #4 sub-question answered: yes this touches Q-CONTRACT-07 (broader ratification) but not blocking primitive
- `MVP §4.11` L110 shared-secret client-side pattern ✓
- **`waba_id`** — full spec search, ZERO mention. Real gap analogous to Q-A-04 (`app_secret`), affects `wa_configs` DDL §4.1 ✓
- **`02-hotel-core.md`** — file does NOT exist in this repo. HC-side template CRUD + callback contract undefined here ✓
- T06 port (`ports/whatsapp-bsp.port.ts`) — `sendText` + `sendTemplate` are `/messages` surface (message dispatch), distinct from `/message_templates` (template CRUD). GAP #3 A confirmed: separate concerns, NEW port + SRP + preserve T06.

---

**Scope decision — narrow to 9 files (drop HC callback adapter + its test)**:

Per T10-a2 / T17-a2 precedent + Executor's GAP #7 offering, ship **9 files (6 source + 3 tests + 1 barrel modify)**. Drop `http-hotel-core-callback.adapter.ts` + its test from attempt 1. Keep `hotel-core-template-callback.port.ts` as **type-only port** (no adapter) — service is testable via mocked port.

Rationale: the HC callback adapter has THREE undefined dependencies today — HC baseUrl (Q-C-02 env), HC endpoint path (Q-B-02 contract), HC internal secret (Q-C-02 env). Two shared-infra + one contract. Building against placeholders bakes assumptions likely to refactor when Q-B-02 resolves. BSP adapter, by contrast, targets a documented external API surface (Meta `/{waba_id}/message_templates` + 1engage pass-through per T06); the ONE unknown (`waba_id` per Q-B-01) enters via port input, not adapter config.

**Files to create** (6 source + 3 tests):
```
src/modules/whatsapp/whatsapp-template.types.ts
src/modules/whatsapp/whatsapp-template.schema.ts
src/modules/whatsapp/whatsapp-template.service.ts
src/modules/whatsapp/ports/whatsapp-template-management.port.ts
src/modules/whatsapp/ports/hotel-core-template-callback.port.ts       ← keep as port TYPE ONLY (no adapter this attempt)
src/modules/whatsapp/adapters/1engage-template.adapter.ts
src/modules/whatsapp/__tests__/whatsapp-template.schema.test.ts
src/modules/whatsapp/__tests__/whatsapp-template.service.test.ts
src/modules/whatsapp/__tests__/1engage-template.adapter.test.ts
```

**Files to modify** (1):
- `src/modules/whatsapp/index.ts` — append primitive exports (types, schemas, service class, 2 port types, 1 adapter factory). Preserve T06 BSP + T10 config blocks byte-for-byte at top.

**Files DROPPED from attempt 1 default** (defer to T16-followup):
- `src/modules/whatsapp/adapters/http-hotel-core-callback.adapter.ts` — parked until Q-B-02 resolves + Q-C-02 lands api.ts + env config
- `src/modules/whatsapp/__tests__/http-hotel-core-callback.adapter.test.ts` — paired with above

**Files explicitly NOT touched** — extends Executor's list: `prisma/*`, `api.ts`, `prisma-client.ts`, `plugins/*`, `package.json`/`pnpm-lock.yaml`, `core/http/http-client.ts` (still stub — will re-declare `HttpPoster` narrow interface inline in the BSP-template adapter per T06 precedent, NOT modify core), T06 primitive (`ports/whatsapp-bsp.port.ts`, `adapters/1engage.adapter.ts`, `__tests__/1engage.adapter.test.ts`) byte-for-byte, T10 primitive (`whatsapp-config.*`) byte-for-byte, `src/modules/telegram/*`, `src/modules/_template/*`.

---

**GAP decisions** (A/B/C per GAP with rationale):

- **GAP T16-#1 (HC → us RPC payload shape)** — **ESCALATE as Q-B-03** (see §3 mirror below). Primitive builds against assumption **A** (HC sends full payload `{ templateId, name, category, language, components[], wabaId, accessToken }` in RPC body) because: (a) avoids HC→us→HC round-trip that would need a separate RPC contract, (b) matches spec §3.1 narrative "HC RPCs this service which relays to Meta", (c) if PO ratifies B (template_id-only), the refactor is targeted at `whatsapp-template.schema.ts` + service ctor call sites (well-typed → compiler-driven). Explicit assumption stamped in schema docstring + SUBMIT §Notes. **Q-B-03 is Q-CONTRACT-07 territory** (spec §10 designates); Parent PM to route.

- **GAP T16-#2 (`waba_id` storage location)** — **ESCALATE as Q-B-01** (see §3 mirror below). Primitive builds against assumption **A** (`wabaId` accepted per-call in port input from HC RPC payload) — no schema change here, no `wa_configs.waba_id_enc` invented. If PO ratifies B (add column to `wa_configs`), that's a schema follow-up analogous to Q-A-04's `app_secret_enc` and belongs to slot A / Nathan. **Sibling to Q-A-04**; Parent PM to route.

- **GAP T16-#3 (BSP port strategy: NEW vs EXTEND)** — **A (NEW port `WhatsappTemplateManagementPort`)**. Rationale: (a) SRP — `/messages` (T06) and `/message_templates` (T16) are distinct Meta surfaces with potentially different Meta auth scopes; (b) preserves T06 file byte-for-byte per T10-a2 discipline; (c) barrel additive; (d) if Meta collapses the surfaces later, EXTEND is a targeted refactor. Sub-folder (option C) rejected — over-structure for one port.

- **GAP T16-#4 (Resubmit semantics — Meta has no `/resubmit`)** — **Adapter-implementation detail, NOT a Q**. The port contract `resubmitTemplate(input): Promise<{ metaTemplateId, status }>` is clean; adapter picks the strategy. **Recommended strategy for adapter docstring**: PATCH-if-editable-else-DELETE+POST (Meta added PATCH for `IN_REVIEW`/`REJECTED` in 2023 per your GAP body — that's the modern preferred path; fallback to DELETE+POST when PATCH not applicable). Adapter test covers PATCH branch + DELETE+POST fallback branch. **Not filing a Q — this is Meta external spec, not Qooma contract**. Executor's sub-question re Q-CONTRACT-07 is answered: it applies to broader endpoint shapes but not to this Meta-side implementation choice.

- **GAP T16-#5 (HC callback contract)** — **ESCALATE as Q-B-02** (see §3 mirror below). Primitive keeps the PORT (`HotelCoreTemplateCallbackPort` type only) so service is testable via port mock. **DROP the adapter and its test from attempt 1 per scope decision above** — build the adapter in T16-followup after Q-B-02 lands + Q-C-02 wires config. Parent PM to route (HC-team + PO ratification needed).

- **GAP T16-#6 (Meta webhook signature verify)** — **A confirmed**. Service is signature-agnostic; signature verify lives at router/plugin layer (T04 HMAC verifier is already merged, T12 will wire it into the WA webhook route). `handleMetaStatusUpdate(event)` receives a parsed status-branch payload as trusted input. Zod schema at `whatsapp-template.schema.ts` still validates STRUCTURE of the event (defense-in-depth type-safety), but NOT signature. Explicit note in service docstring.

- **GAP T16-#7 (scope depth)** — **modified B (9 files, not Executor's 7)** — see §Scope decision above. Executor's B (7 files) drops BOTH adapters; my 9-file variant keeps BSP adapter (spec-known surface) and drops only HC adapter (unratified contract). Coverage envelope reasonable: 3 tests ≈ T17-a2's 3 test files pattern; not a full 4-file test envelope but not the 2-file variant either. Adjust upward if a genuine 4th test cluster surfaces during coding (e.g., a `types.test.ts` for enum unions — allowed).

---

**Q escalations filed** (mirror rows appended to §3 below + PARENT §3a):

- **Q-B-01** (schema follow-up, sibling Q-A-04) — `waba_id` storage location. Blocks T16 router-layer + potentially T13 dispatch. Options A/B/C from GAP #2. PARENT §3a target.
- **Q-B-02** (cross-service contract) — HC callback endpoint contract (`updateWaTemplateStatus` URL + payload shape + response). Blocks T16-followup HC adapter. Needs PO + HC-team ratification. PARENT §3a target.
- **Q-B-03** (cross-service contract, Q-CONTRACT-07 territory) — HC → us RPC payload shape for `submit_wa_template_to_meta` / `resubmit_wa_template_to_meta`. Blocks T16 router-layer inbound RPC receiver. PARENT §3a target.

Primitive can build under assumptions A/A/A above without waiting for resolution — refactor when the Qs land is well-scoped (schema.ts + service ctor sites; not adapter code).

---

**Binding conditions for SUBMIT** (PM B will independent-verify on rerun — mirrors T10 ACK §14 pattern):

**Quality gate**
1. `make check` PASS end-to-end on your push — PM B rerun independently. Zero lint / format / typecheck / test failures.
2. Drift scans per `PM-AGENT.md §3 Step 2` on touched files — all 14 categories = 0 hits. Special attention: no `throw new Error(` (use `ExternalServiceError` for upstream Meta failures; `ValidationError` for zod-parse failures at service boundary).
3. Coverage: **100% stmt/branch/func/line** on `src/modules/whatsapp/whatsapp-template.*.ts` + `ports/whatsapp-template-management.port.ts` + `ports/hotel-core-template-callback.port.ts` + `adapters/1engage-template.adapter.ts`. Report coverage delta in SUBMIT. (`whatsapp-template.types.ts` erased at compile per ts-jest — expected.)

**Design gate (each MUST be present + provable via test evidence)**
4. **PII-floor log test present** — `whatsapp-template.service.test.ts` asserts `JSON.stringify(logger.info.mock.calls[N]?.[0])` does NOT contain plaintext `accessToken` (if present in submit/resubmit inputs). Same shape as T10-a2 service test.
5. **Direct helper imports only** — `whatsapp-template.service.ts` top has literal `import { maskTokenForLog } from '@shared/utils/masking.js'` (no ctor-inject). If crypto is touched (unlikely at primitive layer — HC payload spec says `accessToken` — mask it in log; but DECRYPT if HC sends `access_token_enc` is a wiring decision at T16-followup, not this primitive).
6. **No `throw new Error(`** — 0 hits on module scope. All upstream failures → `ExternalServiceError` w/ `service` tag (`'1engage-template'` for BSP, `'hotel-core-template-callback'` for HC — though HC adapter dropped this attempt). Schema-parse failures at boundary → `ValidationError`.
7. **Barrel additive-only** — `index.ts:1-7` T06 BSP re-export block byte-for-byte preserved; `:9-18` T10 config exports preserved. New template exports append after L18. Diff `+N net` where N reflects the new exports; git diff against main HEAD confirms preservation.
8. **Port type-only surface for HC callback** — `ports/hotel-core-template-callback.port.ts` contains ONLY the interface + input/output types. NO adapter reference. NO placeholder impl.

**Scope gate**
9. `git diff --stat main..HEAD` — must show exactly **6 source + 3 tests + 1 modify** = 10 lines in diff-stat. Any unexpected file = REJECT-scope. No `.gitignore`/`package.json`/`pnpm-lock.yaml` touch. No touches to T06 BSP files, T10 config files, `_template/*`, `telegram/*`, `plugins/*`, `api.ts`, `prisma-client.ts`, `prisma/*`, `core/http/*`.
10. `HttpPoster` interface **re-declared inline** in `1engage-template.adapter.ts` (mirror T06's `1engage.adapter.ts:19-21` — do NOT modify `core/http/http-client.ts`, that's stub / Q-C-02 territory).
11. **Meta template CRUD hits `/{waba_id}/message_templates`** in the adapter — assert URL construction in adapter test. Not `/messages` (T06's surface).
12. **`ExternalServiceError` service tag**: BSP adapter uses `service: '1engage-template'` (not just `'1engage'` — disambiguates from T06 in log grep).

**Assumption declarations (SUBMIT §Notes MUST spell out)**
13. **Q-B-01/02/03 assumption stamp** — service + schema docstrings + SUBMIT §Notes explicitly state: (a) primitive assumes `wabaId` arrives per-call in port input (Q-B-01), (b) HC callback contract stubbed as type-only port pending Q-B-02, (c) HC → us RPC payload assumed rich `{ templateId, name, category, language, components[], wabaId, accessToken }` (Q-B-03).
14. **Adapter `resubmit` strategy documented** — adapter file docstring explains PATCH-if-editable-else-DELETE+POST strategy + which Meta template states each branch handles + test coverage for both branches.

**Tolerated deviations to declare in SUBMIT §Notes**:
- HC callback adapter deferred to T16-followup (per GAP #5 → Q-B-02).
- Test-double at port-shape level (not Prisma) — no stopgap-declaration analogous to T10-a2 because there IS no Prisma in T16; ports ARE the boundary.
- Q-A-03 test-env workaround likely re-appears in service test (env-stamp in `beforeEach`) — cross-slot pattern with T10-a2 + T17-a2.

**Follow-ups to file in SUBMIT** (list, do NOT implement):
- **T16-followup** — routes for HC-facing inbound RPC + Meta webhook branch handler + HC callback adapter (`http-hotel-core-callback.adapter.ts` + its test). Blocked on Q-B-01 + Q-B-02 + Q-B-03 (contracts) + Q-C-02 (`api.ts` bootstrap + env for HC baseUrl/secret).
- **T16-INTEG** — cross-service integration test (mock Meta gateway + mock HC server + internal-RPC test harness). Blocked on T16-followup + Q-C-01/02.

**Do NOT file**:
- No new Q for GAP #4 (Meta resubmit semantics) — external Meta spec, adapter implementation detail.
- No new Q for GAP #3 — resolved by PM decision (A).
- No new Q for GAP #6 — confirmed (A), service is signature-agnostic; router-layer plane covers it.
- Reference Q-A-04 (WA `app_secret`) as router-layer blocker (T12 concern, not T16 primitive).

**Discipline**:
- Branch `feat/wa-template-relay` per CLAUDE §12.
- Conventional commit: `feat(whatsapp): T16 template relay primitive (types + schema + service + BSP port/adapter + HC-callback port)`.
- Single commit for the primitive shape (T10-a2 + T17-a2 pattern).
- Push branch; do NOT open PR until PM B rerun locally + says "open PR" in VERDICT.

**Rebuttal channel**: If the scope-narrow direction, GAP decisions, or any binding condition looks wrong for T16, post `REBUTTAL T16 item-#N` before coding — PM B re-checks in-session.

**No attempt-2 PLAN required** — GAP #7 explicitly offered variants for me to pick from; I picked (modified B, 9 files). Executor code directly per the 9-file inventory + Q-B-01/02/03 assumption stamps (binding #13) + adapter resubmit strategy documented (binding #14). Precedent: T17-a1 needed a re-PLAN because scope was invented; here scope was choose-from-menu, so we skip the re-PLAN round-trip.

#### SUBMIT T16 — exec-B (Nanak) at H17 01:04 (attempt 1, narrow primitive per PM ACK modified-B)

Task: T16 — WhatsApp template Meta relay **primitive** (types + schema + service + BSP template-management port + HC callback port TYPE-ONLY + 1engage template adapter). Narrow scope per PM ACK modified-B (9 files, HC callback adapter dropped to T16-followup). Branch: `feat/wa-template-relay` @ commit `1a5c20d`.

Files changed: **10** (9 create + 1 modify) — **1307 insertions** total (1281 new-file LOC + 26 net barrel delta).
- `src/modules/whatsapp/whatsapp-template.types.ts` (new, 75 LOC — post-prettier from 80)
- `src/modules/whatsapp/whatsapp-template.schema.ts` (new, 79 LOC)
- `src/modules/whatsapp/whatsapp-template.service.ts` (new, 166 LOC — post-prettier from 169)
- `src/modules/whatsapp/ports/whatsapp-template-management.port.ts` (new, 23 LOC)
- `src/modules/whatsapp/ports/hotel-core-template-callback.port.ts` (new, 19 LOC — **TYPE-ONLY**, no adapter this attempt)
- `src/modules/whatsapp/adapters/1engage-template.adapter.ts` (new, 189 LOC)
- `src/modules/whatsapp/__tests__/whatsapp-template.schema.test.ts` (new, 185 LOC, 18 tests)
- `src/modules/whatsapp/__tests__/whatsapp-template.service.test.ts` (new, 297 LOC — post-prettier from 293, 17 tests)
- `src/modules/whatsapp/__tests__/1engage-template.adapter.test.ts` (new, 248 LOC, 13 tests)
- `src/modules/whatsapp/index.ts` (modified, +26 net) — barrel additive; T06 BSP re-export block (L1-7) + T10 config exports (L9-18) byte-for-byte preserved

DoD self-check — **all 14 ACK binding conditions**:
- [x] **#1 `make check` PASS end-to-end** — lint 0/0 (`--max-warnings 0`), format-check clean, typecheck strict + `exactOptionalPropertyTypes`, test-unit 18/20 suites 184/186 tests (2 pre-existing `_template/*` baseline skips). PM B rerun invited.
- [x] **#2 Drift scans 0 hits on module scope** across all 6 EXECUTOR §4.4 categories. Pre-existing baseline hits confined to `_template/*` + `core/config/env.ts` + `core/http/http-client.ts` (all in PLAN §Files-NOT-touched). Detail in §Drift scans.
- [x] **#3 Coverage 100% stmt/branch/func/line** on 3 runtime files: `whatsapp-template.schema.ts`, `whatsapp-template.service.ts`, `adapters/1engage-template.adapter.ts`. Type-only files (`whatsapp-template.types.ts` + 2 port files) erased at compile per ts-jest — matches ACK #3 caveat. See §Test evidence.
- [x] **#4 PII-floor log test present** — `whatsapp-template.service.test.ts:117-134` "should NEVER include the plaintext accessToken in the log payload (PII floor)": asserts `JSON.stringify(logger.info.mock.calls[0]?.[0])` does not contain `PLAINTEXT_ACCESS_TOKEN`; logged `accessToken` field equals `maskTokenForLog(PLAINTEXT_ACCESS_TOKEN)`. Ordering test `:136-153` asserts `events: ['log', 'bsp']` — log fires BEFORE any external BSP call. Resubmit PII-floor test `:197-210` mirrors same shape.
- [x] **#5 Direct helper imports only** — `whatsapp-template.service.ts:28` `import { maskTokenForLog } from '@shared/utils/masking.js';` at top; no ctor-inject. Ctor at `:50-54` = `(bspPort, hcCallback, logger)`.
- [x] **#6 No `throw new Error(`** — 0 hits on module scope (drift scan #3 verified). Upstream Meta failures → `ExternalServiceError` with `service: '1engage-template'` (adapter L54). Upstream HC callback failures → `ExternalServiceError` with `service: 'hotel-core-template-callback'` (service `:159-163`). Schema-parse failures at boundary → `ValidationError` (service `:62`, `:97`, `:131`).
- [x] **#7 Barrel additive-only** — `src/modules/whatsapp/index.ts:1-7` T06 BSP re-export block byte-for-byte preserved vs `main`; `:9-18` T10 config block byte-for-byte preserved. New T16 exports appended L20-45 only. `diff` against `main` = +26 additive.
- [x] **#8 HC callback port TYPE-ONLY** — `ports/hotel-core-template-callback.port.ts` = 19 LOC total: docstring + single interface + type-only re-export from types.ts. NO adapter file. NO placeholder impl. NO adapter reference in any file (barrel doesn't re-export any adapter — `no-restricted-imports` rule blocks it, T06 discipline confirmed).
- [x] **#9 `git diff --stat main..HEAD` scope-clean** — exactly 9 create + 1 modify. Zero touches to `api.ts`, `prisma-client.ts`, `core/http/http-client.ts`, `plugins/*`, `prisma/schema.prisma`, `prisma/migrations/*`, `package.json`, `pnpm-lock.yaml`, `_template/*`, `telegram/*`, T06 BSP port/adapter/tests, T10 whatsapp-config.*. `.gitignore` unchanged.
- [x] **#10 `HttpPoster` re-declared inline** — `1engage-template.adapter.ts:38-42` declares narrow `HttpPoster` interface with `post` + `patch` + `delete` methods. Mirror of T06's `1engage.adapter.ts:19-21` pattern. Zero coupling to stubbed `core/http/http-client.ts`.
- [x] **#11 Meta template CRUD hits `/{waba_id}/message_templates`** — adapter `:82-84` `collectionUrl(wabaId)` builds `${baseUrl}/${apiVersion}/${wabaId}/message_templates`. `:86-88` `itemUrl(wabaId, metaTemplateId)` appends `/${metaTemplateId}` for PATCH/DELETE. Test `1engage-template.adapter.test.ts:73` asserts full URL `https://graph.facebook.com/v18.0/9876543210/message_templates` (submit) + `:154` for item URL (PATCH). NOT `/messages` (T06's surface).
- [x] **#12 `ExternalServiceError` service tag disambiguated** — adapter L54 `const SERVICE = '1engage-template';` (distinct from T06's `'1engage'`). Service `:160` uses `'hotel-core-template-callback'` for wrapped HC failures.
- [x] **#13 Q-B-01/02/03 assumption stamps present** — `whatsapp-template.types.ts:1-17` docstring explicitly stamps A/A/A with refactor-when-Qs-resolve markers. `whatsapp-template.schema.ts:1-14` stamps Q-B-03. `ports/whatsapp-template-management.port.ts:1-12` stamps Q-B-01. `ports/hotel-core-template-callback.port.ts:1-14` stamps Q-B-02 defer-to-followup.
- [x] **#14 Adapter `resubmit` strategy documented** — `1engage-template.adapter.ts:11-25` docstring explains PATCH-preferred + DELETE+POST fallback with 2023 Meta rationale + explicit branch handling ("template not editable in state APPROVED" example + spec §3.1 alignment). Test coverage: `1engage-template.adapter.test.ts:142-166` PATCH-success branch, `:169-199` PATCH-non-2xx→fallback branch, `:201-215` PATCH-network-reject→fallback branch, `:217-240` fallback-DELETE/POST failure branches.

Quality gate
- `make typecheck`: PASS (0 errors, strict + `exactOptionalPropertyTypes`)
- `make lint`: PASS (0 errors, 0 warnings — `eslint . --max-warnings 0`)
- `make format-check`: PASS (all matched files use Prettier code style)
- `make test-unit`: PASS (18 of 20 suites, 184 of 186 tests — 2 pre-existing baseline skips in `_template/*`; my 3 new suites 48/48 pass)
- `make check`: PASS end-to-end (concatenation of the above)

Drift scans (all 6 EXECUTOR §4.4 categories — 0 hits on my T16 files)
- `any` types: 0 (pre-existing 2 in `_template/*` untouched)
- `console.log/info/debug`: 0 (repo-wide 0)
- `throw new Error(` in `src/modules/` + `src/core/`: 0 in module scope (pre-existing 4 in `_template/_template.repository.ts:23`, `core/config/env.ts:75`, `core/http/http-client.ts:19,27` — all untouched)
- Forbidden imports: 0 (repo-wide 0)
- `^export default ` outside entrypoints/config: 0 (repo-wide 0)
- `.skip(` in `*.test.ts`: 0 in module scope (pre-existing 2 in `_template/*` untouched)

Security check (CLAUDE §6 + spec §4.1 + spec §4.11 + PM ACK security intent)
- **`ExternalServiceError` with `{status, body}` for Meta failures** — adapter `:112-120` non-2xx wraps `{ status, body }`; `:122-128` missing-template-id wraps `{ status, body }`; `:141-144` + `:172-175` network errors wrap `{ body }`. Same envelope T06 uses.
- **PII floor log with `maskTokenForLog` BEFORE any external call** — service `:68-79` (submit) + `:103-115` (resubmit) log lines fire before `bspPort.submitTemplate` / `bspPort.resubmitTemplate`. Ordering test verifies `events: ['log', 'bsp']`.
- **Unit test asserts `JSON.stringify` no-plaintext** — verified per DoD #4 above.
- **No plaintext token in any adapter call, response, or log** — adapter's `requestOptions(accessToken)` at `:90-97` uses token in `Authorization` header only (network-boundary requirement); log floor is service-layer above with masked values.
- **No secret hardcoded** — Meta URL via `OneEngageTemplateConfig.baseUrl` injected at construction; `wabaId` per-call per Q-B-01 assumption A stamp (from HC RPC payload); `accessToken` per-call from HC RPC payload (assumption Q-B-03 A). No `wa_configs.access_token_enc` decrypt in primitive (that's T16-followup wiring concern).

Test evidence
- Unit: **48 tests, 3 suites** — `whatsapp-template.schema.test.ts` (18), `whatsapp-template.service.test.ts` (17), `1engage-template.adapter.test.ts` (13)
- Integration: 0 — deferred as T16-INTEG follow-up (see §Follow-ups)
- Coverage (jest, scoped to 4 runtime files):
  ```
  File                           | % Stmts | % Branch | % Funcs | % Lines
  --------------------------------|---------|----------|---------|--------
  All files                      |   100   |   100    |   100   |   100
   whatsapp                      |   100   |   100    |   100   |   100
    whatsapp-template.schema.ts  |   100   |   100    |   100   |   100
    whatsapp-template.service.ts |   100   |   100    |   100   |   100
   whatsapp/adapters             |   100   |   100    |   100   |   100
    1engage-template.adapter.ts  |   100   |   100    |   100   |   100
  ```
  `whatsapp-template.types.ts` + `ports/whatsapp-template-management.port.ts` + `ports/hotel-core-template-callback.port.ts` — pure type declarations, erased at compile per ts-jest; not instrumented. Matches ACK #3 caveat.

Notes / tolerated deviations / discipline discoveries
- **Q-B-01/02/03 assumption stamps embedded** — `whatsapp-template.types.ts:1-17` (A/A/A summary with refactor markers), `whatsapp-template.schema.ts:1-14` (Q-B-03 stamp on schema), `ports/whatsapp-template-management.port.ts:1-12` (Q-B-01 stamp on `wabaId` per-call), `ports/hotel-core-template-callback.port.ts:1-14` (Q-B-02 defer-to-followup stamp). When PO/HC-team ratify Q-B-01/02/03, refactor sites are the stamped files — well-scoped.
- **Adapter re-exports BLOCKED by `no-restricted-imports`** — discovery during self-validate round 1: initial barrel re-exported `create1engageTemplateAdapter` factory and adapter config types, which the `.eslintrc.cjs no-restricted-imports` rule blocks (`'**/adapters/*'` pattern). Removed; T06 discipline confirmed (barrel exposes port interfaces + service class only; adapters wired at entrypoint via direct `./adapters/1engage-template.adapter.js` import when Q-C-02 lands `api.ts` bootstrap). Barrel delta dropped from +32 to +26.
- **HC callback adapter DROPPED** per PM ACK modified-B — filed as T16-followup below. Port kept as TYPE-ONLY interface.
- **PATCH-preferred resubmit strategy documented + tests cover both branches** — adapter docstring `:11-25` + adapter test suite has 3 tests covering PATCH-success, PATCH-non-2xx→DELETE+POST-fallback, PATCH-network-reject→DELETE+POST-fallback + failure paths on the fallback DELETE/POST.
- **Q-A-03 test-env workaround re-appearance** — NOT triggered in T16 service tests (no crypto/env dependency in primitive; ports mocked at class-shape level). No env stamping needed. Cross-slot pattern remains pending PM A resolution.
- **Prettier collapse** — `types.ts` 80→75 LOC and `service.ts` 169→166 LOC net delta after `pnpm prettier --write`; semantic content identical (multi-line optional-property widening + verb-wrapper single-line collapse). No exports added/removed/renamed vs PLAN §Approach.
- **Typecheck iteration — `exactOptionalPropertyTypes` mismatch** — round 3 of self-validate surfaced that my `WaTemplateComponent.text?: string` did not match zod-inferred `text?: string | undefined` under `strict` + `exactOptionalPropertyTypes: true`. Widened optional fields to `T | undefined`. Non-semantic, canonical fix.
- **Comment false-positive in drift scan** — `1engage-template.adapter.ts` docstring originally read "Upstream failure translation: any non-2xx..." which matched `: any` regex. Reworded to "every non-2xx" — semantic identical, scan-clean.

Q register / follow-ups
- **No new Q filed** — Q-B-01, Q-B-02, Q-B-03 filed in PM B ACK (H17 2026-07-05) and mirrored to PARENT §3a per PM authority. §3 mirror rows carry the tracking. All three under active PO / HC-team / Nathan routing.
- **T16-followup** — routes for HC-facing inbound RPC (`submit_wa_template_to_meta` + `resubmit_wa_template_to_meta`) + Meta webhook branch handler + HC callback adapter (`http-hotel-core-callback.adapter.ts` + its test). Blocked on Q-B-01 (waba_id resolution) + Q-B-02 (HC callback contract) + Q-B-03 (HC → us RPC payload) + Q-C-01 (`prisma-client.ts` singleton, if `wa_configs` needed) + Q-C-02 (`api.ts` bootstrap + env for `HC_BASE_URL` + `INTERNAL_SECRET`) + Q-A-04 (WA `app_secret` for Meta webhook HMAC verify at T12 router layer).
- **T16-INTEG** — cross-service integration test with mock Meta gateway + mock HC server + internal-RPC test harness. Blocked on T16-followup + Q-C-01/02.

Requesting PM B VERDICT.

##### VERDICT T16 — APPROVED (H17, attempt 1, primitive) by PM B (Nanak)

✅ **APPROVED**. Independent PM rerun on `feat/wa-template-relay @ 1a5c20d` (code) + `ef03a7b` (SUBMIT status). All 14 ACK binding conditions verified against code (file:line), not claim. Scope contained per ACK modified-B direction (9 files exact); HC callback adapter correctly dropped to T16-followup. Ready for PR + merge review.

**Independent verification trace** (rerun on PM shell, Node 22.23.1 + pnpm 9.0.0 via nvm/corepack):

- **`make check`** — **PASS end-to-end** (0.921s). `lint` clean (`eslint . --max-warnings 0`), `format-check` "All matched files use Prettier code style!", `typecheck` (`tsc --noEmit` strict + `exactOptionalPropertyTypes`) 0 errors, `test:unit` 18/20 suites passed (2 pre-existing `_template/*` baseline skips), 184/186 tests passed. My 3 new suites = 48/48 pass, 0 fail.
- **Drift scans (6 EXECUTOR §4.4 categories)** on T16 scope files (`whatsapp-template.*`, both new ports, `1engage-template.adapter.ts`, 3 test files) — all 0 hits: `any` = 0, `console.log/info/debug` = 0, `throw new Error(` = 0, forbidden imports = 0, `^export default ` = 0, `.skip(` / `describe.skip` = 0. Pre-existing baseline hits confined to `_template/*` + `core/config/env.ts` + `core/http/http-client.ts` (all in Files-NOT-touched list).
- **Coverage rerun** (`pnpm test:coverage --collectCoverageFrom='src/modules/whatsapp/whatsapp-template.*.ts' --collectCoverageFrom='.../ports/whatsapp-template-management.port.ts' --collectCoverageFrom='.../ports/hotel-core-template-callback.port.ts' --collectCoverageFrom='.../adapters/1engage-template.adapter.ts' --testPathPattern='(whatsapp-template|1engage-template)'`):
  ```
  File                           | % Stmts | % Branch | % Funcs | % Lines
  All files                      |   100   |   100    |   100   |   100
   whatsapp                      |   100   |   100    |   100   |   100
    whatsapp-template.schema.ts  |   100   |   100    |   100   |   100
    whatsapp-template.service.ts |   100   |   100    |   100   |   100
   whatsapp/adapters             |   100   |   100    |   100   |   100
    1engage-template.adapter.ts  |   100   |   100    |   100   |   100
  ```
  3 type-only files (`whatsapp-template.types.ts` + 2 port files) erased at compile per ts-jest — matches ACK #3 caveat.
- **`git diff --stat main..feat/wa-template-relay -- src/ prisma/ package.json pnpm-lock.yaml`** — exactly **9 create + 1 modify** = 10 files. Zero touches to `api.ts`, `prisma-client.ts`, `core/http/http-client.ts`, `plugins/*`, `prisma/schema.prisma`, `prisma/migrations/*`, `package.json`, `pnpm-lock.yaml`, `_template/*`, `telegram/*`, T06 BSP port/adapter/tests, T10 whatsapp-config.*.

**14 binding conditions — file:line evidence**:

- **#1 `make check` PASS** — PM rerun above. ✓
- **#2 Drift scans 0 hits on module scope** — PM rerun above. ✓
- **#3 Coverage 100%** — PM rerun above (3 runtime files). ✓
- **#4 PII-floor log test present** — `whatsapp-template.service.test.ts:117-134` submit PII-floor + `:197-210` resubmit PII-floor: `JSON.stringify(logger.info.mock.calls[0]?.[0])` excludes `PLAINTEXT_ACCESS_TOKEN`. **Extra rigor**: `:136-153` events-array ordering test proves log fires BEFORE `bspPort.submitTemplate` (`events: ['log', 'bsp']`). ✓
- **#5 Direct helper imports only** — `whatsapp-template.service.ts:28` literal `import { maskTokenForLog } from '@shared/utils/masking.js';`. Ctor at `:50-54` = `(bspPort, hcCallback, logger)` — no helper ctor-inject. ✓
- **#6 No `throw new Error(`** — drift scan #3 confirms 0 in module scope. Upstream Meta failures → `ExternalServiceError` w/ `service: '1engage-template'` (adapter `:113`, `:124`, `:142`, `:173`); HC failures → `ExternalServiceError` w/ `service: 'hotel-core-template-callback'` (service `:159-163`); schema-parse failures → `ValidationError` (service `:62`, `:97`, `:131`). ✓
- **#7 Barrel additive-only** — `src/modules/whatsapp/index.ts:1-7` T06 BSP re-export block byte-for-byte preserved vs `main`; `:9-18` T10 config block byte-for-byte preserved. New T16 exports appended L20-44 only. Diff-against-main = +26 net additive. ✓
- **#8 HC callback port TYPE-ONLY** — `ports/hotel-core-template-callback.port.ts` = 19 LOC total: docstring L1-13 (with Q-B-02 defer stamp) + type import L15 + single interface L17-19. NO adapter file present (verified: `ls src/modules/whatsapp/adapters/` shows only `1engage-template.adapter.ts` + T06's `1engage.adapter.ts` — HC adapter DROPPED per ACK modified-B). NO adapter re-export in barrel (would fail `no-restricted-imports`). ✓
- **#9 `git diff --stat` scope-clean** — PM rerun above. 9 create + 1 modify, zero cross-boundary touches. ✓
- **#10 `HttpPoster` re-declared inline** — `1engage-template.adapter.ts:38-42` declares narrow `HttpPoster` interface with `post` + `patch` + `delete` methods. Mirror of T06's `1engage.adapter.ts:19-21` pattern. Zero coupling to stubbed `core/http/http-client.ts`. ✓
- **#11 Meta template CRUD hits `/{waba_id}/message_templates`** — adapter `:82-84` `collectionUrl(wabaId)` builds `${baseUrl}/${apiVersion}/${wabaId}/message_templates`; `:86-88` `itemUrl(wabaId, metaTemplateId)` appends `/${metaTemplateId}` for PATCH/DELETE. Test `1engage-template.adapter.test.ts:32` COLLECTION_URL constant `'https://graph.facebook.com/v18.0/9876543210/message_templates'` asserted at L73 (POST), L154 for item URL (PATCH). NOT `/messages` (T06 surface). ✓
- **#12 `ExternalServiceError` service tag disambiguated** — adapter `:54` `const SERVICE = '1engage-template';` (distinct from T06's `'1engage'`). Service `:160` uses `'hotel-core-template-callback'` for wrapped HC failures. Both unique in log grep. ✓
- **#13 Q-B-01/02/03 assumption stamps present** — 4 files carry explicit stamps:
  - `whatsapp-template.types.ts:6-17` A/A/A summary with refactor markers
  - `whatsapp-template.schema.ts:5-13` + `:41-43` Q-B-03 stamp on HotelCoreSubmitRpcPayloadSchema
  - `ports/whatsapp-template-management.port.ts:9-11` Q-B-01 stamp (`wabaId` per-call)
  - `ports/hotel-core-template-callback.port.ts:6-13` Q-B-02 defer-to-followup stamp
  Refactor sites well-scoped when Qs resolve. ✓
- **#14 Adapter `resubmit` strategy documented + tests cover both branches** — `1engage-template.adapter.ts:11-25` docstring explains PATCH-preferred with DELETE+POST fallback + 2023 Meta editing rationale + spec §3.1 alignment. Test coverage in `1engage-template.adapter.test.ts:147-172` PATCH-success branch, `:174-198` PATCH-non-2xx→DELETE+POST fallback, `:200-214` PATCH-network-reject→DELETE+POST fallback, `:216-244` failure paths on the fallback DELETE/POST. Adapter `:149-164` tryPatch swallows errors and returns null (fallback trigger); `:166-178` deleteThenPost reuses `submitTemplate` after DELETE. ✓

**Prettier / typecheck iterations (SUBMIT §Notes L914-915) — accepted**:
- Prettier collapse `types.ts` 80→75 + `service.ts` 169→166 = semantic-identical formatting delta. Consistent with T10-a2 prettier note pattern.
- `exactOptionalPropertyTypes` widening on `WaTemplateComponent.text?: string` → `T | undefined` — canonical fix, non-semantic. Correctly applied at `types.ts:27-29` + `service.ts:153` (spread pattern for conditional `reason` field).

**Comment false-positive drift discovery (SUBMIT §Notes L916)** — original `"any non-2xx"` wording matched `: any` regex, reworded to `"every non-2xx"`. PM verify: current adapter docstring at `:23` reads `"every non-2xx or thrown network error"` — clean. ✓

**Discipline discovery (SUBMIT §Notes L910)** — adapter re-exports blocked by `no-restricted-imports` `'**/adapters/*'` pattern. PM verify: barrel `index.ts:20-44` exports only port INTERFACES + service CLASS + zod schemas + type DTOs. NO `create1engageTemplateAdapter` factory in barrel. Adapter wiring happens at entrypoint via direct `./adapters/1engage-template.adapter.js` import when Q-C-02 lands. T06 discipline confirmed cross-slot. ✓

**Spec-alignment audit**:
- Spec `04-integration-channels.md §2.4` L85-86 RPC signatures — service methods `submit(hotelId, payload)` + `resubmit(hotelId, payload)` map to `submit_wa_template_to_meta` / `resubmit_wa_template_to_meta` with hotelId separately (routing extracts from URL, per spec §2.2 slug pattern). Payload assumption A stamped at `types.ts:10-14`. ✓
- Spec `§3.1` L108 3-leg flow (HC→us RPC → us→Meta relay → Meta→us→HC callback) — service handles all 3 (`submit` + `resubmit` cover legs 1-2; `handleMetaStatusUpdate` covers leg 3). ✓
- Spec `§7` template-not-approved permanent — reflected via `WaTemplateStatus = 'REJECTED'` union member + no retry logic in primitive (retry belongs to T14 outbound retry queue, out of scope). ✓
- MVP `§4.11` shared-secret client-side pattern — reflected via `Q-B-02` port shape (`{ baseUrl, path, internalSecret }`); adapter deferred to T16-followup. ✓
- Meta API constraints — schema caps sensible: `TEMPLATE_NAME_MAX 512` (Meta ≤ 512), `COMPONENT_TEXT_MAX 1024` (Meta body ≤ 1024), `WABA_ID_MAX 80` (WABA IDs are numeric strings, 80 is generous), `LANGUAGE_CODE_MAX 20` (BCP-47 tags fit), `REASON_MAX 500`. ✓

**Security floor check (CLAUDE §6 + spec §4.1 + spec §4.11)**:
- **PII-floor log fires BEFORE any external call** — service `:68-79` submit log BEFORE `:81` `bspPort.submitTemplate`; `:103-115` resubmit log BEFORE `:117` `bspPort.resubmitTemplate`. Ordering asserted by events-array test. ✓
- **Access token masked in log** — `accessToken: maskTokenForLog(input.accessToken)` at service `:78` (submit) + `:114` (resubmit). Test `service.test.ts:131` `JSON.stringify(logged).not.toContain(PLAINTEXT_ACCESS_TOKEN)` + `:133` `logged.accessToken === maskTokenForLog(PLAINTEXT_ACCESS_TOKEN)`. ✓
- **Plaintext token only crosses BSP boundary (Authorization header)** — adapter `:90-97` `requestOptions(accessToken)` uses in `Bearer` header only. Adapter never logs the token. ✓
- **No hardcoded secrets** — Meta URL via `OneEngageTemplateConfig.baseUrl` injected at construction; `wabaId` per-call (Q-B-01 A); `accessToken` per-call (Q-B-03 A). Zero env references in module code. ✓
- **`ExternalServiceError` w/ `{status, body}` envelope for Meta failures** — adapter `:112-120` non-2xx wraps `{status, body}`; `:122-128` missing-id wraps; `:141-144` + `:172-175` network errors wrap. Same envelope T06 uses (Sentry-friendly). ✓
- **Signature-agnostic service** — `handleMetaStatusUpdate` receives already-verified payload (T04 HMAC + T12 router upstream). Structural zod re-parse via `TemplateStatusEventSchema.safeParse` at service `:129` = defense-in-depth. ✓

**Tolerated deviations accepted** (pre-declared per ACK expectations):
- Adapter re-exports blocked by `no-restricted-imports` — barrel discipline confirmed; adapter wired at entrypoint on Q-C-02 land.
- HC callback adapter dropped to T16-followup per ACK modified-B — NOT a "primitive gap"; it's the ratified scope choice.
- Prettier collapse `types.ts` + `service.ts` — semantic identical.
- Q-A-03 test-env workaround NOT triggered in T16 tests (no crypto/env dep in primitive) — cross-slot pattern remains pending PM A resolution.

**Follow-ups accepted** (files, do not action):
- **T16-followup**: routes for HC-facing inbound RPC + Meta webhook branch handler + HC callback adapter (`http-hotel-core-callback.adapter.ts` + its test). Blocked on Q-B-01 + Q-B-02 + Q-B-03 (contracts) + Q-C-01 + Q-C-02 (foundation) + Q-A-04 (T12 signature verify).
- **T16-INTEG**: cross-service integration test (mock Meta gateway + mock HC server + internal-RPC test harness). Blocked on T16-followup + Q-C-01/02.

**Actions taken**:
- → §1 task tracker row for T16 updated (`backlog` → `approved (primitive)` with `PM B (H17, a1)` verified-by).
- → PARENT §1 row for T16 mirrored (same status + notes shape as T10).
- → PARENT §2 short roll-up appended (1 line, format per `PM-AGENT.md §0.8`, append-at-bottom convention).

**Next expected action**: Executor B open PR on `feat/wa-template-relay` for PO merge review; PM B re-verify on CI green post-PR before recommending merge (same discipline as T10 pre-merge). **Slot B progress: 2/7 (T10 + T16 primitives)** · T11-T15 backlog (T11 skeleton could go next if Q-C-02 wiring becomes available in parallel with T13 outbound dispatch which depends on T06 already-merged + T09 already-merged). T16-followup + T16-INTEG parked pending Q resolutions.

### ASSIGNMENT T11 — claimed by exec-B (Nanak) at H17 14:25
- Branch: feat/wa-webhook-verify (will branch off `main` before first `src/` commit; PLAN commit lands on `main`)
- Routed from: PM-STATUS-B.md §8 queue (self-claim per EXECUTOR-PROTOCOL §3B — T04 HMAC + T10 config both merged, Q-C-01/02/03 do not block the primitive)

#### PLAN T11 — exec-B (Nanak) at H17 14:25

**Scope recap** (spec: `MVP-INTEGRATION-FIRST.md §1.2 B2` + `§5` AC L119 + `docs/spec/04-integration-channels.md §2.2` L45 + `§9` L373)

T11 = **verify-webhook action** — GM admin triggers our server to ping the hotel's configured WA webhook URL (`wa_configs.webhook_url`) to confirm reachability. AC (spec §5 L119):
- Success → `200 { verified: true, verified_at }` + update `wa_configs.verified_at` timestamp
- Failure → `422 WEBHOOK_VERIFICATION_FAILED` (spec §9 L373 error code, existing `WebhookVerificationError` at `src/core/errors/app-errors.ts:93`)

**Direction (critical)**: This is **outbound** (us → hotel's URL). Distinct from T12 (inbound Meta → us WA callbacks with `X-Hub-Signature-256`). Q-A-04 (`app_secret`, missing from `wa_configs`) applies to T12's HMAC verify, **NOT to T11** — verify-webhook uses no signature, no app_secret. See GAP #6.

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot B (Nanak) ✓
- CLAUDE.md loaded ✓
- Task spec read: `MVP-INTEGRATION-FIRST.md §1.2 B2` + `§5 AC L119` ✓ · `04-integration-channels.md §2.2 L45` (endpoint row) + `§3` (webhook flow narrative — confirms `X-Hub-Signature-256` is INBOUND Meta→us at T12, not this task) + `§9 L373` (`WEBHOOK_VERIFICATION_FAILED` = 422) + `§4.1` DDL `verified_at TIMESTAMPTZ NULL` ✓
- Parent docs spot-read: `docs/MODULE_TEMPLATE.md` (external-IO variant, port+adapter) · `src/plugins/hmac-validator.plugin.ts` (T04 — read confirms inbound-only signature verify; **not relevant to T11**) · `src/modules/whatsapp/whatsapp-config.service.ts` (T10 — exposes `webhookUrl: string` UNMASKED in domain L98; `webhookVerifyToken` IS MASKED in domain L99 — informs GAP #3) · `src/modules/whatsapp/whatsapp-config.repository.ts` (T10 — has `findByHotelId` + `upsert` only; NO `markVerified` — informs GAP #2) · `src/core/errors/app-errors.ts:93` (`WebhookVerificationError` extends `AppError` w/ status 422 + code `WEBHOOK_VERIFICATION_FAILED` — ready for reuse) · `prisma/schema.prisma:41` (`verifiedAt DateTime?` — nullable, `@updatedAt` NOT on it, so we control the write) · existing T06 + T16 `HttpPoster` re-declaration pattern (narrow inline interface per adapter) ✓
- Dependencies check:
  - T04 (HMAC verify plugin): MERGED on `main` — **not needed** for T11 (inbound-only) but session confirms plugin factory shape for future reference
  - T10 (WA config CRUD primitive): MERGED (`36462d2` PR #10) ✓ — my service consumes `WhatsappConfigService.getForHotel(hotelId)` for `webhookUrl` (unmasked, safe)
  - T16 (WA template Meta relay): MERGED (`95863c3` PR #12) ✓ — precedent for narrow port+adapter primitive shape
  - Q-C-01/02/03: **NOT blockers** for T11 primitive — no `api.ts` wiring, no session-auth (session guard is router-layer at T11-followup), no prisma singleton mutation
  - Q-A-04 (`app_secret`): **N/A for T11** — verify-webhook doesn't sign/verify HMAC (see GAP #6)
- `make typecheck`: PASS on `main` (Node 22 nvm + pnpm 9 corepack) ✓
- `make lint`: PASS on `main` ✓
- Scaffolder risk: **none proposed**. No `pnpm add`, no `pnpm dlx`, no `pnpm prisma generate` (no schema change).

**Files to create** (default proposal — see GAP #4 for narrower alternatives)

```
src/modules/whatsapp/whatsapp-webhook-verify.types.ts
src/modules/whatsapp/whatsapp-webhook-verify.schema.ts
src/modules/whatsapp/whatsapp-webhook-verify.repository.ts
src/modules/whatsapp/whatsapp-webhook-verify.service.ts
src/modules/whatsapp/ports/webhook-pinger.port.ts
src/modules/whatsapp/adapters/http-webhook-pinger.adapter.ts
src/modules/whatsapp/__tests__/whatsapp-webhook-verify.schema.test.ts
src/modules/whatsapp/__tests__/whatsapp-webhook-verify.repository.test.ts
src/modules/whatsapp/__tests__/whatsapp-webhook-verify.service.test.ts
src/modules/whatsapp/__tests__/http-webhook-pinger.adapter.test.ts
```

10 files (6 source + 4 tests) — matches T16 modified-B envelope (adjusted for the extra repo file needed for `verified_at` update, per GAP #2).

**Files to modify** (1)

- `src/modules/whatsapp/index.ts` — append primitive exports (types, schemas, service class, repo class, port interface). Preserve T06 BSP block (L1-7) + T10 config block (L9-18) + T16 template block byte-for-byte. **NOT** re-exporting adapter (T06 discipline, `no-restricted-imports` enforced — adapter wired at entrypoint).

**Files explicitly NOT touched**

- `prisma/schema.prisma`, `prisma/migrations/*` — no schema change (`verified_at` already exists per §4.1 DDL)
- `src/entrypoints/api.ts` — stub (Q-C-02); no wiring
- `src/core/prisma/prisma-client.ts` — stub (Q-C-01); repo imports `PrismaClient` type via `@prisma/client` (post `make prisma-generate`) — same pattern as T10
- `src/core/http/http-client.ts` — stub; adapter re-declares `HttpPoster` narrow interface inline (T06+T16 precedent)
- `src/plugins/*` — T04 HMAC plugin, T09 internal-RPC auth — neither relevant to T11 primitive; consumed at T11-followup router layer only
- `src/modules/whatsapp/ports/whatsapp-bsp.port.ts`, `adapters/1engage.adapter.ts`, `__tests__/1engage.adapter.test.ts` — T06 Nathan byte-for-byte
- `src/modules/whatsapp/whatsapp-config.*` — T10 byte-for-byte (my service CONSUMES `WhatsappConfigService` via barrel export — read-only integration; my new repo is a SIBLING file for the `verified_at` write, per GAP #2 A)
- `src/modules/whatsapp/whatsapp-template.*`, `ports/whatsapp-template-management.port.ts`, `ports/hotel-core-template-callback.port.ts`, `adapters/1engage-template.adapter.ts` — T16 byte-for-byte
- `src/modules/telegram/*` — slot C
- `src/modules/_template/*` — reference
- `package.json`, `pnpm-lock.yaml` — no dep add

**Approach**

Hexagonal Disiplin (CLAUDE §4 + ADR-0001): outbound HTTP to hotel's `webhook_url` is EXTERNAL IO → port + adapter WAJIB. Coding order:

1. **`whatsapp-webhook-verify.types.ts`** — domain types:
   - `WebhookVerificationOutcome = 'verified' | 'unreachable' | 'invalid_response'`
   - `WebhookVerificationDomain = { hotelId, verified: boolean, verifiedAt: Date | null, outcome: WebhookVerificationOutcome, statusCode?: number }` — result shape service returns
   - `PingWebhookInput` / `PingWebhookResult` — port I/O types
2. **`whatsapp-webhook-verify.schema.ts`** — zod for wire contract:
   - `WhatsappVerifyWebhookResponseSchema` (matches AC L119 → `{ verified: boolean, verifiedAt: z.date().nullable() }`). Request body: empty (route triggers on session — see T11-followup).
   - `.strict()` on both.
3. **`whatsapp-webhook-verify.repository.ts`** — class `WhatsappWebhookVerifyRepository(private readonly db: PrismaClient)`:
   - `markVerified(hotelId: string, verifiedAt: Date): Promise<WaConfig>` — Prisma `waConfig.update({ where: { hotelId }, data: { verifiedAt } })`.
   - No `findByHotelId` (that's T10's repo) — SRP.
   - See GAP #2 for placement rationale.
4. **`ports/webhook-pinger.port.ts`** — NEW port:
   ```
   interface WebhookPingerPort {
     ping(input: PingWebhookInput): Promise<PingWebhookResult>;  // { url } → { reachable, statusCode? }
   }
   ```
5. **`adapters/http-webhook-pinger.adapter.ts`** — implements pinger port:
   - Narrow `HttpPoster` re-declared inline with `get<T>(url, opts?): Promise<{data, status}>` method (only GET needed for reachability — see GAP #1 A default).
   - Constructor `(deps: { http: HttpPoster; config: { timeoutMs?: number } })`.
   - Any 2xx → `{ reachable: true, statusCode }`. Non-2xx → `{ reachable: false, statusCode }`. Network error → `{ reachable: false, statusCode: undefined }`.
   - `ExternalServiceError` NOT thrown on non-2xx (a failed reachability probe is a normal "invalid" outcome, not an upstream fault); thrown ONLY on programmer error (never in adapter). Service maps `reachable: false` → `WebhookVerificationError` (422) at the boundary.
6. **`whatsapp-webhook-verify.service.ts`** — orchestrator:
   - Ctor `(configService: WhatsappConfigService, verifyRepo: WhatsappWebhookVerifyRepository, pinger: WebhookPingerPort, logger: Logger)`.
   - Direct imports: `import { WebhookVerificationError } from '@core/errors/app-errors.js'` (existing 422 class); no crypto in T11 (no secret handling — webhook_url is not secret).
   - Method: `verifyForHotel(hotelId): Promise<WebhookVerificationDomain>`:
     - PII-floor log (mask webhook URL? No — URL is NOT a secret; it's a public endpoint by design. Log unmasked with hotelId).
     - Fetch config via `configService.getForHotel(hotelId)` → `NotFoundError` if not configured (from T10) — propagate.
     - Call `pinger.ping({ url: config.webhookUrl })`.
     - If reachable: `now = new Date()` → `verifyRepo.markVerified(hotelId, now)` → return `{ hotelId, verified: true, verifiedAt: now, outcome: 'verified', statusCode }`.
     - If not reachable: return `{ hotelId, verified: false, verifiedAt: null, outcome: 'unreachable', statusCode? }` — service returns the outcome; route layer at T11-followup maps to `WebhookVerificationError` (422) response. **My primitive does NOT throw for unreachable** — service returns a rich outcome; the future route decides the HTTP response.
   - Alternative: service throws `WebhookVerificationError` on unreachable (simpler for route). **Default: return outcome** (richer for logging + future retries).
7. **`whatsapp-webhook-verify.schema.test.ts`** — zod parse happy/fail for response shape.
8. **`whatsapp-webhook-verify.repository.test.ts`** — Prisma-mock stopgap (T10-a2 precedent): assert `db.waConfig.update({ where, data })` call shape. Docstring declares stopgap → T11-INTEG follow-up.
9. **`whatsapp-webhook-verify.service.test.ts`** — mock all 3 boundaries (config service, verify repo, pinger port), + logger spy:
   - Happy path: pinger returns reachable → repo.markVerified called → return `verified: true`.
   - Unreachable: pinger returns `{ reachable: false }` → repo.markVerified NOT called → return `verified: false, outcome: 'unreachable'`.
   - `NotFoundError` from configService propagates (hotel has no `wa_configs` row).
   - PII-floor log includes hotelId + outcome only; assert `JSON.stringify` does not contain… well, T11 primitive has no plaintext secrets to leak. PII floor test asserts log DOES contain the outcome + hotelId shape (positive assertion, since there's no secret to protect).
   - Log-before-repo-write ordering test (`events: ['log', 'ping', 'markVerified']`).
10. **`http-webhook-pinger.adapter.test.ts`** — narrow `HttpPoster` mock via jest.fn:
    - 200 response → `{ reachable: true, statusCode: 200 }`.
    - 500 response → `{ reachable: false, statusCode: 500 }`.
    - Network reject → `{ reachable: false, statusCode: undefined }`.
    - Verify URL exact + no auth header (webhook_url is public; no bearer token).
11. **`src/modules/whatsapp/index.ts`** — append T11 exports (types, schemas, service class, repo class, pinger port interface). No adapter export (T06 discipline).
12. `make check` → drift scans → coverage → SUBMIT.

**Security floor** (CLAUDE §6):
- No secrets in T11 — `webhook_url` is a public endpoint by design. No masking needed for URL in logs.
- No hardcoded URLs (all via `WhatsappConfigService.getForHotel` at runtime).
- No `throw new Error` — service uses existing `WebhookVerificationError` (422) OR returns outcome; adapter returns result object.

**Deferred (out of T11 primitive, tracked as follow-ups)**

- **T11-followup** — route `POST /api/integrations/whatsapp/verify-webhook` + Fastify handler + `gm_admin` session guard + `hotel_id` derivation from session. Blocked on Q-C-02 (`api.ts` bootstrap + zod↔Fastify shim) + Q-C-03 (JWT plugin + gm_admin RBAC).
- **T11-INTEG** — real-DB integration test for the `verified_at` update (testcontainers Postgres). Blocked on Q-C-01 (prisma singleton).

**GAPs / questions** (blocking PM B ACK before I write any code)

- **GAP T11-#1 — Ping semantics: reachability GET vs Meta subscription challenge simulation**: Spec §2.2 L45 says "pings the configured URL to confirm reachable" — the word "reachable" strongly suggests **simple reachability**. But Meta's canonical webhook verification uses a specific GET challenge: `GET webhook_url?hub.mode=subscribe&hub.verify_token=<stored>&hub.challenge=<random>`, expecting the hotel to echo the challenge in the body IF hub.verify_token matches `wa_configs.webhook_verify_token`. **Options**: A) simple GET, any 2xx = verified [my default — matches "reachable" spec wording; simpler + no plaintext-token accessor needed] · B) Meta challenge simulation — GET with hub params, expect challenge echo in body [more thorough — proves the hotel endpoint correctly implements Meta's subscription protocol; requires plaintext `webhook_verify_token`, see GAP #3] · C) POST test payload — unusual, spec doesn't hint at it.
- **GAP T11-#2 — `verified_at` update repository placement**: T10's `WhatsappConfigRepository` has `findByHotelId` + `upsert` only; T10 primitive is byte-for-byte protected per T10-a2 discipline. **Options**: A) **NEW file** `whatsapp-webhook-verify.repository.ts` with single `markVerified(hotelId, verifiedAt)` method — preserves T10 byte-for-byte, follows T10-a2 precedent [my default] · B) extend T10's `WhatsappConfigRepository` with `markVerified` — cleaner conceptually but MUTATES T10 (protected — sets a precedent for eroding byte-for-byte discipline) · C) service does Prisma call directly, skipping repository — violates MODULE_TEMPLATE convention.
- **GAP T11-#3 — Plaintext `webhook_verify_token` accessor (only relevant if GAP #1 = B)**: T10 domain masks `webhookVerifyToken` in `WhatsappConfigService.getForHotel` output. If GAP #1 resolves to B (Meta challenge), T11 needs plaintext access. **Options**: A) T11 repo (per GAP #2 A) adds a `findWebhookVerifyTokenPlaintext(hotelId)` method that reads the raw row directly — safe (same-module, purpose-specific, still logged with mask if surfaced) · B) extend T10 service with an unmasked accessor `getRawForVerify(hotelId)` — MUTATES T10 (protected) · C) direct Prisma in service. **Moot if GAP #1 = A** (my default), no plaintext needed.
- **GAP T11-#4 — Primitive scope depth**: **Options**: A) my proposed 10 files (6 source + 4 tests) — matches T16 modified-B envelope (which was 9 files; T11 has one extra file due to the verify-repo per GAP #2) [my default] · B) narrower 8 files: drop adapter + adapter test — service uses mocked port only. Adapter deferred to T11-followup. **Considered but not preferred** — pinger adapter is a spec-known surface (any-2xx=reachable) with no undefined dependencies (unlike T16's HC callback which had 3 undefined deps → deferred). No reason to defer · C) even narrower — same as T17-a1 shape (port+adapter only). Too narrow, misses AC.
- **GAP T11-#5 — Adapter method surface**: T06 `HttpPoster` has only `post`. T16 adds `patch` + `delete`. T11 pinger needs `get`. Options: A) re-declare narrow `HttpPoster` inline with just `get<T>(url, opts?): Promise<{data, status}>` [my default — matches T06/T16 discipline] · B) unify all three modules' `HttpPoster` in a shared file — cross-primitive change, mutates T06 territory · C) name the interface differently (e.g., `HttpGetter`) to signal narrowness — cosmetic, doesn't change substance.
- **GAP T11-#6 — Q-A-04 (WA `app_secret`) relevance to T11**: My read is **N/A**. Q-A-04 gap concerns HMAC signature verification of INBOUND Meta callbacks (POST /webhook/whatsapp/:hotel_slug at T12) via `X-Hub-Signature-256` signed with app_secret. T11 does the OPPOSITE direction (us → hotel URL, no signature, no auth header — the webhook_url is public by design). **Please confirm my read: T11 primitive does NOT depend on Q-A-04**. If PM disagrees, T11 blocks.
- **GAP T11-#7 — Service returns outcome vs throws on unreachable**: **Options**: A) service returns rich `WebhookVerificationDomain` with `verified: false, outcome: 'unreachable'` on failure — router layer at T11-followup maps to `WebhookVerificationError` (422) response [my default — richer for logging, retry hooks, future health-badge integration] · B) service throws `WebhookVerificationError` directly — simpler for router but loses richer outcome typing.

Awaiting PM B ACK on GAPs #1–#7 (esp. #1 ping semantics + #2 repo placement + #4 scope depth) before writing any code.

##### PM B ACK — T11 PLAN attempt 1 APPROVED, proceed to coding (H17, 2026-07-05) by PM B (Nanak)

**ACK on all 7 GAP defaults** — Executor's defaults align 1:1 with spec text + T06/T10/T16 precedent. No scope narrow needed (unlike T16). One design nuance (adapter NOT throwing `ExternalServiceError` on non-2xx) is semantically correct for a PROBE and gets an explicit binding condition.

**Independent spec verification** (PM read):
- `04-integration-channels.md §2.2 L45` — endpoint row reads "**Server pings configured webhook URL to confirm reachable**", role `gm_admin`. Word "reachable" is the operative semantics ✓
- `MVP §5 AC L119` — "**pings the configured URL. Returns `200 { verified: true, verified_at }` on success, `422 WEBHOOK_VERIFICATION_FAILED` on failure**" ✓
- `04 §9 L373` — `422 WEBHOOK_VERIFICATION_FAILED` canonical code ✓
- `04 §4.1 L184` — `verified_at TIMESTAMPTZ NULL` column present (T02 delivered) ✓
- `core/errors/app-errors.ts:92-95` — `WebhookVerificationError extends AppError` w/ `statusCode = 422`, `code = 'WEBHOOK_VERIFICATION_FAILED'` — ready for reuse ✓
- **Full spec search** — zero mention of `hub.mode`, `hub.verify_token`, `hub.challenge`, or any Meta subscription-challenge protocol anywhere in `docs/spec/`. GAP #1 B has **no spec support**; adopting it would invent scope. GAP #1 A ("simple reachability") is the spec-faithful reading.

**Q-A-04 confirmation** — verified via `prisma/schema.prisma` + `04 §4.1` + Executor's read: `app_secret` gap concerns HMAC verification of INBOUND Meta POSTs (T12 territory, `X-Hub-Signature-256`). T11 is OUTBOUND probe (us → hotel URL), no signature, no auth header, no `app_secret` dependency. Confirmed N/A.

---

**GAP decisions** (A/B/C per GAP with rationale):

- **GAP T11-#1 (ping semantics)** — **A** (simple reachability GET, any 2xx = verified). Spec §2.2 says "confirm reachable"; §5 AC returns just `{verified, verified_at}` — no challenge echo mechanic. Zero spec mention of `hub.*` params. Adopting B would invent Meta-protocol scope with no AC backing + require plaintext `webhook_verify_token` accessor (GAP #3), which cascades a T10-mutation temptation (rejected under GAP #2/#3). C rejected (POST test payload not spec-hinted).
- **GAP T11-#2 (repo placement)** — **A** (NEW sibling file `whatsapp-webhook-verify.repository.ts`). Rationale: T10 `WhatsappConfigRepository` byte-for-byte protected per T10-a2 VERDICT precedent + T06 + T16 uniform discipline. SRP — `markVerified` is a distinct concern from config CRUD. B (extend T10) erodes the discipline; C (direct Prisma in service) violates MODULE_TEMPLATE.
- **GAP T11-#3 (plaintext webhook_verify_token accessor)** — **MOOT under GAP #1 A**. No plaintext access needed for simple-reachability GET.
- **GAP T11-#4 (scope depth)** — **A** (10 files, adapter included). Rationale: unlike T16's HC callback which had 3 undefined deps (baseUrl Q-C-02, path Q-B-02, secret Q-C-02) forcing adapter-deferral, T11's pinger has ZERO undefined deps — spec-known any-2xx=reachable semantics, per-call `webhookUrl` from T10 config service. No reason to defer adapter. B/C rejected (would waste round-trip for a fully-defined external surface).
- **GAP T11-#5 (`HttpPoster` inline surface)** — **A** (per-adapter narrow inline redeclaration, `get<T>(url, opts?): Promise<{data, status}>` only). Rationale: T06 = `post`, T16 = `post/patch/delete`, T11 = `get`. Each adapter declares its own narrow surface inline. B (unify) mutates T06 protected territory + creates cross-primitive coupling; C (rename `HttpGetter`) is cosmetic-only, prefers consistent naming `HttpPoster` (misnomer accepted for T06/T16 consistency; docstring notes only GET is used).
- **GAP T11-#6 (Q-A-04 relevance)** — **N/A confirmed**. T11 primitive outbound probe has no signature verify surface. Q-A-04 blocks T12 inbound only.
- **GAP T11-#7 (service returns outcome vs throws)** — **A** (service returns rich `WebhookVerificationDomain`; route at T11-followup maps to HTTP 422 body per spec §5 AC + §9 code). Rationale: matches T16 pattern (return rich result, boundary errors thrown separately); testable primitives; future retries + health-badge integration can consume the structured outcome; FE gets `{outcome: 'unreachable', statusCode: 503}` for actionable diagnostics. B (throw at service) loses outcome typing + wastes rich info.

---

**Additional design decision (Executor's plan implicitly proposed)**:

- **Adapter does NOT throw `ExternalServiceError` on non-2xx / network error** — pushed back on for T06/T16 consistency but **ALLOWED here on principled probe semantics**. T06/T16 adapters call boundary services that MUST succeed (Meta message dispatch, Meta template CRUD); non-2xx there = incident. T11 adapter is a PROBE — non-2xx and network errors are LEGITIMATE outcomes of asking "is this URL reachable?" Throwing `ExternalServiceError` on every 404-from-hotel-misconfig would flood Sentry with non-actionable alerts. Adapter returns clean `{reachable, statusCode?}` result object; service boundary maps to `WebhookVerificationError` when route needs to emit 422. **Docstring MUST explain the deviation** (binding #14).

---

**Binding conditions for SUBMIT** (PM B will independent-verify — mirrors T10/T16 ACK 14-item pattern):

**Quality gate**
1. `make check` PASS end-to-end on your push — PM B rerun independently. Zero lint / format / typecheck / test failures.
2. Drift scans per `PM-AGENT.md §3 Step 2` on touched files — all 6 categories = 0 hits. Special attention: **NO `throw new Error(`** in module code; **NO `ExternalServiceError` thrown from `http-webhook-pinger.adapter.ts`** (probe-semantics ONLY — see design decision above); adapter returns result objects.
3. Coverage: **100% stmt/branch/func/line** on 4 runtime files (`whatsapp-webhook-verify.schema.ts`, `.repository.ts`, `.service.ts`, `adapters/http-webhook-pinger.adapter.ts`). Report coverage delta in SUBMIT. Type-only files (`whatsapp-webhook-verify.types.ts` + `ports/webhook-pinger.port.ts`) erased at compile per ts-jest — expected.

**Design gate (each MUST be present + provable via test evidence)**
4. **Simple GET, no `hub.*` params** — adapter test asserts URL is called EXACTLY as configured (no query-param mutation, no `?hub.mode=subscribe` appended). If PM greps the adapter for `'hub.mode'` / `'hub.verify_token'` / `'hub.challenge'` and finds any hit → REJECT-scope (invented Meta protocol scope).
5. **Adapter probe-semantics enforced** — 3 test cases MINIMUM:
   - 2xx (e.g. 200) → `{reachable: true, statusCode: 200}`
   - Non-2xx (e.g. 404 or 500) → `{reachable: false, statusCode: <n>}`
   - Network error / promise reject → `{reachable: false, statusCode: undefined}`
   
   NONE of the 3 cases throws `ExternalServiceError` (or any error). Verify via `expect(...).resolves.toEqual(...)` not `.rejects`.
6. **Adapter NO auth header** — verify-webhook doesn't send Bearer/Authorization (public endpoint per spec; hotel's URL owns its own auth). Test asserts no `Authorization` header sent, no bearer token in request options.
7. **Service `verifyForHotel` returns rich outcome, not throws on unreachable** — test asserts `expect(service.verifyForHotel(id)).resolves.toEqual({verified: false, outcome: 'unreachable', ...})` when pinger returns `{reachable: false}`. Repo `markVerified` NOT called in the unreachable path — assert `repo.markVerified` mock has 0 calls.
8. **Service PROPAGATES `NotFoundError` from `WhatsappConfigService.getForHotel`** — when no `wa_configs` row for hotel, T10 service throws `NotFoundError`; T11 service must let it bubble (do NOT wrap or swallow). Test asserts `expect(...).rejects.toBeInstanceOf(NotFoundError)`.
9. **`verified_at` update called with a `Date` object** — test asserts `repo.markVerified.mock.calls[0]` = `[hotelId, expect.any(Date)]`. Do NOT pass a string / ISO timestamp / epoch number — Prisma `TIMESTAMPTZ` binding expects `Date`.
10. **Barrel additive-only** — `index.ts` T06 block (L1-7), T10 block (L9-18), T16 block byte-for-byte preserved. T11 exports appended AFTER T16 block. NO adapter re-export (`no-restricted-imports` `'**/adapters/*'` T06 discipline confirmed cross-slot 3× now — do not test this rule again by trying).

**Scope gate**
11. `git diff --stat main..HEAD` — must show exactly **10 create + 1 modify** = 11 lines. No `.gitignore`/`package.json`/`pnpm-lock.yaml` touch. No touches to T06 BSP files, T10 config files, T16 template files, `_template/*`, `telegram/*`, `plugins/*`, `api.ts`, `prisma-client.ts`, `prisma/*`, `core/http/*`.
12. **`HttpPoster` narrow interface re-declared inline** in `http-webhook-pinger.adapter.ts` with ONLY `get<T>(url, opts?): Promise<{data, status}>` method. Zero coupling to `core/http/http-client.ts`. Docstring notes T06/T16 precedent + probe-only surface.

**Documentation gate**
13. **Log-shape assertion in service test (positive PII floor)** — since T11 has no plaintext secrets in-flow (webhook URL is public, no token access), the PII-floor test flips to **positive assertion**: assert `logger.info.mock.calls[0]?.[0]` matches a shape containing `{msg, module, hotelId, outcome, statusCode?}` and does NOT spread the full config object (defense-in-depth — if T10 domain evolves to embed a token by mistake, this test catches accidental log leak). At minimum, assert `JSON.stringify(logged).length < 500` (heuristic: full config leak would exceed).
14. **Adapter docstring explains probe-semantics deviation** — `http-webhook-pinger.adapter.ts` docstring block must have a paragraph like: "**Unlike T06/T16 adapters, this adapter does NOT throw `ExternalServiceError` on non-2xx.** T11 is a REACHABILITY PROBE — non-2xx and network errors are legitimate outcomes of asking 'is this URL reachable?' Throwing EE on hotel-misconfig would flood Sentry with non-actionable alerts. Result object `{reachable, statusCode?}` is returned in all outcomes; the boundary `WebhookVerificationError` (422) is emitted at the SERVICE / route layer, not adapter."

**Tolerated deviations to declare in SUBMIT §Notes** (pre-accepted):
- Prisma-mock stopgap in `.repository.test.ts` — T10-a2 / T16 stopgap precedent; T11-INTEG follow-up parked.
- `HttpPoster` misnomer accepted for T06/T16 naming consistency (only `get` used) — flag in adapter docstring.
- Adapter non-throwing behavior (design decision above) — declared explicitly in SUBMIT §Notes as accepted probe-semantics deviation from T06/T16.
- Service depends on T10's `WhatsappConfigService` for config read (module-internal dependency; T10 domain publicly stable) — NOT a port abstraction. Accepted; if T10 domain evolves, T11 rebuilds.

**No new Q filed** (all 7 GAPs decidable-by-PM-B). If Executor discovers a new spec/contract gap during coding, raise in SUBMIT `§Q register / follow-ups`.

**Follow-ups to file in SUBMIT** (list, do NOT implement):
- **T11-followup** — route `POST /api/integrations/whatsapp/verify-webhook` + Fastify handler + `gm_admin` session guard + `hotel_id` from session. Blocked on Q-C-02 (`api.ts` bootstrap + zod↔Fastify shim) + Q-C-03 (JWT plugin + gm_admin RBAC).
- **T11-INTEG** — real-DB integration test for `verified_at` update (testcontainers Postgres per CLAUDE §8). Blocked on Q-C-01 (prisma singleton).

**Discipline**:
- Branch `feat/whatsapp-verify-webhook` per CLAUDE §12.
- Conventional commit: `feat(whatsapp): T11 verify-webhook primitive (types + schema + repo + service + pinger port/adapter)`.
- Single commit for the primitive shape (T10/T16 pattern).
- Push branch; do NOT open PR until PM B rerun locally + says "open PR" in VERDICT.

**Rebuttal channel**: If any of the 14 conditions or GAP decisions above looks wrong for T11, post `REBUTTAL T11 item-#N` before coding — PM B re-checks in-session.

**No attempt-2 PLAN required** — all 7 GAPs answered by picking Executor's defaults (spec-aligned), no scope creep to narrow. Executor proceeds directly to coding per the 10-file inventory + binding conditions.

Proceed. Run `make prisma-generate` if not already (Q-A-03 test-env workaround likely re-appears in service test — pattern known cross-slot) → code per §Approach 1-11 → `make check` → SUBMIT.

#### SUBMIT T11 — exec-B (Nanak) at H17 15:20 (attempt 1, narrow primitive per PM ACK 10-file inventory)

Task: T11 — WhatsApp verify-webhook action **primitive** (types + schema + repo + service + pinger port + HTTP pinger adapter). Narrow scope per PM ACK — all 7 GAP defaults confirmed spec-aligned, no re-PLAN needed. Branch: `feat/wa-webhook-verify` @ commit `41ba8e6`.

Files changed: **11** (10 create + 1 modify) — **866 insertions** total (854 new-file LOC + 12 net barrel delta).
- `src/modules/whatsapp/whatsapp-webhook-verify.types.ts` (new, 31 LOC — post-prettier from 34)
- `src/modules/whatsapp/whatsapp-webhook-verify.schema.ts` (new, 26 LOC — post-prettier from 28)
- `src/modules/whatsapp/whatsapp-webhook-verify.repository.ts` (new, 22 LOC — sibling to T10 per GAP T11-#2 A, single `markVerified` method)
- `src/modules/whatsapp/whatsapp-webhook-verify.service.ts` (new, 84 LOC)
- `src/modules/whatsapp/ports/webhook-pinger.port.ts` (new, 20 LOC)
- `src/modules/whatsapp/adapters/http-webhook-pinger.adapter.ts` (new, 71 LOC — **probe-semantics**, no throw per binding #14)
- `src/modules/whatsapp/__tests__/whatsapp-webhook-verify.schema.test.ts` (new, 98 LOC, 9 tests)
- `src/modules/whatsapp/__tests__/whatsapp-webhook-verify.repository.test.ts` (new, 81 LOC, 3 tests)
- `src/modules/whatsapp/__tests__/whatsapp-webhook-verify.service.test.ts` (new, 281 LOC, 9 tests — post-prettier + branch-coverage add)
- `src/modules/whatsapp/__tests__/http-webhook-pinger.adapter.test.ts` (new, 140 LOC, 11 tests)
- `src/modules/whatsapp/index.ts` (modified, +12 net) — additive; T06 (L1-7) + T10 (L9-18) + T16 (L20-44) blocks byte-for-byte preserved; T11 exports L46-56

DoD self-check — **all 14 ACK binding conditions**:
- [x] **#1 `make check` PASS end-to-end** — lint 0/0 (`--max-warnings 0`), format-check clean, typecheck strict + `exactOptionalPropertyTypes`, test-unit 22/24 suites 216/218 tests (2 pre-existing `_template/*` baseline skips). PM B rerun invited.
- [x] **#2 Drift scans 0 hits on module scope** — all 6 EXECUTOR §4.4 categories. Special attention items verified: **NO `throw new Error(` in module code**; **NO `ExternalServiceError` thrown from `http-webhook-pinger.adapter.ts`** — `grep -n 'ExternalServiceError\|throw' src/modules/whatsapp/adapters/http-webhook-pinger.adapter.ts` returns 0 hits (probe-semantics enforced). Detail in §Drift scans.
- [x] **#3 Coverage 100% stmt/branch/func/line** on 4 runtime files: `whatsapp-webhook-verify.schema.ts`, `.repository.ts`, `.service.ts`, `adapters/http-webhook-pinger.adapter.ts`. Type-only files (`.types.ts` + `ports/webhook-pinger.port.ts`) erased at compile per ts-jest — matches ACK #3 caveat. See §Test evidence.
- [x] **#4 Simple GET, no `hub.*` params** — adapter `http-webhook-pinger.adapter.ts:61` `http.get<unknown>(input.url, requestOptions)` passes `input.url` verbatim. Test `http-webhook-pinger.adapter.test.ts:47-56` asserts `passedUrl === WEBHOOK_URL` + explicit `.not.toContain('hub.mode')` + `.not.toContain('hub.verify_token')` + `.not.toContain('hub.challenge')`. PM grep on adapter source for `'hub.mode'` / `'hub.verify_token'` / `'hub.challenge'` returns zero hits.
- [x] **#5 Adapter probe-semantics — 3-outcome coverage NONE throwing** — verified via `.resolves.toEqual(...)`:
  - 2xx (200) → `{reachable: true, statusCode: 200}` at test `:29-36`
  - 2xx (204) → `{reachable: true, statusCode: 204}` at test `:38-45`
  - Non-2xx (404) → `{reachable: false, statusCode: 404}` at test `:94-101`
  - Non-2xx (500) → `{reachable: false, statusCode: 500}` at test `:103-110`
  - Non-2xx (301, 3xx) → `{reachable: false, statusCode: 301}` at test `:112-119`
  - Network error (Error reject) → `{reachable: false}` at test `:125-131`
  - Network error (non-Error reject) → `{reachable: false}` at test `:133-139`
  All 7 result cases use `.resolves.toEqual(...)`; ZERO `.rejects` assertions on adapter tests.
- [x] **#6 Adapter NO auth header** — adapter L44-51 has no `headers` in `requestOptions`. Test `:58-68` asserts `if (passedOpts?.headers !== undefined) { expect(headerKeys).not.toContain('authorization'); }`.
- [x] **#7 Service returns rich outcome, no throw on unreachable** — service `:65-75` (unreachable branch) returns `WebhookVerificationDomain` with `verified: false, outcome, ...`. Test `service.test.ts:146-168` (network-error unreachable) + `:170-192` (invalid_response) both use `.resolves.toEqual(...)` and assert `expect(repoDouble.markVerified).not.toHaveBeenCalled()`.
- [x] **#8 Service PROPAGATES `NotFoundError` from `WhatsappConfigService`** — service has NO try/catch around `configService.getForHotel`. Test `:194-205` asserts `.rejects.toBeInstanceOf(NotFoundError)` + `expect(pingerDouble.ping).not.toHaveBeenCalled()` + `expect(repoDouble.markVerified).not.toHaveBeenCalled()`.
- [x] **#9 `verified_at` update called with a `Date` object** — service L46 `const verifiedAt = new Date()`. Test `:101-124` asserts `expect(passedTimestamp).toBeInstanceOf(Date)`.
- [x] **#10 Barrel additive-only** — `src/modules/whatsapp/index.ts`: T06 BSP block (L1-7) byte-for-byte vs `main`; T10 config block (L9-18) byte-for-byte; T16 template block (L20-44) byte-for-byte. T11 exports appended L46-56. `git diff main..HEAD -- src/modules/whatsapp/index.ts` = +12 additive, zero deletions. `grep -E "adapters/" src/modules/whatsapp/index.ts` → 0 hits (adapter NOT re-exported; T06/T10/T16 discipline confirmed 4× now).
- [x] **#11 `git diff --stat main..HEAD` scope-clean** — exactly 10 create + 1 modify. Zero touches to `api.ts`, `prisma-client.ts`, `core/http/http-client.ts`, `plugins/*`, `prisma/schema.prisma`, `prisma/migrations/*`, `package.json`, `pnpm-lock.yaml`, T06 BSP files, T10 config files (`whatsapp-config.*` byte-for-byte), T16 template files, `_template/*`, `telegram/*`.
- [x] **#12 `HttpPoster` narrow inline** — adapter `:33-35` declares `interface HttpPoster { get<T>(url: string, opts?: unknown): Promise<{ data: T; status: number }> }`. Only `get` (no post/patch/delete). Zero coupling to `core/http/http-client.ts`. Docstring L24-27 notes T06/T16 precedent + probe-only surface.
- [x] **#13 Log-shape positive PII floor** — service test `:220-238` asserts `logger.info.mock.calls[0][0]` `toEqual({msg, module, hotelId, outcome, statusCode})` **exactly** (not superset); `expect(JSON.stringify(logged).length).toBeLessThan(500)`; plus 3 negative assertions `.not.toContain(sampleConfig.accessToken)` + `.not.toContain(sampleConfig.webhookVerifyToken)` + `.not.toContain(sampleConfig.webhookUrl)` — catches accidental config-spread. Second log-shape test `:240-259` asserts the unreachable branch omits `statusCode` key entirely (`Object.keys(logged)).not.toContain('statusCode')`).
- [x] **#14 Adapter docstring explains probe-semantics deviation** — `http-webhook-pinger.adapter.ts:11-22` contains the full mandated paragraph: "**Unlike T06 / T16 adapters, this adapter does NOT throw `ExternalServiceError` on non-2xx or network errors. T11 is a REACHABILITY PROBE ... Throwing `ExternalServiceError` on every 404-from-hotel-misconfig would flood Sentry with non-actionable alerts. The result object `{ reachable, statusCode? }` is returned in all outcomes; the boundary `WebhookVerificationError` (422) is emitted at the SERVICE / route layer, not here.**"

Quality gate
- `make typecheck`: PASS (0 errors, strict + `exactOptionalPropertyTypes`)
- `make lint`: PASS (0 errors, 0 warnings — `eslint . --max-warnings 0`)
- `make format-check`: PASS (all matched files use Prettier code style)
- `make test-unit`: PASS (22 of 24 suites, 216 of 218 tests — 2 pre-existing baseline skips in `_template/*`; my 4 new suites 32/32 pass)
- `make check`: PASS end-to-end (concatenation of the above)

Drift scans (all 6 EXECUTOR §4.4 categories — 0 hits on T11 module files)
- `any` types: 0 (pre-existing 2 in `_template/*` untouched — same baseline as T10/T16 approved)
- `console.log/info/debug`: 0 (repo-wide 0)
- `throw new Error(` in `src/modules/` + `src/core/`: 0 in module scope (pre-existing 4 in `_template/*` + `core/config/env.ts:75` + `core/http/http-client.ts:19,27` — all untouched)
- Forbidden imports: 0 (repo-wide 0)
- `^export default ` outside entrypoints/config: 0 (repo-wide 0)
- `.skip(` in `*.test.ts`: 0 in module scope (pre-existing 2 in `_template/*` untouched)

Security check (CLAUDE §6 + spec §5 AC + PM ACK design intent)
- **NO throw for probe outcomes** — adapter L58-71 uses `try/catch` to convert network errors into `{reachable: false}` result; non-2xx handled by `isSuccessStatus` branch. Docstring L11-22 explains rationale (probe semantics, Sentry flood prevention). Grep for `throw` / `ExternalServiceError` in adapter source: 0 hits.
- **`WebhookVerificationError` at service/route boundary** — service returns rich `WebhookVerificationDomain` with `outcome` per PM B ACK GAP T11-#7 A; T11-followup router maps the non-verified outcome to `422 WEBHOOK_VERIFICATION_FAILED` (existing `core/errors/app-errors.ts:93` class). No T11-primitive code path throws `WebhookVerificationError`.
- **`NotFoundError` propagates** — service has NO try/catch around `configService.getForHotel`. Test `:194-205` verifies propagation + no downstream calls.
- **PII floor log-shape assertion** — service test `:220-238` uses `toEqual` (exact match, not superset), `JSON.stringify(logged).length < 500` heuristic, and 3 negative assertions on plaintext leak paths. Also asserts optional `statusCode` field is omitted (not `undefined`) when not applicable.
- **Simple GET no `hub.*` params** — adapter test `:47-56` explicit `.not.toContain` on the 3 Meta-protocol identifiers.
- **No auth header** — adapter test `:58-68` explicit.
- **`verified_at` as `Date`** — service L46 + test `:117-124` `expect(passedTimestamp).toBeInstanceOf(Date)`.
- No hardcoded URLs (all via `WhatsappConfigService.getForHotel` runtime read).
- No secret handling — T11 has no plaintext tokens in-flow (webhook URL is public by spec design).

Test evidence
- Unit: **32 tests, 4 suites** — `whatsapp-webhook-verify.schema.test.ts` (9), `whatsapp-webhook-verify.repository.test.ts` (3), `whatsapp-webhook-verify.service.test.ts` (9 including +1 branch-coverage), `http-webhook-pinger.adapter.test.ts` (11)
- Integration: 0 — deferred as **T11-INTEG** follow-up (see §Follow-ups); repository test uses Prisma-mock stopgap per T10-a2 / T16 precedent
- Coverage (jest, scoped to 4 runtime files):
  ```
  File                                    | % Stmts | % Branch | % Funcs | % Lines
  ----------------------------------------|---------|----------|---------|--------
  All files                               |   100   |   100    |   100   |   100
   whatsapp                               |   100   |   100    |   100   |   100
    whatsapp-webhook-verify.repository.ts |   100   |   100    |   100   |   100
    whatsapp-webhook-verify.schema.ts     |   100   |   100    |   100   |   100
    whatsapp-webhook-verify.service.ts    |   100   |   100    |   100   |   100
   whatsapp/adapters                      |   100   |   100    |   100   |   100
    http-webhook-pinger.adapter.ts        |   100   |   100    |   100   |   100
  ```
  `whatsapp-webhook-verify.types.ts` + `ports/webhook-pinger.port.ts` — pure type declarations, erased at compile per ts-jest, not instrumented. Matches ACK #3 caveat identically to T10/T16.

Notes / discipline discoveries
- **Round 3 self-validate — branch coverage gap identified + fixed** — first coverage run showed `whatsapp-webhook-verify.service.ts:54,61` uncovered (branch: reachable=true WITHOUT statusCode). Added test `service.test.ts:145-165` "should omit statusCode from the result AND the log when the pinger returned reachable=true without a statusCode" → coverage returned to 100% on all 4 metrics. Test count went 31 → 32.
- **Adapter probe-semantics distinct from T06/T16** — the docstring paragraph at L11-22 explains the deviation + Sentry flood rationale. Grep on adapter source for `ExternalServiceError` and `throw` both return 0 hits — the semantic deviation is complete and testable.
- **Prettier collapse deltas** — `types.ts` 34 → 31 LOC (multi-line union collapsed to single line), `schema.ts` 28 → 26 LOC (type re-export collapsed), `service.test.ts` 231 → 281 LOC (includes the +1 branch-coverage test added during round 3, semantic delta not just prettier). Semantic content otherwise identical to PLAN §Approach.
- **Actual test count 32 (not 35 estimated)** — my PLAN estimate over-counted adapter (13 → actual 11) and service (10 → actual 8 pre-branch-fix, 9 post-fix) test counts. Doesn't affect binding.
- **Q-A-04 N/A confirmed** — verified against T04 HMAC plugin scope (inbound-only), spec §2.3 (INBOUND signature verify direction), and adapter code (no signature-verify surface, no `app_secret` reference). T11 primitive is outbound-only probe.
- **Q-A-03 test-env workaround NOT triggered** — service tests use no crypto / no env-key seeding (T11 has no plaintext secrets in-flow). Not applicable to this primitive.
- **T10 sibling repository placement (per GAP T11-#2 A)** — `whatsapp-webhook-verify.repository.ts` is a new file with a single `markVerified(hotelId, verifiedAt)` method. T10's `WhatsappConfigRepository` is byte-for-byte preserved; SRP respected. Same Prisma table, different concern.

Tolerated deviations (pre-declared per ACK)
- **Prisma-mock stopgap in `whatsapp-webhook-verify.repository.test.ts`** — T10-a2 / T16 stopgap precedent. T11-INTEG follow-up parked awaiting Q-C-01 (prisma singleton). Stopgap declared in test docstring L1-6.
- **`HttpPoster` misnomer** — kept for T06/T16 naming consistency; only `get` used at this adapter; flagged in adapter docstring L24-27.
- **Adapter non-throwing behavior** — design decision per PM ACK; declared explicitly in adapter docstring L11-22 + this SUBMIT §Security check.
- **Service depends on T10's `WhatsappConfigService` for config read** — module-internal dependency (not a port abstraction). Accepted per ACK; if T10 domain evolves, T11 rebuilds.

Q register / follow-ups
- **No new Q filed** — all 7 PLAN GAPs resolved by PM B ACK defaults; no spec ambiguity surfaced during coding.
- **T11-followup** — route `POST /api/integrations/whatsapp/verify-webhook` + Fastify handler + `gm_admin` session guard + `hotel_id` from JWT session. Blocked on Q-C-02 (`api.ts` bootstrap + zod↔Fastify shim) + Q-C-03 (JWT plugin + gm_admin RBAC).
- **T11-INTEG** — real-DB integration test for `verified_at` update (testcontainers Postgres per CLAUDE §8). Blocked on Q-C-01 (prisma singleton).

Requesting PM B VERDICT.

##### VERDICT T11 — APPROVED (H17, attempt 1, primitive) by PM B (Nanak)

✅ **APPROVED**. Independent PM rerun on `feat/wa-webhook-verify @ 41ba8e6` (code) + `b269b02` (SUBMIT status). All 14 ACK binding conditions verified against code (file:line), not claim. All 7 GAP defaults confirmed spec-aligned. Adapter probe-semantics deviation from T06/T16 explicitly documented per binding #14. Ready for PR + merge review.

**Independent verification trace** (rerun on PM shell, Node 22.23.1 + pnpm 9.0.0 via nvm/corepack):

- **`make check`** — **PASS end-to-end** (1.625s). `lint` clean (`eslint . --max-warnings 0`), `format-check` "All matched files use Prettier code style!", `typecheck` (`tsc --noEmit` strict + `exactOptionalPropertyTypes`) 0 errors, `test:unit` 22/24 suites passed (2 pre-existing `_template/*` baseline skips), 216/218 tests passed. My 4 new suites = **32/32 pass, 0 fail**.
- **Drift scans (6 EXECUTOR §4.4 categories)** on T11 scope files (`whatsapp-webhook-verify.*`, `ports/webhook-pinger.port.ts`, `adapters/http-webhook-pinger.adapter.ts`, 4 test files) — **all 0 hits**: `any` = 0, `console.log/info/debug` = 0, `throw new Error(` = 0, forbidden imports = 0, `^export default ` = 0, `.skip(` / `describe.skip` = 0.
  - **Special-attention greps**: `hub.mode` / `hub.verify_token` / `hub.challenge` in adapter/service/schema/types source → **0 hits**. Present ONLY in `http-webhook-pinger.adapter.test.ts:52-54` as `.not.toContain(...)` negative assertions proving simple-GET binding.
  - `ExternalServiceError` in `http-webhook-pinger.adapter.ts` → 0 usages, present only in docstring L11 + L14 (documenting the non-throw deviation). `throw` in adapter → 0 hits.
- **Coverage rerun** (`pnpm test:coverage --collectCoverageFrom='src/modules/whatsapp/whatsapp-webhook-verify.*.ts' --collectCoverageFrom='.../ports/webhook-pinger.port.ts' --collectCoverageFrom='.../adapters/http-webhook-pinger.adapter.ts' --testPathPattern='(whatsapp-webhook-verify|http-webhook-pinger)'`):
  ```
  File                                    | % Stmts | % Branch | % Funcs | % Lines
  All files                               |   100   |   100    |   100   |   100
   whatsapp                               |   100   |   100    |   100   |   100
    whatsapp-webhook-verify.repository.ts |   100   |   100    |   100   |   100
    whatsapp-webhook-verify.schema.ts     |   100   |   100    |   100   |   100
    whatsapp-webhook-verify.service.ts    |   100   |   100    |   100   |   100
   whatsapp/adapters                      |   100   |   100    |   100   |   100
    http-webhook-pinger.adapter.ts        |   100   |   100    |   100   |   100
  ```
  2 type-only files (`whatsapp-webhook-verify.types.ts` + `ports/webhook-pinger.port.ts`) erased at compile per ts-jest — expected per ACK #3 caveat.
- **`git diff --stat main..feat/wa-webhook-verify -- src/ prisma/ package.json pnpm-lock.yaml`** — exactly **10 create + 1 modify** = 11 files. Zero touches to `api.ts`, `prisma-client.ts`, `core/http/http-client.ts`, `plugins/*`, `prisma/schema.prisma`, `prisma/migrations/*`, `package.json`, `pnpm-lock.yaml`, `_template/*`, `telegram/*`, T06 BSP port/adapter/tests, T10 `whatsapp-config.*`, T16 `whatsapp-template.*` + T16 ports/adapters/tests.

**14 binding conditions — file:line evidence**:

- **#1 `make check` PASS** — PM rerun above. ✓
- **#2 Drift scans 0 hits + probe-semantics special-attention gates** — PM greps above. ✓
- **#3 Coverage 100%** — PM rerun above (4 runtime files). ✓
- **#4 Simple GET, no `hub.*` params** — adapter `http-webhook-pinger.adapter.ts:60` `http.get<unknown>(input.url, requestOptions)` passes URL verbatim; test `.adapter.test.ts:47-56` explicit URL-match + 3 `.not.toContain(...)` assertions on `hub.mode` / `hub.verify_token` / `hub.challenge`. PM independent grep on adapter source: 0 hits. ✓
- **#5 Adapter probe-semantics — 3-outcome coverage NONE throwing** — verified via `.resolves.toEqual(...)` at `.adapter.test.ts`:
  - 2xx (200) L29-36 → `{reachable: true, statusCode: 200}`
  - 2xx (204) L38-45 → `{reachable: true, statusCode: 204}`
  - Non-2xx (404) L94-101 → `{reachable: false, statusCode: 404}`
  - Non-2xx (500) L103-110 → `{reachable: false, statusCode: 500}`
  - Non-2xx (301) L112-119 → `{reachable: false, statusCode: 301}`
  - Network reject (Error) L125-131 → `{reachable: false}` (no statusCode)
  - Network reject (non-Error) L133-139 → `{reachable: false}` (no statusCode)
  
  All 7 test cases use `.resolves.toEqual(...)` — ZERO `.rejects` on adapter. Adapter L58-63 catches network errors + returns clean result; L64-67 branches on `isSuccessStatus(res.status)`. ✓
- **#6 Adapter NO auth header** — adapter `:54-55` `requestOptions` = only `{ timeoutMs }` conditionally; no `headers` key. Test `.adapter.test.ts:58-68` inspects passed opts and asserts `headerKeys.not.toContain('authorization')` when headers present. ✓
- **#7 Service returns rich outcome, no throw on unreachable** — service `.service.ts:65-83` (unreachable + invalid_response branches) constructs `WebhookVerificationDomain` result + returns; NO `throw` in the entire file. Test `.service.test.ts:146-168` (network-error unreachable) + `:170-192` (invalid_response) use `.resolves.toEqual(...)` + assert `repoDouble.markVerified` NOT called (0 invocations). ✓
- **#8 Service PROPAGATES `NotFoundError`** — service `:41` `await this.configService.getForHotel(hotelId)` has NO surrounding try/catch. Test `:194-205` asserts `.rejects.toBeInstanceOf(NotFoundError)` + `pingerDouble.ping` NOT called + `repoDouble.markVerified` NOT called. ✓
- **#9 `verified_at` as `Date` object** — service `:46` `const verifiedAt = new Date()` + `:47` `verifyRepo.markVerified(hotelId, verifiedAt)`. Test `:117-124` asserts `expect(passedTimestamp).toBeInstanceOf(Date)`. Prisma binding safe for `TIMESTAMPTZ`. ✓
- **#10 Barrel additive-only** — PM inspected `src/modules/whatsapp/index.ts`: T06 BSP block (L1-7) byte-for-byte vs `main`; T10 config block (L9-18) byte-for-byte; T16 template block (L20-44) byte-for-byte. T11 exports appended L46-56 only. `git diff main..HEAD -- src/modules/whatsapp/index.ts` = +12 net additive. PM grep `adapters/` in barrel → 0 hits (adapter NOT re-exported, `no-restricted-imports` T06/T10/T16 discipline confirmed 4× now). ✓
- **#11 `git diff --stat` scope-clean** — PM rerun above. 10 create + 1 modify, zero cross-boundary touches. ✓
- **#12 `HttpPoster` narrow inline** — adapter `:32-34` declares `interface HttpPoster { get<T>(url: string, opts?: unknown): Promise<{ data: T; status: number }> }`. Only `get` method (no `post`/`patch`/`delete`). Zero coupling to `core/http/http-client.ts` (which remains stub). Docstring `:20-22` notes misnomer accepted for T06/T16 naming consistency + probe-only surface. ✓
- **#13 Log-shape positive PII floor** — service test `:220-238` asserts `logger.info.mock.calls[0][0]` `toEqual({msg, module, hotelId, outcome, statusCode})` **exact** (not superset); `JSON.stringify(logged).length < 500` heuristic; 3 negative assertions `.not.toContain(sampleConfig.accessToken)` + `.not.toContain(sampleConfig.webhookVerifyToken)` + `.not.toContain(sampleConfig.webhookUrl)`. Second log-shape test `:240-259` asserts unreachable-branch log omits `statusCode` key entirely (`Object.keys(logged).not.toContain('statusCode')`). ✓
- **#14 Adapter docstring explains probe-semantics deviation** — `http-webhook-pinger.adapter.ts:11-18` contains the mandated paragraph verbatim: "**Unlike T06 / T16 adapters, this adapter does NOT throw `ExternalServiceError` on non-2xx or network errors. T11 is a REACHABILITY PROBE — non-2xx and network errors are LEGITIMATE outcomes ... Throwing `ExternalServiceError` on every 404-from-hotel-misconfig would flood Sentry with non-actionable alerts. The result object `{ reachable, statusCode? }` is returned in all outcomes; the boundary `WebhookVerificationError` (422) is emitted at the SERVICE / route layer, not here.**" ✓

**Spec-alignment audit**:
- `04-integration-channels.md §2.2 L45` — "Server pings configured webhook URL to confirm reachable" → adapter is a simple GET to `input.url`, no signature/auth, no query params. ✓
- `MVP §5 AC L119` — `200 { verified, verified_at }` / `422 WEBHOOK_VERIFICATION_FAILED` → service returns `WebhookVerificationDomain` with `verified: boolean + verifiedAt: Date | null` shape; T11-followup router maps to HTTP response. ✓
- `04 §9 L373` — `WEBHOOK_VERIFICATION_FAILED` = 422 → maps to existing `WebhookVerificationError` at `core/errors/app-errors.ts:92-95`. Primitive service does not throw this (rich outcome); route layer emits. ✓
- `04 §4.1 L184` — `verified_at TIMESTAMPTZ NULL` → repo writes `Date`; Prisma binding correct for `Timestamptz`. ✓

**Security floor check (CLAUDE §6 + spec §5 + ACK design intent)**:
- **No plaintext secrets in T11 flow** — webhook URL is spec-public; no token access. PII-floor test flipped to positive-shape assertion + 3 defense-in-depth negative assertions on T10-domain plaintext leak paths. ✓
- **No throw for probe outcomes** — adapter `:59-63` try/catch converts network error to `{reachable: false}`; `:64-67` branches on `isSuccessStatus`. Docstring `:11-18` explains rationale. ✓
- **`NotFoundError` propagates** — service `:41` no try/catch. T10 `WhatsappConfigService.getForHotel` throws `NotFoundError` when no config; T11 lets it bubble to route. ✓
- **`WebhookVerificationError` at boundary only** — 0 usages in T11 primitive code; T11-followup router will emit per spec §5 AC. ✓
- **No hardcoded URLs** — runtime read from `configService.getForHotel(hotelId).webhookUrl`. ✓
- **No auth header sent** — adapter `:54-55` `requestOptions` optional-timeout-only. ✓

**Additional design observations** (all consistent with ACK expectations):
- **Service outcome discrimination** `:66-67` — `unreachable` (statusCode undefined = network error) vs `invalid_response` (statusCode present but non-2xx). Adds spec-legitimate granularity; T11-followup router can decide whether to return 502 (network) vs 422 (invalid), or map both to 422 per spec §5 AC. Non-breaking, future-flexible.
- **Ctor argument order** `:33-38` = `(configService, pinger, verifyRepo, logger)` — PM ACK spec-ed `(configService, verifyRepo, pinger, logger)` order; SUBMIT reorders `pinger` before `verifyRepo`. Semantic delta zero (all named args at wiring time); accepted as executor-preferred readability. Docstring `:1-17` lists all 4 deps clearly. Non-blocker.
- **Branch coverage add during round 3 self-validate** (SUBMIT §Notes L1318) — reachable-without-statusCode branch previously uncovered, added test at `:145-165`, coverage returned to 100%. Test count 31 → 32. Discipline evidence, not scope creep. ✓

**Tolerated deviations accepted** (all pre-declared per ACK):
- Prisma-mock stopgap in `.repository.test.ts` — T10-a2 / T16 stopgap precedent, T11-INTEG follow-up parked awaiting Q-C-01.
- `HttpPoster` misnomer accepted for T06/T16 naming consistency (only `get` used) — flagged in adapter docstring `:20-22`.
- Adapter non-throwing behavior — declared explicitly in docstring `:11-18` per binding #14.
- Service depends on T10's `WhatsappConfigService` (module-internal dependency, not port abstraction) — accepted per ACK.
- Prettier collapse `types.ts` 34→31, `schema.ts` 28→26, `service.test.ts` 231→281 (latter includes +1 branch-coverage test, not pure format delta) — semantic identical modulo the discipline test add. ✓

**Follow-ups accepted** (files, do not action):
- **T11-followup**: route `POST /api/integrations/whatsapp/verify-webhook` + Fastify handler + `gm_admin` session guard + `hotel_id` from JWT session. Blocked on Q-C-02 + Q-C-03.
- **T11-INTEG**: real-DB integration test for `verified_at` update (testcontainers Postgres per CLAUDE §8). Blocked on Q-C-01.

**Actions taken**:
- → §1 task tracker row for T11 updated (`backlog` → `approved (primitive)` with `PM B (H17, a1)` verified-by).
- → PARENT §1 row for T11 mirrored (same status + notes shape as T10/T16).
- → PARENT §2 short roll-up appended (1 line, format per `PM-AGENT.md §0.8`, append-at-bottom convention).

**Next expected action**: Executor B open PR on `feat/wa-webhook-verify` for PO merge review; PM B re-verify on CI green post-PR. **Slot B progress: 3/7 (T10 + T16 merged; T11 approved primitive)** · T12 (inbound ingest — blocked on Q-A-04 for HMAC verify + T05 tenant resolver already merged), T13 (outbound dispatch — deps T06+T09 merged, needs HC quota RPC contract), T14 (retry queue — deps T07 merged + T13), T15 (delivery receipts — deps T04+T12) backlog. T11-followup + T11-INTEG parked pending Q-C-01/02/03.

### ASSIGNMENT T12 — claimed by exec-B (Nanak) at H17 16:02
- Branch: feat/wa-webhook-ingest (will branch off `main` before first `src/` commit; PLAN commit lands on `main`)
- Routed from: PM-STATUS-B.md §8 queue (self-claim per EXECUTOR-PROTOCOL §3B — T04 HMAC + T05 tenant resolver + T10 config all merged; router-layer signature-verify concern is out-of-scope for primitive)

#### PLAN T12 — exec-B (Nanak) at H17 16:02

**Scope recap** (spec: `MVP-INTEGRATION-FIRST.md §1.2 B3` + `§4.2 §4.6 §4.7 §5 AC L120` + `docs/spec/04-integration-channels.md §2.3 §3.1 L110-118 §4.4 (webhook_events DDL) §7 L351 §9`)

T12 = **WA inbound webhook ingest** — 3-leg flow per spec §3.1:
1. Meta `POST /webhook/whatsapp/:hotel_slug` → HMAC signature verify (T04 plugin, router-layer). **Primitive is signature-agnostic** — plugin verifies BEFORE handler; my service consumes an already-trusted payload with `signatureValid: boolean` flag propagated to persistence.
2. Persist raw payload to `webhook_events` (spec §4.7 — persist immediately, return 200 within 10s).
3. Async worker resolves guest via HC RPC `upsert_guest_by_wa_phone(hotel_id, wa_phone, name?) → guest_id` (spec §3.1 L115).
4. Async worker fires AI RPC `inbound_wa_message(guest_id, body, hotel_id)` (spec §3.1 L116).

Following T16 modified-B discipline: **primitive only**. NO routes.ts, NO worker.ts, NO HC/AI adapters (deferred to T12-followup per Q-B-04/05 contract gaps). NO Prisma table added (`webhook_events` already in T02). NO `api.ts` / `plugins/*` / T04 mutation. Sibling repository file for `webhook_events` writes (T10/T11 sibling precedent, preserves T10 byte-for-byte).

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot B (Nanak) ✓
- CLAUDE.md loaded ✓
- Task spec read: `MVP-INTEGRATION-FIRST.md §1.2 B3` + `§4.2` (HMAC secret — see GAP #1) + `§4.6` (idempotency) + `§4.7` (persist-fast pattern) + `§4.11` (internal RPC auth) + `§5 AC L120` ✓ · `04-integration-channels.md §2.3 L73` (webhook endpoint contract, delivery-receipts + template-status in same stream — see GAP #7), `§3.1 L110-118` (3-leg flow narrative), `§4.4 L220-234` (webhook_events DDL — `id`, `hotelId`, `provider`, `receivedAt`, `signatureValid`, `payload`, `processedAt`, `processError` — **NO `external_id` / `dedup_key` column** — see GAP #5), `§7 L351` (retry policy: "retry from webhook_events queue"), `§9` (error codes) ✓
- Parent docs spot-read: `docs/MODULE_TEMPLATE.md` (external-IO variant, port TYPE-ONLY per T16 modified-B pattern) · `src/plugins/hmac-validator.plugin.ts` T04 (verified **secret-agnostic** — `resolveSecret` callback resolves at wiring time; my primitive is signature-agnostic) · `src/plugins/tenant-resolver.plugin.ts` T05 (slug→hotel_id — router-layer wiring, not primitive) · `src/modules/whatsapp/whatsapp-config.service.ts` T10 (no consumption needed at primitive — router uses tenant plugin) · `prisma/schema.prisma:72-83` `WebhookEvent` model — schema stable per §4.4 ✓
- Dependencies check:
  - T02 (Prisma init + `webhook_events`): MERGED on `main` ✓
  - T04 (HMAC verify plugin): MERGED — secret-agnostic; router-layer concern (Q-A-04 tension resolved at wiring time — see GAP #1)
  - T05 (tenant resolver plugin): MERGED — router-layer concern
  - T09 (internal RPC auth): MERGED — server-side for inbound receipts (out of scope T12 primitive); client-side for HC/AI calls (deferred to T12-followup adapters)
  - T10 (WA config primitive): MERGED — not consumed at primitive (webhook payload does not need config; token verify is plugin-layer at wiring)
  - Q-C-01/02/03: **NOT blockers** for T12 primitive (no api.ts wiring, no session, no adapter wiring)
  - Q-A-04 (`app_secret` vs `webhook_verify_token`): **N/A at primitive** — signature-agnostic; T12-followup router wiring decides which secret T04 plugin resolves against (see GAP #1)
- `make typecheck`: PASS on `main` (Node 22 nvm + pnpm 9 corepack) ✓
- `make lint`: PASS on `main` ✓
- Scaffolder risk: **none proposed**. No `pnpm add`, no `pnpm prisma generate` (no schema change).

**Files to create** (default proposal — see GAP #8 for narrower alternatives; matches T16 modified-B envelope)

```
src/modules/whatsapp/whatsapp-webhook-ingest.types.ts
src/modules/whatsapp/whatsapp-webhook-ingest.schema.ts
src/modules/whatsapp/whatsapp-webhook-events.repository.ts
src/modules/whatsapp/whatsapp-inbound-ingest.service.ts
src/modules/whatsapp/ports/hotel-core-guest-upsert.port.ts
src/modules/whatsapp/ports/ai-inbound-message.port.ts
src/modules/whatsapp/__tests__/whatsapp-webhook-ingest.schema.test.ts
src/modules/whatsapp/__tests__/whatsapp-webhook-events.repository.test.ts
src/modules/whatsapp/__tests__/whatsapp-inbound-ingest.service.test.ts
```

**9 files** (4 source + 2 TYPE-ONLY ports + 3 tests). Mirror of T16 modified-B envelope: 2 unratified cross-service RPC contracts (HC guest upsert + AI inbound) → both ports TYPE-ONLY, adapters to T12-followup.

**Files to modify** (1)

- `src/modules/whatsapp/index.ts` — append primitive exports (types, schemas, repository class, service class, 2 port interfaces). Preserve T06 (L1-7) + T10 (L9-18) + T16 (L20-44) + T11 (L46-56) blocks byte-for-byte. NO adapter re-export (`no-restricted-imports` T06 discipline, confirmed 4× now).

**Files explicitly NOT touched**

- `prisma/schema.prisma`, `prisma/migrations/*` — `webhook_events` schema stable per §4.4 (T02); no schema change (idempotency GAP #5 discusses column-add, filed as Q-B if needed — NOT executed in primitive)
- `src/entrypoints/api.ts`, `src/entrypoints/worker.ts` — stubs (Q-C-02); no wiring, no worker registration
- `src/core/prisma/prisma-client.ts` — stub (Q-C-01); repository imports `PrismaClient` type via `@prisma/client` (T10/T11 precedent)
- `src/plugins/hmac-validator.plugin.ts` T04 — router-layer signature-verify concern; consumed at T12-followup wiring only; **NOT MUTATED**
- `src/plugins/tenant-resolver.plugin.ts` T05 — router-layer slug→hotel_id concern; NOT MUTATED
- `src/plugins/internal-rpc-auth.plugin.ts` T09 — server-side inbound guard (irrelevant to Meta webhook route) + client-side outbound pattern (T12-followup adapter concern); NOT MUTATED
- T06 primitive (`ports/whatsapp-bsp.port.ts`, `adapters/1engage.adapter.ts`, adapter test) — byte-for-byte
- T10 primitive (`whatsapp-config.*`) — byte-for-byte
- T11 primitive (`whatsapp-webhook-verify.*`, `ports/webhook-pinger.port.ts`, `adapters/http-webhook-pinger.adapter.ts`, tests) — byte-for-byte
- T16 primitive (`whatsapp-template.*`, template ports + adapter) — byte-for-byte
- `src/modules/telegram/*` — slot C
- `src/modules/_template/*` — reference
- `src/core/http/http-client.ts` — stub; **NOT NEEDED** (primitive has no outbound HTTP — HC/AI adapters deferred)
- `package.json`, `pnpm-lock.yaml` — no dep add

**Approach**

Hexagonal Disiplin (CLAUDE §4 + ADR-0001): HC + AI RPCs are external IO → port + adapter WAJIB. Per T16 modified-B precedent (unratified contracts → adapter deferred), both ports are TYPE-ONLY in this primitive; adapters land in T12-followup once Q-B-04/05 ratify + Q-C-02 wires config.

Coding order:

1. **`whatsapp-webhook-ingest.types.ts`** — domain types:
   - `WebhookEventProvider = 'whatsapp' | 'telegram'` (matches DDL CHECK constraint)
   - `WebhookEventPersistenceInput = { hotelId, provider, signatureValid, payload }` — write shape
   - `WhatsappInboundMessage = { messageId, waPhone, body, timestamp, profileName? }` — extracted normalized message (from Meta envelope)
   - `IngestOutcome = { messageId, guestId?, dispatched: boolean, error?: string }` — per-message result of async worker leg
   - `GuestUpsertInput`, `GuestUpsertResult`, `AiInboundInput` — RPC port I/O types (Q-B-04/05 assumption A stamp)
2. **`whatsapp-webhook-ingest.schema.ts`** — zod for Meta inbound envelope + normalized message extraction:
   - `WhatsappInboundEnvelopeSchema` — Meta shape: `{ object: 'whatsapp_business_account', entry: [{ id, changes: [{ value: { messaging_product: 'whatsapp', metadata: {...}, contacts?: [...], messages?: [{id, from, timestamp, type, text?: {body}}], statuses?: [...] }, field: 'messages' }] }] }` — strict, `.strict()` on inner objects (Meta may add fields; outer envelope `.passthrough()` to survive spec drift).
   - `extractInboundMessages(envelope) → WhatsappInboundMessage[]` — pure helper. Skips non-message branches (statuses = delivery receipts → T15 concern per GAP #7).
   - `WhatsappInboundIngestResponseSchema` — sync-leg wire response for router: `{ eventId, isDuplicate }`.
3. **`whatsapp-webhook-events.repository.ts`** — sibling to T10/T11 pattern. Class `WhatsappWebhookEventsRepository(private readonly db: PrismaClient)`. Methods:
   - `persist(input: WebhookEventPersistenceInput) → WebhookEvent` — `db.webhookEvent.create({ data: {...} })`. Returns the persisted row (has `id`).
   - `findByPayloadMessageId(hotelId, messageId) → WebhookEvent | null` — JSON-path query for dedup (see GAP #5). NOT part of primitive if PM chooses D on GAP #5; then this method drops.
   - `markProcessed(eventId, processedAt) → WebhookEvent` — sets `processedAt = now`.
   - `markFailed(eventId, error) → WebhookEvent` — sets `processError` JSON.
   4 methods; test-double via jest.fn per T10/T11.
4. **`whatsapp-inbound-ingest.service.ts`** — orchestrator with sync + async legs. Ctor `(eventsRepo: WhatsappWebhookEventsRepository, guestPort: HotelCoreGuestUpsertPort, aiPort: AiInboundMessagePort, logger: Logger)`. Direct imports: `ExternalServiceError`, `ValidationError` from `@core/errors/app-errors.js`. Methods:
   - **`ingestSync(hotelId: string, signatureValid: boolean, envelope: unknown) → { eventId: string, isDuplicate: boolean }`** — zod parse envelope, persist raw payload with `signatureValid` flag, return `eventId`. Router calls this before returning 200. Dedup handled per GAP #5 decision (if C or D chosen, `isDuplicate` always `false` in primitive).
   - **`processEvent(eventId: string, hotelId: string, envelope: WhatsappInboundEnvelopeDto) → IngestOutcome[]`** — extract messages via schema helper, for each message: call `guestPort.upsertGuestByWaPhone` → get `guestId`, call `aiPort.inboundWaMessage(...)` → collect outcomes. On success: `eventsRepo.markProcessed(eventId, now)`. On any failure: `eventsRepo.markFailed(eventId, error)` + return outcomes with error markers. Rich outcome — never throws (worker discipline). Called by future async worker at T12-followup.
5. **`ports/hotel-core-guest-upsert.port.ts`** — TYPE-ONLY (Q-B-04 stamp):
   ```
   interface HotelCoreGuestUpsertPort {
     upsertGuestByWaPhone(input: GuestUpsertInput): Promise<GuestUpsertResult>;  // { hotelId, waPhone, name? } → { guestId }
   }
   ```
   Adapter deferred to T12-followup (per T16 precedent — HC contract unratified).
6. **`ports/ai-inbound-message.port.ts`** — TYPE-ONLY (Q-B-05 stamp):
   ```
   interface AiInboundMessagePort {
     inboundWaMessage(input: AiInboundInput): Promise<void>;  // { hotelId, guestId, body, messageId }
   }
   ```
   Adapter deferred to T12-followup.
7. **`__tests__/whatsapp-webhook-ingest.schema.test.ts`** — envelope parse: happy (single message), multi-message, delivery-receipt branch (statuses only, no messages — expect empty extract), edge cases (missing fields, unknown types, extra fields). `.strict()` rejection.
8. **`__tests__/whatsapp-webhook-events.repository.test.ts`** — Prisma-mock stopgap (T10-a2/T11 precedent). Call-shape assertions for persist / markProcessed / markFailed (+ findByPayloadMessageId if kept per GAP #5).
9. **`__tests__/whatsapp-inbound-ingest.service.test.ts`** — mock all 3 boundaries (repo, guestPort, aiPort) + logger spy. Cases:
   - `ingestSync` happy: persists with `signatureValid: true`, returns eventId.
   - `ingestSync` invalid signature: persists with `signatureValid: false` (audit trail per §4.7).
   - `ingestSync` schema parse fail → throws `ValidationError`.
   - `processEvent` happy: extracts N messages, calls guestPort N times + aiPort N times, marks processed.
   - `processEvent` guestPort fails → marks failed, returns outcome with error.
   - `processEvent` aiPort fails after guest resolved → marks failed, returns outcome with error + guestId.
   - `processEvent` no messages (delivery-receipt-only envelope) → skips guestPort/aiPort, marks processed with empty outcomes.
   - PII floor: `JSON.stringify(logger.info.mock.calls[N])` does not contain raw phone in log (mask via `maskWaPhone`); log-shape positive assertion.
10. **`src/modules/whatsapp/index.ts`** — append: types, schemas, repo class, service class, 2 port interfaces. Preserve prior blocks byte-for-byte at top.
11. `make check` → drift scans → coverage → SUBMIT.

**Security floor** (CLAUDE §6):
- `waPhone` masked via `maskWaPhone()` in log payloads (per T10 precedent).
- No plaintext secrets — `webhook_verify_token` / `app_secret` are router-layer at wiring (T04 plugin).
- No `throw new Error(` — schema-parse fails → `ValidationError`; HC/AI failures → wrapped `ExternalServiceError` (but note: async leg is failure-tolerant per worker discipline — errors recorded to `webhook_events.processError`).

**Deferred (out of T12 primitive, tracked as follow-ups)**

- **T12-followup** — route `POST /webhook/whatsapp/:hotel_slug` (public, no session, T04 signature-verified) + worker registration for async leg + HC guest-upsert adapter (`http-hotel-core-guest-upsert.adapter.ts`) + AI inbound adapter (`http-ai-inbound-message.adapter.ts`). Blocked on Q-B-04 (HC contract) + Q-B-05 (AI contract) + Q-C-02 (`api.ts` + `worker.ts` bootstrap + env for HC/AI baseUrls + secrets) + Q-A-04 (HMAC secret choice at plugin wiring per GAP #1).
- **T12-INTEG** — real-DB integration test for webhook_events persistence (testcontainers Postgres) + real-network integration for HC/AI adapters (mock servers). Blocked on Q-C-01 + T12-followup.

**GAPs / questions** (blocking PM B ACK before I write any code)

- **GAP T12-#1 — Q-A-04 vs MVP §4.2 contradiction on HMAC secret**: MVP §4.2 L92 says HMAC secret = **`wa_configs.webhook_verify_token`** (already in schema). Meta canonical docs say `app_secret` (not in schema; Q-A-04 filed by Nathan). Which is authoritative for MVP? **Options**: A) Follow MVP §4.2 explicitly — `webhook_verify_token` is the HMAC secret; Q-A-04 spurious for MVP scope · B) Follow Meta canonical — Q-A-04 real; blocks T12-followup route wiring (schema addition) · C) File clarification Q to PO. **My primitive is signature-agnostic** (T04 plugin owns this at wiring time); GAP is a router-layer decision. **Please confirm my read: T12 primitive does NOT depend on this choice**; router-layer T12-followup does.
- **GAP T12-#2 — Sync vs async processing split**: MVP §4.7 mandates persist-fast-return-200 pattern (sync leg) + async worker for HC/AI (async leg). **Options**: A) Single service class with 2 methods `ingestSync(hotelId, signatureValid, envelope) → { eventId, isDuplicate }` (router-called, fast) + `processEvent(eventId, envelope) → IngestOutcome[]` (worker-called) — matches spec pattern [my default] · B) Service handles everything synchronously (violates §4.7) · C) Only ship sync leg; async leg → T12-B sub-task (narrower but loses HC/AI orchestration meat).
- **GAP T12-#3 — HC `upsert_guest_by_wa_phone` RPC contract (potential Q-B-04)**: Spec §3.1 L115 gives signature `upsert_guest_by_wa_phone(hotel_id, wa_phone, name?) → guest_id` but no URL/path/response shape / error catalog. Analogous to Q-B-02 (T16 HC callback). **Options**: A) File as **Q-B-04**, port TYPE-ONLY, adapter deferred to T12-followup [my default per T16 modified-B precedent] · B) Hard-code assumption (URL `/internal/hc/guests/upsert-by-wa-phone`, body `{ hotelId, waPhone, name? }`) — refactor risk · C) Block T12 primitive.
- **GAP T12-#4 — AI `inbound_wa_message` RPC contract (potential Q-B-05)**: Spec §3.1 L116 gives signature `inbound_wa_message(guest_id, body, hotel_id)` — no URL/path/response. Same pattern as #3. **Options**: A) File as **Q-B-05**, port TYPE-ONLY, adapter deferred [my default] · B) Hard-code · C) Block.
- **GAP T12-#5 — Idempotency key derivation (potential Q-B-06)**: Spec §4.6 says "dedupe on `(provider, external_id)`" but `webhook_events` schema (per §4.4 + T02 Prisma model) has **NO `external_id` / `dedup_key` column**. Meta's `messages[0].id` is inside the `payload` JSON. **Options**: A) File as **Q-B-06** — schema addition `external_id VARCHAR(80)` on `webhook_events` (Nathan/T02 territory; analogous to Q-A-04); primitive persists WITHOUT dedup + assumes future column · B) Query on JSON path `payload->'entry'->0->'changes'->0->'value'->'messages'->0->>'id'` — SLOW at scale, works with current schema · C) Compute synthetic dedup key at runtime `(hotelId + provider + firstMessageId)` — no schema change but same JSON parse cost · D) **Skip dedup in primitive**; T12-INTEG covers dedup once schema decision made — narrower, defers hard question [my default; router-layer at T12-followup can add it after Q-B-06 resolves]. Please pick.
- **GAP T12-#6 — Persistence sequence in `ingestSync`**: Router calls T04 plugin (sig verify) → my service. Do we persist BEFORE or AFTER sig-verify branch? Schema has `signatureValid: boolean` field. **Options**: A) Router passes `signatureValid` flag to service; service persists ALWAYS with the flag (audit trail even for spoofed requests per DDL intent) [my default — matches schema shape] · B) Router persists only on `signatureValid: true`; service skipped on invalid (loses audit for spoofed) · C) Router persists directly (raw Prisma call); service just processes (removes T12 primitive value).
- **GAP T12-#7 — Delivery receipts + template status branch discrimination**: Spec §2.3 L73 — same `/webhook/whatsapp/:hotel_slug` endpoint carries: inbound messages (T12), delivery receipts (T15 — spec §1.2 L38 "part of B3"), template status updates (T16 — spec §3.1 template flow). Router at T12-followup must discriminate by payload branch. **Options**: A) T12 primitive service handles ONLY inbound-messages branch — payload arrives already discriminated by router; `extractInboundMessages(envelope) → []` when no `messages` present (delivery-receipt-only or template-status-only envelope) [my default; router forwards trusted per-branch payload — T15 + T16 services handle their branches independently] · B) T12 primitive service handles all 3 branches internally (cross-concern; T15/T16 primitive lose scope) · C) T12 primitive service parses full envelope + discriminates (loses SRP).
- **GAP T12-#8 — Primitive scope depth**: **Options**: A) my proposed 9 files (4 source + 2 type-only ports + 3 tests) — matches T16 modified-B envelope [my default; unratified HC/AI contracts justify adapter deferral analogous to T16 HC callback] · B) 11 files: include HC + AI adapters despite unratified contracts (invents URL/path/secret assumptions — refactor risk per T16 precedent) · C) 7 files: drop async leg (`processEvent`) — narrower but loses HC/AI orchestration meat.

Awaiting PM B ACK on GAPs #1–#8 (esp. #1 Q-A-04 tension, #2 sync/async split, #3/#4 RPC contracts, #5 idempotency) before writing any code.

##### PM B ACK-with-scope-narrow — T12 PLAN attempt 1 (H17, 2026-07-05) by PM B (Nanak)

**ACK conditional** on one file-inventory tightening (repository drops `findByPayloadMessageId` per GAP #5 D). Not a REJECT — all 8 GAP defaults defensible + spec-aligned; 3 items are cross-service / spec-side contracts I cannot decide alone → filing **Q-B-04 / Q-B-05 / Q-B-06** with primitive built against explicit assumptions so refactor is targeted when PO/HC/AI/Nathan ratify.

**Independent spec verification** (PM read):
- `MVP §4.2 L92` VERBATIM: "`/webhook/whatsapp/:hotel_slug` MUST verify `X-Hub-Signature-256` against the hotel's `wa_configs.webhook_verify_token`. `/webhook/telegram/:hotel_slug` MUST verify per Telegram's scheme. Reject with 401 if invalid. NO exceptions." → **Spec-explicit contradiction with Meta canonical** (Meta docs: `X-Hub-Signature-256` signed by App Secret, verify_token only for GET hub.verify_token challenge). Q-A-04 is the correct Meta-canonical read; MVP §4.2 wording is either drafting error or a deliberate MVP shortcut (using verify_token as makeshift HMAC secret since App Secret is not in schema).
- **T04 plugin genuinely secret-agnostic** — verified `src/plugins/hmac-validator.plugin.ts:38-43` `resolveSecret: ResolveSecret = (req) => string | Promise<string>` callback. Docstring L14-15: "The per-hotel secret is injected via `resolveSecret` (hexagonal-disiplin) — this primitive has no knowledge of tenant resolution or config storage." Plugin doesn't decide which secret; wiring-time choice. **Executor's read: correct.** T12 primitive genuinely doesn't depend on Q-A-04.
- `04-integration-channels.md §3.1 L115-116` RPC signatures verified — `upsert_guest_by_wa_phone(hotel_id, wa_phone, name?) → guest_id` + `inbound_wa_message(guest_id, body, hotel_id)`. Zero URL/path/response body shape. Analogous to Q-B-02 (T16 HC callback). Real contract gaps. ✓
- `04 §4.4 L218-232` `webhook_events` DDL verified: columns = `id, hotel_id, provider, received_at, signature_valid, payload, processed_at, process_error` + `webhook_events_provider_check` CHECK. **NO `external_id` / `dedup_key` column** confirmed. Prisma model `WebhookEvent` (schema.prisma:72-83) matches — no external_id. Spec `MVP §4.6` mandates `(provider, external_id)` dedupe → **real spec-drift**. Contrast: `outbound_dispatch_queue.external_id VARCHAR(80) NULL` (§4.5 L251) + `delivery_receipts.external_id VARCHAR(80) NOT NULL` (§4.6 L267) both have it — pattern established, just missing on `webhook_events`. Sibling to Q-A-04.
- `04 §4.4 L226` DDL has `signature_valid BOOLEAN NOT NULL` — DDL literally mandates persist-always-with-flag semantic. GAP #6 A is not a choice, it's the schema requirement.
- `04 §3.2 L311` — "**To AI (opaque)**: RPC only — `inbound_wa_message(guest_id, body, hotel_id)`. No DB FK." → confirms AI is external-service with no persistence coupling (adapter-only concern).
- Spec §3.1 3-leg flow (§4.7 persist-fast pattern) + §7 L351 "If processing fails, retry from `webhook_events` queue" → sync + async split is spec-mandated shape.

---

**GAP decisions** (all 8, A/B/C/D per GAP with rationale):

- **GAP T12-#1 (Q-A-04 vs MVP §4.2 HMAC secret contradiction)** — **N/A confirmed for primitive**. Executor read is correct: T04 plugin's `resolveSecret` callback pattern (verified above) makes primitive genuinely signature-agnostic. Router-layer T12-followup decides which secret at wiring time. **PM B interpretation vote** (appended to Q-A-04 register): recommend PO/Nathan resolve as follows — either (a) affirm Meta canonical (add `app_secret_enc VARCHAR + KMS`-encrypted column to `wa_configs`, analogous to `access_token_enc`) OR (b) explicitly ratify MVP §4.2 as MVP-scoped shortcut using `webhook_verify_token` as HMAC secret + amend Meta compatibility note. Either interpretation lands at plugin wiring, primitive unchanged. **Not blocking T12 primitive.**

- **GAP T12-#2 (sync/async split)** — **A** (single service class with 2 methods `ingestSync` + `processEvent`). Rationale: spec-mandated shape per `MVP §4.7` (persist-fast return-200 within 10s) + `04 §7 L351` retry-from-webhook-events queue. B (single sync) violates §4.7 timeout budget. C (drop async leg) loses HC/AI orchestration meat + primitive would be truncated. Executor A matches spec 1:1.

- **GAP T12-#3 (HC `upsert_guest_by_wa_phone` contract)** — **ESCALATE as Q-B-04** (see §3 mirror below). Port TYPE-ONLY in primitive per T16 modified-B precedent. Adapter (`http-hotel-core-guest-upsert.adapter.ts`) deferred to T12-followup pending Q-B-04 resolution + Q-C-02 wiring config. Primitive builds against assumption A (HC exposes single-shot RPC returning `{ guestId }`) with schema/types stamps.

- **GAP T12-#4 (AI `inbound_wa_message` contract)** — **ESCALATE as Q-B-05** (see §3 mirror below). Same shape as GAP #3: port TYPE-ONLY, adapter deferred to T12-followup. Primitive assumes fire-and-forget void response (spec §3.2 L311 "opaque, RPC only, no DB FK" — no return payload contract).

- **GAP T12-#5 (idempotency schema gap)** — **ESCALATE as Q-B-06** (see §3 mirror below) + **D** (skip dedup in primitive; DEFAULT confirmed). Rationale: sibling to Q-A-04 (spec-drift from schema). Executor B (JSON-path query) is slow at scale + would need to be REPLACED once schema-add lands (write-throw). Executor C (synthetic key) has same JSON-parse cost + still doesn't survive spec-reconciliation. **D is the T16 modified-B precedent** — dedup lands at T12-followup after Q-B-06 ratifies schema addition. **Concrete direction: DROP `findByPayloadMessageId` method from `WhatsappWebhookEventsRepository`.** Repository has 3 methods only: `persist`, `markProcessed`, `markFailed`. `WhatsappInboundIngestResponseSchema.isDuplicate` field kept in wire response as `boolean` (always `false` in primitive) so router contract survives Q-B-06 resolution — refactor at T12-followup fills `isDuplicate` semantics correctly.

- **GAP T12-#6 (persist-always with signatureValid flag)** — **A** (schema-mandated, not a choice). `webhook_events.signature_valid BOOLEAN NOT NULL` per §4.4 L226 = DDL-level guarantee. B (persist-only-if-valid) would leave the field with no semantic meaning + lose audit trail for spoof-investigation (docs/SECURITY.md audit intent). C (router persists, service just processes) removes primitive value + violates MODULE_TEMPLATE convention. Executor A is spec-mandated. **Router-layer contract**: T12-followup route MUST pass `signatureValid` flag to `ingestSync`; T04 plugin does NOT reject-with-401 for invalid sig on webhook route (per audit requirement), it sets a request decoration `req.signatureValid = false` that the route reads. Note this cross-references binding for T12-followup — outside T12 primitive scope but PM records here for continuity.

- **GAP T12-#7 (branch discrimination)** — **A** (T12 primitive handles inbound-messages branch ONLY). Spec §2.3 L73 endpoint carries 3 branches (inbound / delivery-receipts / template-status). T15 owns delivery-receipts, T16 already owns template-status (merged PR #12). Router discriminates by payload branch + forwards per-branch payload to per-primitive service. `extractInboundMessages(envelope)` returns `[]` for non-messages branches — service marks event `processed` with empty outcomes. B (T12 handles all 3) collapses SRP + duplicates T15/T16 scope. C (T12 parses full envelope + discriminates) loses SRP — router owns discrimination.

- **GAP T12-#8 (scope depth)** — **A** (9 files, T16 modified-B envelope). Rationale: 2 unratified cross-service contracts (Q-B-04/05) mirror T16 HC callback (Q-B-02) → adapter-defer pattern proven. B (11 files with adapters) invents URL/path/secret assumptions vs Q-B-04/05 unratified — refactor risk. C (7 files, drop async leg) contradicts spec §4.7 pattern.

---

**Q escalations filed** (§3 mirror below + PARENT §3a):

- **Q-B-04** (cross-service contract, HC-team + PO) — HC `upsert_guest_by_wa_phone` RPC endpoint contract (URL/path/payload/response/error catalog). Sibling to Q-B-02. Blocks T12-followup HC adapter.
- **Q-B-05** (cross-service contract, AI-team + PO) — AI `inbound_wa_message` RPC endpoint contract. Sibling to Q-B-04. Blocks T12-followup AI adapter.
- **Q-B-06** (schema follow-up, Nathan T02 territory) — `webhook_events.external_id VARCHAR(80) NULL` column addition + partial unique index `WHERE external_id IS NOT NULL`. Sibling to Q-A-04 pattern (spec drift from schema). Blocks T12-followup dedup. `MVP §4.6` mandates `(provider, external_id)` dedupe.

Primitive builds under assumptions with explicit stamps in `types.ts` + `schema.ts` docstrings — refactor sites well-scoped when Qs resolve.

**Q-A-04 update note** (PM B vote appended per GAP #1 verification): T04 plugin's `resolveSecret` callback pattern is genuinely secret-agnostic (verified `hmac-validator.plugin.ts:38-43` + docstring L14-15). T12 primitive builds without needing this resolved. PM B recommendation to PO: either (a) affirm Meta canonical → add `app_secret_enc` schema column analogous to `access_token_enc` (Nathan T02 follow-up); OR (b) explicitly ratify MVP §4.2 as MVP-shortcut using `webhook_verify_token` as HMAC secret + amend spec note. Non-blocking for primitive; blocks T12-followup route wiring only.

---

**Scope tightening (only material change from Executor's plan)**:

- **DROP `findByPayloadMessageId` from `whatsapp-webhook-events.repository.ts`** — repository has EXACTLY 3 methods: `persist`, `markProcessed`, `markFailed`. Test file drops the dedup-lookup test case. Reason: GAP #5 D. Dedup lands at T12-followup after Q-B-06 schema-add ratifies.
- **KEEP `WhatsappInboundIngestResponseSchema.isDuplicate: boolean`** in wire response schema — router contract survives Q-B-06 resolution. Service returns `isDuplicate: false` always in primitive; T12-followup fills semantics after schema-add.
- File count unchanged: still 9 files (4 source + 2 type-only ports + 3 tests) + 1 barrel modify.

**Files to create** (9 — unchanged from Executor's plan):
```
src/modules/whatsapp/whatsapp-webhook-ingest.types.ts
src/modules/whatsapp/whatsapp-webhook-ingest.schema.ts
src/modules/whatsapp/whatsapp-webhook-events.repository.ts        ← 3 methods only
src/modules/whatsapp/whatsapp-inbound-ingest.service.ts
src/modules/whatsapp/ports/hotel-core-guest-upsert.port.ts        ← TYPE-ONLY, Q-B-04 stamp
src/modules/whatsapp/ports/ai-inbound-message.port.ts             ← TYPE-ONLY, Q-B-05 stamp
src/modules/whatsapp/__tests__/whatsapp-webhook-ingest.schema.test.ts
src/modules/whatsapp/__tests__/whatsapp-webhook-events.repository.test.ts
src/modules/whatsapp/__tests__/whatsapp-inbound-ingest.service.test.ts
```

**Files to modify** (1): `src/modules/whatsapp/index.ts` — append T12 exports (types, schemas, repo class, service class, 2 port interfaces). Preserve T06 (L1-7) + T10 (L9-18) + T16 (L20-44) + T11 (L46-56) blocks byte-for-byte.

**Files explicitly NOT touched** — extends Executor's list: all confirmed. Special-attention: `hmac-validator.plugin.ts` (T04 secret-agnostic already, do NOT mutate), `tenant-resolver.plugin.ts` (T05 slug→hotel_id already, do NOT mutate), all prior primitive files byte-for-byte.

---

**Binding conditions for SUBMIT** (PM B independent-verify on rerun — 16-item pattern extending T11's 14 for T12's additional design gates):

**Quality gate**
1. `make check` PASS end-to-end on your push. Zero lint / format / typecheck / test failures.
2. Drift scans per PM-AGENT §3 Step 2 — 6 categories = 0 hits on T12 module files. Special attention: **NO `throw new Error(`** anywhere in module (schema-parse fails → `ValidationError`; sync-leg service parse fails → `ValidationError`); **NO `signature_valid: true` hardcoded** in service code (must come from ctor input to `ingestSync`); **NO `throw new WebhookVerificationError`** (that's T11 concern, unrelated).
3. Coverage **100% stmt/branch/func/line** on 3 runtime files (`whatsapp-webhook-ingest.schema.ts`, `whatsapp-webhook-events.repository.ts`, `whatsapp-inbound-ingest.service.ts`). Type-only files (`whatsapp-webhook-ingest.types.ts` + both ports) erased at compile per ts-jest — expected.

**Design gate (each MUST be present + provable via test evidence)**
4. **Repository has EXACTLY 3 methods** (`persist`, `markProcessed`, `markFailed`) — NOT 4. `findByPayloadMessageId` DROPPED per GAP #5 D. PM greps the repo file for the method name → 0 hits. Repository test file has 3 method's-worth of cases (not 4).
5. **Service is signature-agnostic** — `ingestSync(hotelId, signatureValid, envelope)` accepts `signatureValid: boolean` as ctor input parameter and passes it directly to `eventsRepo.persist({...signatureValid, ...})`. Service NEVER computes signature. Test case asserts both `signatureValid: true` AND `signatureValid: false` paths persist correctly.
6. **Persist-always audit trail** — service test explicitly covers `ingestSync(hotelId, false, envelope)` — persists with `signatureValid: false`, does NOT throw, returns `{eventId, isDuplicate: false}`.
7. **Async leg never throws (worker discipline)** — `processEvent` catches HC/AI failures and returns `IngestOutcome[]` with `error` fields set + calls `markFailed`. Test asserts `.resolves.toEqual(...)` not `.rejects` for all failure paths (guestPort failure, aiPort failure). Similar to T11 probe-semantics.
8. **Sync leg throws only `ValidationError` on bad envelope** — schema parse fail → `ValidationError` at boundary. Test asserts `.rejects.toBeInstanceOf(ValidationError)`. No other throw from `ingestSync`.
9. **`isDuplicate: false` always in primitive** — service test asserts `expect(result.isDuplicate).toBe(false)` in all sync-leg success cases. Docstring on schema notes Q-B-06 T12-followup will fill semantics.
10. **PII floor with `maskWaPhone`** — service test asserts `JSON.stringify(logger.info.mock.calls[N])` does NOT contain raw `waPhone` (e.g., `+6281234567890`); does contain masked form (e.g., `+628*******7890`). Positive log-shape assertion + negative plaintext assertion. Same shape as T10-a2/T11 pattern.
11. **Ports TYPE-ONLY** — both `ports/hotel-core-guest-upsert.port.ts` and `ports/ai-inbound-message.port.ts` = docstring + single interface + type imports only. No adapter file present. NO barrel re-export of any adapter. Same shape as T16 `hotel-core-template-callback.port.ts`.
12. **Q-B-04/05/06 assumption stamps** — 4 files carry explicit stamps:
    - `whatsapp-webhook-ingest.types.ts` docstring: A/A/D summary (Q-B-04 guest-upsert, Q-B-05 ai-inbound, Q-B-06 dedup deferred)
    - `whatsapp-webhook-ingest.schema.ts` docstring: Q-B-06 stamp on `isDuplicate` field (always false in primitive)
    - `ports/hotel-core-guest-upsert.port.ts` docstring: Q-B-04 stamp + T12-followup adapter defer
    - `ports/ai-inbound-message.port.ts` docstring: Q-B-05 stamp + T12-followup adapter defer

**Scope gate**
13. `git diff --stat main..HEAD` — must show exactly **9 create + 1 modify** = 10 files. Zero touches to `api.ts`, `worker.ts`, `prisma-client.ts`, `core/http/http-client.ts`, `plugins/*` (including T04 hmac-validator, T05 tenant-resolver — DO NOT modify), `prisma/*`, `package.json`, `pnpm-lock.yaml`, T06/T10/T11/T16 files, `_template/*`, `telegram/*`.
14. **Barrel additive-only** — T06 (L1-7) + T10 (L9-18) + T16 (L20-44) + T11 (L46-56) byte-for-byte preserved. T12 exports appended after L56. No adapter re-export.

**Documentation gate**
15. **Async-worker discipline docstring** — `whatsapp-inbound-ingest.service.ts` `processEvent` docstring explicitly notes: "Never throws — worker discipline. All failure paths return rich `IngestOutcome[]` with `error` fields set + call `markFailed`. Router/worker at T12-followup reads outcomes for observability; retry is via `webhook_events` queue per spec §7 L351."
16. **HMAC-agnostic docstring** — `whatsapp-inbound-ingest.service.ts` `ingestSync` docstring notes: "Signature verification lives at T04 HMAC plugin (router-layer preHandler); this service consumes `signatureValid` as a trusted boolean parameter. GAP T12-#1 (Q-A-04 vs MVP §4.2 secret-choice) is decided at wiring time — this primitive is genuinely agnostic."

**Tolerated deviations to declare in SUBMIT §Notes** (pre-accepted):
- Prisma-mock stopgap in `whatsapp-webhook-events.repository.test.ts` — T10/T11/T16 stopgap precedent; T12-INTEG follow-up parked awaiting Q-C-01.
- Q-B-04/05 adapters deferred to T12-followup — Q-B-04 (HC contract) + Q-B-05 (AI contract) unratified; adapter would bake assumptions.
- Q-B-06 dedup deferred + `isDuplicate: false` placeholder — schema-add is Nathan/T02 territory; primitive keeps wire contract stable.
- Q-A-03 test-env workaround MAY re-appear if service test needs env — cross-slot pattern, not on slot B to solve.

**Follow-ups to file in SUBMIT** (list, do NOT implement):
- **T12-followup** — public route `POST /webhook/whatsapp/:hotel_slug` + T04 plugin wiring (signature-verify with EITHER `webhook_verify_token` OR `app_secret_enc` per Q-A-04 resolution) + T05 tenant-resolver plugin wiring + worker registration for async leg + HC guest-upsert adapter + AI inbound adapter. Blocked on Q-A-04 + Q-B-04 + Q-B-05 + Q-C-02 (api.ts / worker.ts bootstrap + env config).
- **T12-INTEG** — real-DB integration test for `webhook_events` persistence (testcontainers Postgres) + mock HC + mock AI test harness. Blocked on Q-C-01 + T12-followup.

**Discipline**:
- Branch `feat/wa-webhook-ingest` per CLAUDE §12.
- Conventional commit: `feat(whatsapp): T12 inbound webhook ingest primitive (types + schema + repo + service + HC/AI ports type-only)`.
- Single commit for the primitive.
- Push branch; do NOT open PR until PM B rerun locally + says "open PR" in VERDICT.

**Rebuttal channel**: If any of the 16 conditions, 8 GAP decisions, or 3 Q escalations feels wrong for T12, post `REBUTTAL T12 item-#N` before coding — PM B re-checks in-session.

**No attempt-2 PLAN required** — GAP #5 D re-tightens Executor's default from 4 repo methods to 3; that's an atomic delta, not a re-plan. Executor codes directly per 9-file inventory + 16 binding conditions + Q-B-04/05/06 assumption stamps.

Proceed. Run `make prisma-generate` if not fresh → code per §Approach 1-11 (minus `findByPayloadMessageId`) → `make check` → SUBMIT.

#### SUBMIT T12 — exec-B (Nanak) at H17 17:00 (attempt 1, narrow primitive per PM ACK 9-file inventory)

Task: T12 — WhatsApp inbound webhook ingest **primitive** (types + Meta envelope schema + `webhook_events` sibling repository + 2-leg service + HC guest-upsert port TYPE-ONLY + AI inbound port TYPE-ONLY). Narrow scope per PM ACK — 8 GAP defaults confirmed spec-aligned; one atomic delta (repository drops `findByPayloadMessageId` per GAP T12-#5 D). Branch: `feat/wa-webhook-ingest` @ commit `b227ec3`.

Files changed: **10** (9 create + 1 modify) — **1404 insertions** total (~1381 new-file LOC + 23 net barrel delta; LOC slightly under the 1389/1412 pre-prettier estimate because `pnpm prettier --write` collapsed 5 files).
- `src/modules/whatsapp/whatsapp-webhook-ingest.types.ts` (new, 89 LOC — Q-B-04/05/06 assumption stamps)
- `src/modules/whatsapp/whatsapp-webhook-ingest.schema.ts` (new, 148 LOC post-prettier — Meta envelope + `extractInboundMessages` helper + response schema with `isDuplicate: false` Q-B-06 placeholder)
- `src/modules/whatsapp/whatsapp-webhook-events.repository.ts` (new, 48 LOC — **EXACTLY 3 methods** per binding #4)
- `src/modules/whatsapp/whatsapp-inbound-ingest.service.ts` (new, 240 LOC post-prettier — sync + async legs; async worker-discipline no-throw)
- `src/modules/whatsapp/ports/hotel-core-guest-upsert.port.ts` (new, 18 LOC — **TYPE-ONLY**, Q-B-04 stamp)
- `src/modules/whatsapp/ports/ai-inbound-message.port.ts` (new, 19 LOC — **TYPE-ONLY**, Q-B-05 stamp)
- `src/modules/whatsapp/__tests__/whatsapp-webhook-ingest.schema.test.ts` (new, 235 LOC post-prettier, 13 tests)
- `src/modules/whatsapp/__tests__/whatsapp-webhook-events.repository.test.ts` (new, 140 LOC post-prettier, 4 tests)
- `src/modules/whatsapp/__tests__/whatsapp-inbound-ingest.service.test.ts` (new, ~475 LOC post-prettier, 15 tests)
- `src/modules/whatsapp/index.ts` (modified, +23 net) — additive; T06 (L1-7) + T10 (L9-18) + T16 (L20-44) + T11 (L46-56) blocks byte-for-byte preserved; T12 exports L58-79

DoD self-check — **all 16 ACK binding conditions**:
- [x] **#1 `make check` PASS end-to-end** — lint 0/0 (`--max-warnings 0`), format-check clean, typecheck strict + `exactOptionalPropertyTypes`, test-unit 25/27 suites 248/250 tests (2 pre-existing `_template/*` baseline skips). PM B rerun invited.
- [x] **#2 Drift scans 0 hits on module scope** — all 6 EXECUTOR §4.4 categories. Special-attention verified: **NO `throw new Error(`** in T12 files (drift scan #3 returns 0 hits in module scope); **NO `signature_valid: true` hardcoded** in service (it's a ctor input to `ingestSync` at `:68-71`); **NO `WebhookVerificationError` thrown** (T11 concern, unrelated). Detail in §Drift scans.
- [x] **#3 Coverage 100% stmt/branch/func/line** on 3 runtime files: `whatsapp-webhook-ingest.schema.ts`, `whatsapp-webhook-events.repository.ts`, `whatsapp-inbound-ingest.service.ts`. Type-only files (`whatsapp-webhook-ingest.types.ts` + 2 ports) erased at compile per ts-jest — matches ACK #3 caveat. See §Test evidence.
- [x] **#4 Repository EXACTLY 3 methods** — `whatsapp-webhook-events.repository.ts` grep confirms: `persist` (`:23`), `markProcessed` (`:33`), `markFailed` (`:39`). NO `findByPayloadMessageId` method. Docstring L11-16 declares the drop per GAP T12-#5 D. Test file has 4 test cases (2 for `persist` covering signatureValid=true + signatureValid=false paths, 1 for `markProcessed`, 1 for `markFailed`) — 3-method surface, 4 test-case count matches the +signatureValid-flag branch coverage.
- [x] **#5 Service signature-agnostic** — `whatsapp-inbound-ingest.service.ts:68-71` `ingestSync(hotelId, signatureValid, envelope)` accepts `signatureValid: boolean` as an input parameter. `:80-85` passes it verbatim to `eventsRepo.persist({...signatureValid, ...})`. Service NEVER computes signature. Test `whatsapp-inbound-ingest.service.test.ts` at "should persist with signatureValid=true" + "should persist with signatureValid=false" asserts both boolean paths persist correctly.
- [x] **#6 Persist-always audit trail** — service test "should persist with signatureValid=false when the router flagged the request as spoofed (audit-trail path)" explicitly covers the invalid-signature persistence path. Repo test "should propagate the signatureValid=false flag verbatim" asserts the Prisma call receives `signatureValid: false` unchanged.
- [x] **#7 Async leg never throws (worker discipline)** — 4 test cases use `.resolves.toBeInstanceOf(Array)`:
  - "should NEVER throw when the HC port rejects" — `guestPort` rejects, `processEvent` returns Array
  - "should NEVER throw when a non-Error value is thrown" — `guestPort` rejects with `'boom'`, `processEvent` returns Array with `error: 'guest_upsert: boom'`
  - "should NOT throw when `markProcessed` itself fails" — repo.markProcessed rejects, service still returns Array (logs error via `markProcessedSafely`)
  - "should NOT throw when `markFailed` itself fails" — repo.markFailed rejects, service still returns Array (logs error via `markFailedSafely`)
  Zero `.rejects` assertions on `processEvent`.
- [x] **#8 Sync leg throws only `ValidationError`** — service `:74-78` `if (!parsed.success) throw new ValidationError(...)` is the only throw path in `ingestSync`. Test "should throw ValidationError when the envelope fails schema parse" asserts `.rejects.toBeInstanceOf(ValidationError)`. No other throw.
- [x] **#9 `isDuplicate: false` always in primitive** — service `:96` returns `{ eventId: event.id, isDuplicate: false }` literally. Test "should return isDuplicate=false always (Q-B-06 D placeholder)" asserts `first.isDuplicate === false` + `second.isDuplicate === false` on repeated calls with the same envelope. Docstring `schema.ts:16-19` notes Q-B-06 T12-followup fills semantics after schema-add.
- [x] **#10 PII floor with `maskWaPhone`** — service `:168` uses `maskWaPhone(message.waPhone)` in `LOG_PROCESS_MESSAGE`. Test "should mask the waPhone in the per-message log line and NOT leak the plaintext phone" asserts (a) `logged.waPhone === maskWaPhone(WA_PHONE)`, (b) `JSON.stringify(logged)` does NOT contain the raw `WA_PHONE`, (c) `JSON.stringify(logged).length < 500`. Positive log-shape assertion + negative plaintext + length heuristic — T10-a2/T11 pattern applied to T12.
- [x] **#11 Ports TYPE-ONLY** — both `ports/hotel-core-guest-upsert.port.ts` (18 LOC) and `ports/ai-inbound-message.port.ts` (19 LOC) contain docstring + single interface + type-only re-import from `whatsapp-webhook-ingest.types.js`. Grep confirms NO class, NO function, NO adapter reference. Barrel confirms no adapter re-export.
- [x] **#12 Q-B-04/05/06 assumption stamps** — 4 files carry explicit stamps:
  - `whatsapp-webhook-ingest.types.ts:15-28` — A/A/D summary (Q-B-04 guest-upsert, Q-B-05 ai-inbound, Q-B-06 dedup deferred)
  - `whatsapp-webhook-ingest.schema.ts:16-19` — Q-B-06 stamp on `isDuplicate` field (always false in primitive)
  - `ports/hotel-core-guest-upsert.port.ts:1-13` — Q-B-04 stamp + T12-followup adapter defer
  - `ports/ai-inbound-message.port.ts:1-13` — Q-B-05 stamp + T12-followup adapter defer
- [x] **#13 `git diff --stat main..HEAD` scope-clean** — exactly 9 create + 1 modify = 10 files. Zero touches to `api.ts`, `worker.ts`, `prisma-client.ts`, `core/http/http-client.ts`, T04 `hmac-validator.plugin.ts` (secret-agnostic — do NOT mutate), T05 `tenant-resolver.plugin.ts` (do NOT mutate), T09 `internal-rpc-auth.plugin.ts`, `prisma/schema.prisma`, `prisma/migrations/*`, `package.json`, `pnpm-lock.yaml`, T06 BSP files, T10 config files, T11 verify files, T16 template files, `_template/*`, `telegram/*`.
- [x] **#14 Barrel additive-only** — `src/modules/whatsapp/index.ts`: T06 (L1-7) + T10 (L9-18) + T16 (L20-44) + T11 (L46-56) blocks byte-for-byte preserved vs `main`. T12 exports appended L58-79 only. `grep -E "adapters/" src/modules/whatsapp/index.ts` returns 0 hits — no adapter re-export (5× confirmed cross-primitive: T10, T16, T11, T12 all preserve the T06 `no-restricted-imports` discipline).
- [x] **#15 Async-worker discipline docstring** — `whatsapp-inbound-ingest.service.ts:99-114` (docstring above `processEvent`) explicitly notes: "**Never throws — worker discipline.** All failure paths return rich `IngestOutcome[]` with `error` fields set + call `markFailed`. Router / worker at T12-followup reads outcomes for observability; retry is via `webhook_events` queue per spec §7 L351. This mirrors the T11 probe-semantics precedent applied to a worker-called method."
- [x] **#16 HMAC-agnostic docstring** — `whatsapp-inbound-ingest.service.ts:48-56` (docstring above `ingestSync`) explicitly notes: "**HMAC-agnostic**: signature verification lives at the T04 HMAC plugin (router-layer preHandler); this service consumes `signatureValid` as a trusted boolean parameter. GAP T12-#1 (Q-A-04 vs MVP §4.2 secret-choice) is decided at wiring time — this primitive is genuinely agnostic."

Quality gate
- `make typecheck`: PASS (0 errors, strict + `exactOptionalPropertyTypes`)
- `make lint`: PASS (0 errors, 0 warnings — `eslint . --max-warnings 0`)
- `make format-check`: PASS (all matched files use Prettier code style)
- `make test-unit`: PASS (25 of 27 suites, 248 of 250 tests — 2 pre-existing baseline skips in `_template/*`; my 4 new suites 32/32 pass — 216 previous approved baseline + 32 T12 = 248)
- `make check`: PASS end-to-end (concatenation of the above)

Drift scans (all 6 EXECUTOR §4.4 categories — 0 hits on T12 module files)
- `any` types: 0 (pre-existing 2 in `_template/*` untouched — same baseline as T10/T11/T16 approved)
- `console.log/info/debug`: 0 (repo-wide 0)
- `throw new Error(` in `src/modules/` + `src/core/`: 0 in module scope (pre-existing 4 in `_template/_template.repository.ts:23` + `core/config/env.ts:75` + `core/http/http-client.ts:19,27` — all untouched)
- Forbidden imports: 0 (repo-wide 0)
- `^export default ` outside entrypoints/config: 0 (repo-wide 0)
- `.skip(` in `*.test.ts`: 0 in module scope (pre-existing 2 in `_template/*` untouched)

Security check (CLAUDE §6 + spec §4.2 + PM ACK design intent)
- **Signature-agnostic service** — `whatsapp-inbound-ingest.service.ts:68-71` `ingestSync(hotelId, signatureValid, envelope)` accepts `signatureValid` as a trusted input parameter. T04 HMAC plugin at router-layer wiring (T12-followup) sets the flag before calling service. Docstring L48-56 explicitly cross-references Q-A-04 vs MVP §4.2 as wiring-time decision. Primitive genuinely agnostic.
- **Persist-always audit trail** — spec §4.4 L226 `signature_valid BOOLEAN NOT NULL` is DDL-mandated. Service `:80-85` persists ALWAYS with the flag; test suite covers both `signatureValid=true` (happy) and `signatureValid=false` (spoofed-audit) paths.
- **Async `processEvent` NEVER throws (worker discipline)** — 4 test cases confirm via `.resolves.toBeInstanceOf(Array)`. Service `:172-186` + `:188-202` (per-message HC/AI catch blocks) always return `IngestOutcome` with `error` string; `:212-222` + `:224-235` (safe wrappers) catch repo failures and log-warn rather than throw. T11 probe-semantics precedent extended to worker context.
- **Sync `ingestSync` throws ONLY `ValidationError` on schema fail** — service `:74-78` is the only throw path.
- **`isDuplicate: false` always** — Q-B-06 D placeholder; service `:96` returns literal `false`. Router wire contract survives Q-B-06 resolution.
- **PII floor via `maskWaPhone`** — service `:168` masks in `LOG_PROCESS_MESSAGE`; test asserts positive shape + negative plaintext + length heuristic. T10-a2/T11 pattern.
- **No secret hardcoded** — T12 primitive has no outbound HTTP (adapters deferred to T12-followup); HC/AI baseUrls + `INTERNAL_SECRET` handled at wiring layer (Q-C-02).

Test evidence
- Unit: **32 tests, 4 suites** — `whatsapp-webhook-ingest.schema.test.ts` (13), `whatsapp-webhook-events.repository.test.ts` (4), `whatsapp-inbound-ingest.service.test.ts` (15). Note: my earlier PLAN estimate of 33 tests was off by 1 in the service suite (actual 15 vs planned 16 after prettier collapse; semantic coverage identical).
- Integration: 0 — deferred as **T12-INTEG** follow-up (see §Follow-ups); repository test uses Prisma-mock stopgap per T10-a2 / T11 / T16 precedent
- Coverage (jest, scoped to 3 runtime files):
  ```
  File                                   | % Stmts | % Branch | % Funcs | % Lines
  ---------------------------------------|---------|----------|---------|--------
  All files                              |   100   |   100    |   100   |   100
   whatsapp-inbound-ingest.service.ts    |   100   |   100    |   100   |   100
   whatsapp-webhook-events.repository.ts |   100   |   100    |   100   |   100
   whatsapp-webhook-ingest.schema.ts     |   100   |   100    |   100   |   100
  ```
  Type-only files (`whatsapp-webhook-ingest.types.ts` + 2 ports) erased at compile per ts-jest, not instrumented. Matches ACK #3 caveat identically to T10/T11/T16.

Notes / discipline discoveries / tolerated deviations
- **Round 2 self-validate — branch coverage gap fixed with type assertion** — first coverage run showed `whatsapp-inbound-ingest.service.ts:151` uncovered branch (`firstError ?? 'unknown error'` fallback). The fallback is unreachable at runtime because both catch blocks in `processSingleMessage` (`:180-186` guest-upsert failure, `:195-201` ai-inbound failure) always set `error` string. Fixed by replacing `?? 'unknown error'` with `firstError as string` type assertion + inline invariant comment: `// Invariant: processSingleMessage always sets error when dispatched: false (both catch blocks). firstError therefore defined whenever anyFailure is.` Rescan verified `as string` does NOT match the drift regex `: any|<any>|as any` (regex requires "any" after "as ", so `as string` is safe). Coverage returned to 100% on all 4 metrics. **Tolerated deviation flag for PM B judgment**: type assertion `as string` is used at one specific site to escape TypeScript's inability to prove the algorithmic invariant. Alternative approaches (discriminated union on `IngestOutcome`, `firstError!` non-null assertion, restructured loop with early-return) all have equivalent runtime + coverage semantics; `as string` chosen for minimal code churn.
- **Prettier collapse on 5 files** — `pnpm prettier --write` collapsed `whatsapp-inbound-ingest.service.ts`, `whatsapp-webhook-ingest.schema.ts`, and all 3 test files. Semantic content identical; total post-prettier LOC ≈ 1381 (vs pre-prettier estimate 1389). No exports added/removed/renamed vs PLAN §Approach.
- **Actual test count 32 (not 33 estimated)** — my PLAN pre-estimate over-counted by one test in the service suite (multi-message with `contacts` without profileName was collapsed into existing "should omit the name field" test case). Semantic coverage unchanged.
- **5th confirmation of `no-restricted-imports` T06 barrel discipline** — T10, T16, T11, T12 all preserve the rule (adapter never re-exported through the module barrel; adapters wired at entrypoint). Discipline is now cross-primitive fixed norm.
- **Q-A-03 test-env workaround NOT triggered** — service test uses no crypto / no env-key seeding (T12 has no plaintext secrets in-flow). Cross-slot pattern remains pending PM A resolution but not applicable to this primitive.
- **T12 tolerated deviations (per ACK §Notes pre-accept)**:
  - Prisma-mock stopgap in `whatsapp-webhook-events.repository.test.ts` (T10/T11/T16 precedent) — T12-INTEG follow-up parked pending Q-C-01.
  - Q-B-04/05 adapters deferred to T12-followup — unratified contracts.
  - Q-B-06 dedup deferred + `isDuplicate: false` placeholder — schema-add is Nathan/T02 territory.

Q register / follow-ups
- **No new Q filed during coding** — 3 new Qs (Q-B-04 HC guest-upsert contract, Q-B-05 AI inbound contract, Q-B-06 `webhook_events.external_id` schema-add) already filed by PM B at ACK time; PM B vote on Q-A-04 also logged at ACK. §3 mirror + PARENT §3a carry the tracking.
- **T12-followup** — public route `POST /webhook/whatsapp/:hotel_slug` + T04 plugin wiring (signature verify with EITHER `webhook_verify_token` OR `app_secret_enc` per Q-A-04 PO resolution) + T05 tenant-resolver plugin wiring + worker registration for async leg (`processEvent` consumer) + HC guest-upsert adapter + AI inbound adapter + dedup logic once Q-B-06 schema-add lands (repurposes `isDuplicate` field from placeholder to real value). Blocked on Q-A-04 + Q-B-04 + Q-B-05 + Q-B-06 + Q-C-02 (`api.ts` + `worker.ts` bootstrap + env config).
- **T12-INTEG** — real-DB integration test for `webhook_events` persistence (testcontainers Postgres) + mock HC + mock AI test harness for the async leg. Blocked on Q-C-01 + T12-followup.

Requesting PM B VERDICT.

##### VERDICT T12 — APPROVED (H17, attempt 1, primitive) by PM B (Nanak)

✅ **APPROVED**. Independent PM rerun on `feat/wa-webhook-ingest @ b227ec3` (code) + `49e78cc` (SUBMIT status). All 16 ACK binding conditions verified against code (file:line), not claim. 8 GAP defaults confirmed spec-aligned. `as string` deviation accepted with future-refactor note (see §Tolerated deviations).

**Independent verification trace** (rerun on PM shell, Node 22.23.1 + pnpm 9.0.0 via nvm/corepack):

- **`make check`** — **PASS end-to-end** (1.233s). `lint` clean (`eslint . --max-warnings 0`), `format-check` "All matched files use Prettier code style!", `typecheck` (`tsc --noEmit` strict + `exactOptionalPropertyTypes`) 0 errors, `test:unit` 25/27 suites passed (2 pre-existing `_template/*` baseline skips), 248/250 tests passed. My 3 new suites = **32/32 pass, 0 fail** (13 schema + 4 repo + 15 service).
- **Drift scans (6 EXECUTOR §4.4 categories)** on T12 scope — **all 0 hits**: `any` = 0, `console.log/info/debug` = 0, `throw new Error(` = 0, forbidden imports = 0, `^export default ` = 0, `.skip(` / `describe.skip` = 0.
  - **Special-attention greps**: `signature_valid: true` hardcoded in service → 0 (verified ctor-input parameter pattern at `service.ts:68-71`). `WebhookVerificationError` in T12 → 0 (T11 concern, correctly unrelated). `findByPayloadMessageId` in `src/` → 0 method definitions (present only in docstrings at `repository.ts:10` + `repository.test.ts:7` explaining the intentional drop per Q-B-06 D).
  - **`as string` grep**: 1 hit at `whatsapp-inbound-ingest.service.ts:153` — well-documented invariant assertion (see §Tolerated deviations below). Regex-clean: `as string` does NOT match the `: any|<any>|as any` drift pattern.
- **Coverage rerun** (`pnpm test:coverage --collectCoverageFrom='...whatsapp-webhook-ingest.schema.ts' --collectCoverageFrom='...whatsapp-webhook-events.repository.ts' --collectCoverageFrom='...whatsapp-inbound-ingest.service.ts' --collectCoverageFrom='...ports/hotel-core-guest-upsert.port.ts' --collectCoverageFrom='...ports/ai-inbound-message.port.ts' --testPathPattern='(whatsapp-webhook-ingest|whatsapp-webhook-events|whatsapp-inbound-ingest)'`):
  ```
  File                                   | % Stmts | % Branch | % Funcs | % Lines
  All files                              |   100   |   100    |   100   |   100
   whatsapp-inbound-ingest.service.ts    |   100   |   100    |   100   |   100
   whatsapp-webhook-events.repository.ts |   100   |   100    |   100   |   100
   whatsapp-webhook-ingest.schema.ts     |   100   |   100    |   100   |   100
  ```
  3 type-only files (`whatsapp-webhook-ingest.types.ts` + 2 ports) erased at compile per ts-jest — expected per ACK #3 caveat.
- **`git diff --stat main..feat/wa-webhook-ingest -- src/ prisma/ package.json pnpm-lock.yaml`** — exactly **9 create + 1 modify** = 10 files. Zero touches to `api.ts`, `worker.ts`, `prisma-client.ts`, `core/http/http-client.ts`, T04 `hmac-validator.plugin.ts` (secret-agnostic, preserved), T05 `tenant-resolver.plugin.ts`, T09 `internal-rpc-auth.plugin.ts`, `prisma/schema.prisma`, `prisma/migrations/*`, `package.json`, `pnpm-lock.yaml`, T06 BSP + T10 config + T11 verify + T16 template files, `_template/*`, `telegram/*`.

**16 binding conditions — file:line evidence**:

- **#1 `make check` PASS** — PM rerun above. ✓
- **#2 Drift scans + special-attention gates** — PM greps above. ✓
- **#3 Coverage 100%** — PM rerun above (3 runtime files). ✓
- **#4 Repository EXACTLY 3 methods** — `whatsapp-webhook-events.repository.ts`: `persist` (`:23`), `markProcessed` (`:33`), `markFailed` (`:39`). NO `findByPayloadMessageId` (verified via grep — only in comments). Docstring L10-16 declares intentional drop. Test file has 4 test cases: 2 for `persist` (signatureValid=true + signatureValid=false), 1 for `markProcessed`, 1 for `markFailed`. ✓
- **#5 Service signature-agnostic** — `whatsapp-inbound-ingest.service.ts:68-71` `ingestSync(hotelId, signatureValid, envelope)` accepts `signatureValid: boolean` as trusted parameter. `:80-85` passes it to `eventsRepo.persist({...})` verbatim. Service NEVER computes signature. HMAC-agnostic docstring at `:48-56` explicitly cross-references Q-A-04 vs MVP §4.2. ✓
- **#6 Persist-always audit trail** — service test "should persist with signatureValid=false when the router flagged the request as spoofed (audit-trail path)" covers invalid-sig persistence. Repo test "should propagate the signatureValid=false flag verbatim" asserts Prisma receives the flag unchanged. Both true/false paths tested. ✓
- **#7 Async leg never throws (worker discipline)** — 4 test cases via `.resolves.toBeInstanceOf(Array)`:
  - HC port rejects → returns Array with error outcome
  - Non-Error thrown value → returns Array with `error: 'guest_upsert: boom'`
  - `markProcessed` fails → still returns Array (via `markProcessedSafely` at `:212-222`)
  - `markFailed` fails → still returns Array (via `markFailedSafely` at `:224-235`)
  Zero `.rejects` on `processEvent`. Docstring at `:99-114` documents "Never throws — worker discipline" mirroring T11 probe-semantics. ✓
- **#8 Sync leg throws only `ValidationError`** — service `:74-78` `throw new ValidationError(...)` is the only throw in `ingestSync`. Test "should throw ValidationError when the envelope fails schema parse" asserts `.rejects.toBeInstanceOf(ValidationError)`. ✓
- **#9 `isDuplicate: false` always** — service `:96` returns `{ eventId: event.id, isDuplicate: false }` literal. Test "should return isDuplicate=false always (Q-B-06 D placeholder)" asserts `first.isDuplicate === false` + `second.isDuplicate === false` on repeated calls. Docstring at `schema.ts:16-19` notes Q-B-06 T12-followup fills semantics. ✓
- **#10 PII floor with `maskWaPhone`** — service `:168` uses `maskWaPhone(message.waPhone)` in `LOG_PROCESS_MESSAGE`. Test "should mask the waPhone in the per-message log line and NOT leak the plaintext phone" asserts (a) `logged.waPhone === maskWaPhone(WA_PHONE)`, (b) `JSON.stringify(logged)` does NOT contain raw `WA_PHONE`, (c) `JSON.stringify(logged).length < 500`. Positive log-shape + negative plaintext + length heuristic. ✓
- **#11 Ports TYPE-ONLY** — PM inspected: `ports/hotel-core-guest-upsert.port.ts` (18 LOC) + `ports/ai-inbound-message.port.ts` (19 LOC) contain docstring + single interface + type-only re-import. Grep confirms zero class / function / adapter reference. Q-B-04 stamp at first port L1-13, Q-B-05 stamp at second port L1-13. Same shape as T16 `hotel-core-template-callback.port.ts`. ✓
- **#12 Q-B-04/05/06 assumption stamps** — 4 files carry explicit stamps: `types.ts:15-28` (A/A/D summary), `schema.ts:16-19` (Q-B-06 stamp on `isDuplicate`), `ports/hotel-core-guest-upsert.port.ts:1-13` (Q-B-04), `ports/ai-inbound-message.port.ts:1-13` (Q-B-05). ✓
- **#13 `git diff --stat` scope-clean** — PM rerun above. 9 create + 1 modify, zero cross-boundary touches. ✓
- **#14 Barrel additive-only** — `src/modules/whatsapp/index.ts`: T06 (L1-7) + T10 (L9-18) + T16 (L20-44) + T11 (L46-56) blocks byte-for-byte preserved vs `main`. T12 exports appended L58-79 only. `grep -E "adapters/" src/modules/whatsapp/index.ts` = 0 hits. **5× cross-primitive confirmation** of T06 `no-restricted-imports` discipline (T10, T16, T11, T12 all preserve). ✓
- **#15 Async-worker discipline docstring** — `whatsapp-inbound-ingest.service.ts:99-114` explicitly states: "**Never throws — worker discipline.** All failure paths return rich `IngestOutcome[]` with `error` fields set + call `markFailed`. Router / worker at T12-followup reads outcomes for observability; retry is via `webhook_events` queue per spec §7 L351. This mirrors the T11 probe-semantics precedent applied to a worker-called method." ✓
- **#16 HMAC-agnostic docstring** — `whatsapp-inbound-ingest.service.ts:48-56` explicitly states: "**HMAC-agnostic**: signature verification lives at the T04 HMAC plugin (router-layer preHandler); this service consumes `signatureValid` as a trusted boolean parameter. GAP T12-#1 (Q-A-04 vs MVP §4.2 secret-choice) is decided at wiring time — this primitive is genuinely agnostic." ✓

**Spec-alignment audit**:
- `MVP §4.2 L92` HMAC secret — primitive genuinely agnostic (verified). Q-A-04 PM B vote logged at PARENT §3a. ✓
- `MVP §4.6` idempotency — dedup deferred per Q-B-06 D; `isDuplicate: false` placeholder preserves wire contract. ✓
- `MVP §4.7` persist-fast + async worker split — service `ingestSync` (sync leg) + `processEvent` (async leg) 1:1 mapping. ✓
- `04 §3.1 L110-118` 3-leg flow — Meta→us (persist) + HC guest-upsert + AI inbound wa_message all present as service methods / port dependencies. ✓
- `04 §4.4 L226` `signature_valid BOOLEAN NOT NULL` — DDL-mandated persist-always semantic reflected in service `:80-85` + repo `persist` method. ✓
- `04 §7 L351` "retry from webhook_events queue" — enabled by `markFailed` semantic + queryable `processedAt IS NULL` index (spec §4.4 L233). Retry logic itself is T14/T12-followup concern. ✓

**Security floor check (CLAUDE §6)**:
- **Signature-agnostic + persist-always audit trail** — schema-mandated per §4.4 L226; matches audit intent. ✓
- **Async worker discipline** — 4 no-throw cases confirmed. ✓
- **Sync `ValidationError` only** — `:74-78` sole throw. ✓
- **PII floor** — `maskWaPhone` at `:168` + 3-assertion test pattern. ✓
- **No hardcoded secrets** — T12 primitive has no outbound HTTP (adapters deferred to T12-followup); wiring layer handles credentials. ✓

**Tolerated deviations — PM B judgment**:

1. **`as string` type assertion at `whatsapp-inbound-ingest.service.ts:153`** — PM B **ACCEPTS** with future-refactor note.
   - **Judgment**: Executor identified an unreachable-fallback branch (`firstError ?? 'unknown error'`) that broke coverage, replaced with `firstError as string` + inline invariant comment (L151-152: "*Invariant: `processSingleMessage` always sets `error` when `dispatched: false` (both catch blocks). `firstError` therefore defined whenever `anyFailure` is.*").
   - **Why accepted**: (a) `as string` is NOT `as any` — narrower assertion, does NOT match the drift regex `: any|<any>|as any`; (b) invariant is verifiable by inspection of `processSingleMessage` (`:172-186` + `:188-202` — both catch blocks set `error`); (c) 100% test coverage means all failure paths are exercised, so if invariant ever breaks the type-level lie would be caught by test degradation; (d) alternatives (discriminated union, `firstError!` non-null, restructured loop) are cleaner but polish-level, not correctness-blocking.
   - **Future refactor recommendation (T12-followup or chore)**: convert `IngestOutcome` to discriminated union — `type IngestOutcome = { dispatched: true; messageId: string; guestId: string } | { dispatched: false; messageId: string; guestId?: string; error: string }`. TypeScript narrows via `if (!outcome.dispatched)` and the `as string` disappears. Not required for this VERDICT.

2. **Prisma-mock stopgap in `whatsapp-webhook-events.repository.test.ts`** — T10/T11/T16 precedent, T12-INTEG follow-up parked awaiting Q-C-01.

3. **Prettier collapse on 5 files** — semantic identical.

4. **Actual test count 32 (not 33 pre-estimated)** — service suite lost one test to prettier collapse of adjacent describe blocks; semantic coverage unchanged.

5. **Q-B-04/05 adapters deferred to T12-followup**, **Q-B-06 dedup deferred + `isDuplicate: false` placeholder** — all per ACK design.

**Follow-ups accepted** (files, do not action):
- **T12-followup**: public route `POST /webhook/whatsapp/:hotel_slug` + T04 plugin wiring + T05 tenant-resolver wiring + worker registration + HC guest-upsert adapter + AI inbound adapter + dedup logic post-Q-B-06. Blocked on Q-A-04 + Q-B-04 + Q-B-05 + Q-B-06 + Q-C-02.
- **T12-INTEG**: real-DB integration test + mock HC + mock AI harness. Blocked on Q-C-01 + T12-followup.

**Actions taken**:
- → §1 task tracker row for T12 updated (`backlog` → `approved (primitive)` with `PM B (H17, a1)` verified-by).
- → PARENT §1 row for T12 mirrored (same shape as T10/T11/T16).
- → PARENT §2 short roll-up appended (1 line, format per `PM-AGENT.md §0.8`, append-at-bottom convention).

**Next expected action**: Executor B open PR on `feat/wa-webhook-ingest` for PO merge review; PM B re-verify on CI green post-PR (per T10/T11/T16 pre-merge discipline). **Slot B progress: 4/7 (T10 + T11 + T16 merged; T12 approved primitive)** · T13 (outbound dispatch — deps T06 + T09 merged, needs HC quota RPC contract) + T14 (retry queue — deps T07 + T13) + T15 (delivery receipts — deps T04 + T12 branch discrimination) backlog. T12-followup + T12-INTEG parked awaiting Q chain (Q-A-04 + Q-B-04/05/06 + Q-C-01/02).

### ASSIGNMENT T15 — claimed by exec-B (Nanak) at H17 17:52
- Branch: feat/wa-delivery-receipts (will branch off `main` before first `src/` commit; PLAN commit lands on `main`)
- Routed from: PM-STATUS-B.md §8 queue (self-claim per EXECUTOR-PROTOCOL §3B — T04 + T12 both merged; T13 not yet started but its FK target `outbound_dispatch_queue` exists in schema per T02 so T15 primitive can build against the FK contract)

#### PLAN T15 — exec-B (Nanak) at H17 17:52

**Scope recap** (spec: `MVP §1.2 B7` + `§5 AC L121` + `docs/spec/04-integration-channels.md §2.3 §3.1 L106 §4.5 §4.6 §9`)

T15 = **WA delivery receipts ingest** — 2nd branch handler of the shared `POST /webhook/whatsapp/:hotel_slug` endpoint (T12 = messages branch, T16 = template_status branch, this = statuses branch). Meta Cloud API sends status transitions (`sent | delivered | read | failed`) as `entry[].changes[].value.statuses[]` payloads. For each status entry:
1. Correlate `status.id` → `outbound_dispatch_queue.external_id` → get `dispatch_id`
2. Persist a `delivery_receipts` row with `{ dispatch_id, external_id, status, hotel_id, received_at }`
3. Handle orphans (status.id not matching any outbound row — spoofed / late / from another system) per GAP #4

**Critical DDL constraint** (§4.6 L263-272 + `prisma/schema.prisma:108-119`): `delivery_receipts.dispatch_id` is **`UUID NOT NULL REFERENCES outbound_dispatch_queue(id) ON DELETE CASCADE`** + `external_id VARCHAR(80) NOT NULL` + `status CHECK IN ('sent','delivered','read','failed')`. Correlation is MANDATORY before persist — orphan handling can't just insert with NULL FK.

Following T12/T11/T16 modified-B discipline: **primitive only**. NO routes.ts, NO worker.ts, NO adapters (this is a receiver-only flow — no external HTTP callers). NO Prisma table added (both `outbound_dispatch_queue` + `delivery_receipts` are in T02). NO api.ts / plugins / T04 mutation. Sibling repository file for delivery_receipts writes + outbound_dispatch_queue reads (T10/T11/T12 sibling precedent).

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot B (Nanak) ✓
- CLAUDE.md loaded ✓
- Task spec read: `MVP §1.2 B7 L38` ("Delivery receipts ingest — part of B3 (WA Cloud sends receipts in same webhook stream)") + `§5 AC L121` ("WA outbound dispatched — receipt returned; `outbound_dispatch_queue` row shows `status: 'sent'`, `external_id` populated") ✓ · `04-integration-channels.md §2.3 L73` (webhook endpoint shared stream) + `§3.1 L106` ("Persists delivery receipt when WA Cloud webhook returns") + `§4.5 L245-257` (outbound_dispatch_queue DDL — `external_id VARCHAR(80) NULL` populated on send confirmation) + `§4.6 L263-272` (delivery_receipts DDL — critical NOT NULL FK constraint) + `§9` (error codes) ✓
- Parent docs spot-read: `docs/MODULE_TEMPLATE.md` (standard CRUD-ish module variant, no ports since no external IO) · `src/plugins/hmac-validator.plugin.ts` T04 (secret-agnostic; router-layer concern) · `src/plugins/tenant-resolver.plugin.ts` T05 (router-layer) · `src/modules/whatsapp/whatsapp-webhook-ingest.schema.ts` T12 (envelope shape reference — `statuses` array optional in ChangeValueSchema; T15 handles that branch) · `src/modules/whatsapp/whatsapp-webhook-events.repository.ts` T12 (sibling repo pattern — 3 methods, no findByPayloadMessageId; same rigor for T15) · `src/modules/whatsapp/whatsapp-inbound-ingest.service.ts` T12 (2-leg pattern — but T15 has no async leg needed) · `prisma/schema.prisma:86-119` `OutboundDispatch` + `DeliveryReceipt` models — verified structural shape ✓
- Dependencies check:
  - T02 (Prisma init + `outbound_dispatch_queue` + `delivery_receipts`): MERGED ✓
  - T04 (HMAC verify plugin): MERGED — router-layer concern (primitive signature-agnostic per T12 precedent)
  - T05 (tenant resolver): MERGED — router-layer
  - T09 (internal RPC auth): MERGED — not consumed (no outbound RPCs in T15)
  - T10 (WA config primitive): MERGED — not consumed (no config lookup needed)
  - T12 (WA inbound webhook ingest): MERGED — provides envelope schema reference + branch discrimination pattern. Router at T15-followup discriminates: `messages` → T12 service, `statuses` → T15 service, template branch → T16 service
  - T13 (outbound dispatch): **NOT YET STARTED** — but its FK target `outbound_dispatch_queue.external_id` exists in schema per T02, so T15 primitive can build against the FK contract. T13's write of `external_id` on send confirmation is the correlation-source; T15's read completes the loop
  - Q-C-01/02/03: **NOT blockers** for T15 primitive (no api.ts wiring, no session, no adapter wiring)
  - Q-A-04: **N/A at primitive** — signature-agnostic per T12 precedent (T04 plugin at wiring)
  - Q-B-04/05: N/A (no HC/AI RPC in T15 — receiver-only)
  - Q-B-06 (webhook_events dedup schema-add): N/A for T15 (delivery_receipts semantics differ — see GAP #5)
- `make typecheck`: PASS on `main` ✓ ; `make lint`: PASS on `main` ✓
- Scaffolder risk: **none proposed** (no `pnpm add`, no schema change).

**Files to create** (default proposal — see GAP #6 for scope-depth alternatives)

```
src/modules/whatsapp/whatsapp-delivery-receipts.types.ts
src/modules/whatsapp/whatsapp-delivery-receipts.schema.ts
src/modules/whatsapp/whatsapp-delivery-receipts.repository.ts
src/modules/whatsapp/whatsapp-delivery-receipts.service.ts
src/modules/whatsapp/__tests__/whatsapp-delivery-receipts.schema.test.ts
src/modules/whatsapp/__tests__/whatsapp-delivery-receipts.repository.test.ts
src/modules/whatsapp/__tests__/whatsapp-delivery-receipts.service.test.ts
```

**7 files** (4 source + 3 tests). Slimmer than T12 modified-B (9 files) because **NO ports needed** — T15 is a receiver-only flow with no external HTTP callers (no HC / no AI / no Meta call). Sibling repo owns both the outbound-dispatch read (correlation lookup) and the delivery-receipts write.

**Files to modify** (1)

- `src/modules/whatsapp/index.ts` — append T15 exports (types, schemas, repository class, service class). Preserve T06 (L1-7) + T10 (L9-18) + T16 (L20-44) + T11 (L46-56) + T12 (L58-79) blocks byte-for-byte.

**Files explicitly NOT touched**

- `prisma/schema.prisma`, `prisma/migrations/*` — both tables exist per §4.5/§4.6 DDL (T02)
- `src/entrypoints/api.ts`, `src/entrypoints/worker.ts` — stubs (Q-C-02)
- `src/core/prisma/prisma-client.ts` — stub (Q-C-01); repo imports `PrismaClient` type via `@prisma/client` (T10/T11/T12 precedent)
- `src/plugins/*` (T04/T05/T09) — router-layer concerns
- T06/T10/T11/T16/T12 primitives — byte-for-byte
- `src/modules/telegram/*` — slot C
- `src/modules/_template/*` — reference
- `src/core/http/http-client.ts` — stub; NOT NEEDED (no outbound HTTP)
- `package.json`, `pnpm-lock.yaml` — no dep add

**Approach**

No hexagonal ports required — T15 has no external IO (receiver-only). Coding order:

1. **`whatsapp-delivery-receipts.types.ts`** — domain types:
   - `DeliveryReceiptStatus = 'sent' | 'delivered' | 'read' | 'failed'` (matches DDL CHECK constraint)
   - `WhatsappStatusEntry = { externalId, status, timestamp, recipientId? }` — normalized Meta shape (extracted from `entry[].changes[].value.statuses[]`)
   - `DeliveryReceiptPersistenceInput = { hotelId, dispatchId, externalId, status }` — write shape
   - `DeliveryReceiptIngestOutcome = { externalId, status, dispatched: boolean, error?: string }` — per-status result
   - `WhatsappDeliveryReceiptsIngestResult = { receipts: DeliveryReceiptIngestOutcome[], orphanCount: number }` — service return shape
2. **`whatsapp-delivery-receipts.schema.ts`** — zod for Meta statuses envelope + normalizer:
   - `WhatsappDeliveryStatusesEnvelopeSchema` — subset of T12's envelope (only `.value.statuses` branch); passthrough for spec drift on inner fields per T12 pattern
   - `extractStatuses(envelope): WhatsappStatusEntry[]` — pure helper. Skips non-status branches (returns `[]` for messages-only envelopes → T12 concern)
   - Response envelope for wire contract (T15-followup router)
3. **`whatsapp-delivery-receipts.repository.ts`** — sibling to T10/T11/T12. Class `WhatsappDeliveryReceiptsRepository(private readonly db: PrismaClient)`. **2 methods** (cross-table concern for correlation flow):
   - `findDispatchByExternalId(hotelId: string, externalId: string): Promise<OutboundDispatch | null>` — READ on `outbound_dispatch_queue` for correlation. Filter by BOTH `hotelId` AND `externalId` (tenant guard). See GAP #1 on cross-table concern.
   - `persist(input: DeliveryReceiptPersistenceInput): Promise<DeliveryReceipt>` — WRITE to `delivery_receipts` with FK-validated dispatchId. Prisma will throw on FK violation (caller responsibility to verify correlation first).
4. **`whatsapp-delivery-receipts.service.ts`** — single-method sync orchestrator (no async worker leg needed — see GAP #3):
   - `ingestStatuses(hotelId: string, envelope: unknown, signatureValid: boolean): Promise<WhatsappDeliveryReceiptsIngestResult>` — zod parse → extract statuses → per status: `findDispatchByExternalId` → if found: `persist`, if not: log warn + record orphan → return per-status outcomes + orphanCount
   - Signature-agnostic (per T12 precedent — T04 plugin at router wiring)
   - Throws ONLY `ValidationError` on schema fail
   - Never throws for individual receipt persist failures (per-status outcome shape; worker-like discipline within the sync call)
   - PII floor: `recipientId` masked via `maskWaPhone` in log
5. **`__tests__/whatsapp-delivery-receipts.schema.test.ts`** — envelope parse: statuses-only, mixed messages+statuses (extract statuses branch only), empty statuses (messages-only), edge cases; extractStatuses normalization tests.
6. **`__tests__/whatsapp-delivery-receipts.repository.test.ts`** — Prisma-mock stopgap. Assert call shapes for `findDispatchByExternalId` (with hotelId+externalId filter) + `persist`.
7. **`__tests__/whatsapp-delivery-receipts.service.test.ts`** — mock repo + logger spy. Cases:
   - Happy: 1 status found → persisted → outcome dispatched=true
   - Orphan: externalId not in outbound_dispatch_queue → skip + log + orphanCount++
   - Multi-status: mixed found+orphan → per-status outcomes reflect each
   - Status transition sequence (sent → delivered → read of same externalId) — all persist (multi-row per external_id is expected per §4.6 DDL; delivery_receipts.external_id is NOT UNIQUE)
   - Schema fail → ValidationError
   - Repo persist fail on a single status → recorded as error in outcome, service continues with others (never throws)
   - PII floor: recipientId masked in log
   - `signatureValid` propagation (though delivery_receipts DDL has no signature_valid column; primitive logs it but doesn't persist)
8. **`src/modules/whatsapp/index.ts`** — append T15 exports.
9. `make check` → drift scans → coverage → SUBMIT.

**Security floor** (CLAUDE §6):
- `recipientId` (WA phone) masked via `maskWaPhone()` in logs (T10/T12 precedent)
- No plaintext secrets in T15 (receiver-only)
- No `throw new Error(` — schema fail → `ValidationError`; per-receipt persist fail → outcome error string
- Tenant guard: correlation lookup filters by BOTH `hotelId` AND `externalId` (prevents cross-tenant orphan hijack)

**Deferred (out of T15 primitive, tracked as follow-ups)**

- **T15-followup** — router wiring for the `statuses` branch discrimination (piggyback on T12-followup router with the same signature verify at T04 wiring). Blocked on Q-A-04 (HMAC secret choice) + Q-C-02 (`api.ts` bootstrap + env config) + T12-followup router structure.
- **T15-INTEG** — real-DB integration test with FK-populated `outbound_dispatch_queue` rows (testcontainers Postgres). Blocked on Q-C-01 + T13 (which populates outbound_dispatch_queue.external_id).

**GAPs / questions** (blocking PM B ACK before I write any code)

- **GAP T15-#1 — Repository cross-table concern (findDispatchByExternalId on outbound_dispatch_queue)**: `outbound_dispatch_queue` will be owned by T13 (WA outbound dispatch — not yet started in slot B queue). T15 needs to READ this table for the correlation lookup. **Options**: A) T15 repo owns the read of `outbound_dispatch_queue.external_id` — pragmatic; delivery-receipts concern legitimately spans both tables; T13 will not mutate this method's read shape when T13 lands (T13 writes external_id, T15 reads it) [my default] · B) Wait until T13 ships an `WhatsappOutboundDispatchRepository` with `findByExternalId` — blocks T15 primitive on T13 which isn't started + T13 assignment not yet on my queue · C) T15 service does direct Prisma read (skip repo layer for cross-table concern) — violates MODULE_TEMPLATE. **Prefer A** unless PM disagrees.
- **GAP T15-#2 — `webhook_events` persistence responsibility**: Every webhook POST should produce a `webhook_events` audit row (per §4.7 persist-fast pattern). T12 service handles the messages branch and persists. **Question**: does T15 also persist to webhook_events, or does the router (at T15-followup) persist ONCE per POST before branch discrimination? **Options**: A) Router persists webhook_events once via T12's `WhatsappWebhookEventsRepository.persist`; T15 service ONLY handles delivery_receipts writes — matches T12 division of labor; router at T15-followup calls both T12's persist (audit) AND T15's ingestStatuses [my default] · B) T15 service also persists webhook_events (redundant with router path) · C) T15 doesn't touch webhook_events (delivery_receipts is standalone audit).
- **GAP T15-#3 — Async worker leg needed for T15?**: T12 has 2 legs (sync persist + async HC/AI RPC). T15 has no external RPCs (receiver-only). **Options**: A) NO async leg — sync `ingestStatuses` does the full flow (extract + correlate + persist per status); returns synchronously; router calls once per POST [my default] · B) YES — deferred HC callback to update ticket status when message read/failed (spec §3.1 doesn't mandate this for MVP) · C) File as T15-followup extension.
- **GAP T15-#4 — Correlation orphan handling (externalId not in outbound_dispatch_queue)**: Cannot persist to `delivery_receipts` with NULL FK (DDL constraint). **Options**: A) Skip the orphan status entry + log warn + record `orphanCount` in service return; continue processing remaining statuses [my default; worker-discipline for late/spoofed/foreign receipts] · B) Fail the entire request on any orphan (Meta will retry — but same orphan will re-fail forever) · C) Store in a limbo `pending_receipts` table (out of MVP scope).
- **GAP T15-#5 — Idempotency for delivery_receipts (Q-B-06 extension?)**: Unlike T12's `webhook_events` (1 row per POST), `delivery_receipts` NATURALLY allows multiple rows per `external_id` — status progression `sent → delivered → read` produces 3 rows for the same message. So Q-B-06 (webhook_events.external_id dedup) doesn't apply. But Meta CAN retry the SAME status (network timeout) → producing duplicate `(dispatch_id, external_id, status)` triples. **Options**: A) Accept multi-row per triple in primitive; dedup handled at T15-followup with UNIQUE index migration (Q-B-07 potential) [my default; matches spec's "delivery_receipts_status_check" as only constraint] · B) Compute synthetic dedup key at runtime · C) Block on Q-B-06/Q-B-07.
- **GAP T15-#6 — Primitive scope depth**: T12 modified-B envelope is 9 files with 2 type-only ports. T15 has no ports (receiver-only) → simpler shape. **Options**: A) 7 files (4 source + 3 tests) — matches T12 minus the 2 ports [my default] · B) 9 files including ports (invented HC callback for read-message-triggers-ticket-status — over-engineered) · C) 5 files (drop repo tests) — Prisma-mock stopgap questionable but PM has accepted 4× cross-primitive.
- **GAP T15-#7 — Barrel discipline confirmation** (informational, not a blocker): T15 has NO adapter files (receiver-only), so `no-restricted-imports` `**/adapters/*` rule is moot. Barrel additive with types + schemas + repo class + service class. 6th cross-primitive confirmation of the T06 barrel pattern (T10, T16, T11, T12 all preserve; T15 continues).

Awaiting PM B ACK on GAPs #1–#7 (esp. #1 cross-table repo, #4 orphan handling, #6 scope) before writing any code.

##### PM B ACK — T15 PLAN attempt 1 APPROVED, proceed to coding (H17, 2026-07-05) by PM B (Nanak)

**ACK clean** — all 7 GAP defaults confirmed spec-aligned. No scope narrow needed (7 files is already tighter than T12's 9, no ports needed for receiver-only flow). Filing **Q-B-07** as OPTIONAL future enhancement (not blocking primitive). No cross-service escalations required — T15 is genuinely receiver-only.

**Independent spec verification** (PM read):
- `04 §4.6 L263-272` DDL — `delivery_receipts.dispatch_id UUID NOT NULL REFERENCES outbound_dispatch_queue(id) ON DELETE CASCADE` **CONFIRMED VERBATIM**. Executor's critical constraint claim accurate. Correlation is DDL-mandated before persist — orphans cannot be inserted with NULL FK. ✓
- `04 §4.6 L269` `status VARCHAR(20) NOT NULL` with CHECK `('sent','delivered','read','failed')`. Only CHECK constraint on status — **NO UNIQUE index on `(dispatch_id, external_id, status)` triple**. Multi-row per triple natively allowed (status progression `sent → delivered → read` produces 3 rows for same message). ✓
- `04 §4.5 L245-257` `outbound_dispatch_queue.external_id VARCHAR(80) NULL` + `idx_outbound_external ... WHERE external_id IS NOT NULL` (partial index — Q-A-02 spec-faithful pattern). Correlation-lookup infrastructure in place. ✓
- Prisma `DeliveryReceipt` model (schema.prisma:108-119) matches DDL 1:1 — NOT NULL FK with `onDelete: Cascade`, `@db.VarChar(80)` + `@db.VarChar(20)`, 2 indexes only (`hotelId`, `dispatchId`), no unique on triple. ✓
- `MVP §1.2 B7 L38` — "Delivery receipts ingest — part of B3 (WA Cloud sends receipts in same webhook stream)" ✓
- `MVP §5 AC L121` — WA outbound AC references receipt correlation `outbound_dispatch_queue` row → `status: 'sent'`, `external_id` populated. Confirms T13 will write `external_id` on send confirmation; T15 reads for correlation. Split is clean. ✓
- `04 §3.1 L106` — "Persists delivery receipt when WA Cloud webhook returns" ✓
- **Q-B-06 relevance**: verified — Q-B-06 covers `webhook_events.external_id` dedup for inbound messages (spec §4.6 MVP L100). `delivery_receipts` semantics differ (multi-row status progression is intended). Q-B-06 does NOT apply. ✓

---

**GAP decisions** (A/B/C per GAP with rationale):

- **GAP T15-#1 (cross-table repo ownership)** — **A** (T15 repo owns `findDispatchByExternalId` READ on `outbound_dispatch_queue` + `persist` WRITE on `delivery_receipts`). Rationale: delivery-receipts concern legitimately spans both tables (correlation is intrinsic to the flow); T13's future `WhatsappOutboundDispatchRepository` WRITES `external_id` on send-confirmation, T15 READS it — clean orthogonal split, no method-shape collision. Sibling-in-module pattern extends T10/T11/T12 discipline. B (wait for T13) blocks T15 on unstarted work + T13 isn't even on the queue yet. C (direct Prisma in service) violates MODULE_TEMPLATE. **Tenant guard MANDATORY**: `findDispatchByExternalId(hotelId, externalId)` filters by BOTH in `where` clause — prevents cross-tenant orphan hijack (would let hotel-A receipt correlate to hotel-B dispatch if we forget hotelId).

- **GAP T15-#2 (webhook_events persistence responsibility)** — **A** (router-layer persistence via T12's `WhatsappWebhookEventsRepository.persist` ONCE per POST BEFORE branch discrimination; T15 service handles ONLY `delivery_receipts` writes). Rationale: matches T12 division of labor + preserves audit-trail single-source-of-truth. Router at T15-followup calls (a) `webhookEventsRepo.persist(...)` for audit, (b) T12 `WhatsappInboundIngestService.ingestSync(...)` if messages branch present, (c) T15 `WhatsappDeliveryReceiptsService.ingestStatuses(...)` if statuses branch present. Each service is single-concern.

- **GAP T15-#3 (async worker leg)** — **A** (NO async leg). T15 is receiver-only — no external RPC calls (no HC guest-upsert, no AI inbound, no Meta callback). Sync `ingestStatuses` does the full flow inline. Spec §4.7 persist-fast-return-200 timeout budget is preserved because per-receipt work is a fast DB read + write; if this ever becomes slow, T15-followup CAN add async worker separately. B (deferred HC callback for ticket status update on read/failed) is not spec-mandated for MVP and belongs in a future spec ratification, not T15 primitive.

- **GAP T15-#4 (orphan handling)** — **A** (skip + log warn + `orphanCount` in service return). Rationale: DDL FK NOT NULL makes insert-with-null-FK physically impossible; late/spoofed/foreign receipts are LEGITIMATE outcomes of a shared webhook endpoint (Meta may retry old receipts after T13-followup deletes an outbound row; spoofed request post-signature-verify still gets to service; foreign Meta accounts sharing bot phone in unusual multi-tenancy scenarios). Worker-discipline for graceful degradation matches T11 probe + T12 async no-throw pattern EXTENDED to sync-with-per-item-failure. B (fail-hard-request) triggers Meta retry storm on same orphan forever + drops all sibling non-orphan statuses in same POST. C (limbo table) is out of MVP scope.
  - **Orphan outcome shape**: `{externalId, status, dispatched: false, error: 'orphan_no_dispatch'}` — testable string; consistent with T12's `IngestOutcome.error: string`.
  - **Spec §9 check** (per user instruction): no `RECEIPT_ORPHANED` code exists in spec §9 error catalog; no dedicated AppError class needed. Skip + record in outcome + log warn is correct posture.

- **GAP T15-#5 (idempotency for duplicate status triples)** — **A** + **FILE Q-B-07** (optional future enhancement, not blocking primitive). Rationale: Multi-row per `(dispatch_id, external_id, status)` triple is NATIVE to `delivery_receipts` semantics (status progression). But Meta retry on network timeout CAN produce true duplicates (same status re-delivered) — currently accepted. **Q-B-07 filed**: proposes `UNIQUE (dispatch_id, external_id, status)` schema addition + `ON CONFLICT DO NOTHING` upsert semantic in repo. Schema addition is Nathan/T02 territory. T15 primitive accepts multi-row + docstrings the trade-off. T15-followup can wire ON CONFLICT once Q-B-07 lands.
  - Docstring stamp in `whatsapp-delivery-receipts.schema.ts` explaining: "Multi-row per `(dispatch_id, external_id, status)` triple is native to `delivery_receipts` semantics (progression). Q-B-07 potential future enhancement adds UNIQUE constraint to dedup Meta retries; not applied in primitive."

- **GAP T15-#6 (scope depth)** — **A** (7 files, no ports). Rationale: T15 is receiver-only — no HC callback, no AI RPC, no Meta call, no external HTTP. Ports would be inventing abstraction for nothing. B (9 files with invented HC ticket-status callback) over-engineers + would require Q-B-08 for another cross-service contract we don't need. C (5 files, drop repo tests) is unjustified — Prisma-mock stopgap is now 5× cross-primitive precedent (T10/T11/T12/T16 all use it; skipping repo test in T15 would break coverage consistency).

- **GAP T15-#7 (barrel discipline)** — **informational, no decision needed**. T15 has NO adapters, so `no-restricted-imports` `'**/adapters/*'` rule is moot. Barrel exposes types + schemas + repo class + service class. **6th cross-primitive confirmation** of the T06 barrel pattern (T10, T16, T11, T12 all preserve; T15 extends). This is now a fixed norm.

---

**Q escalation filed** (§3 mirror below + PARENT §3a):

- **Q-B-07** (schema follow-up, Nathan T02 territory, OPTIONAL enhancement) — `delivery_receipts` UNIQUE constraint on `(dispatch_id, external_id, status)` triple + partial UNIQUE index for retry idempotency + `ON CONFLICT DO NOTHING` upsert semantic. Meta CAN send duplicate status events on network retry — currently produces duplicate DB rows. Not blocking T15 primitive (multi-row accepted); enhancement lands at T15-followup once schema-add ratifies. Sibling to Q-B-06 pattern (schema drift enhancement).

---

**Binding conditions for SUBMIT** (extending T12's 16-item pattern for T15 specifics — 18 items total):

**Quality gate**
1. `make check` PASS end-to-end. Zero lint / format / typecheck / test failures.
2. Drift scans per PM-AGENT §3 Step 2 — 6 categories = 0 hits on T15 module files. Special attention: **NO `throw new Error(`** anywhere in module (schema-parse fails → `ValidationError`; orphan/repo-persist fails → outcome error string, service continues); **NO `throw new WebhookVerificationError`** (T11 concern, unrelated); **NO `as any` / `as unknown as` pattern-abuse** — `IngestOutcome`-like union types encoded cleanly.
3. Coverage **100% stmt/branch/func/line** on 3 runtime files (`whatsapp-delivery-receipts.schema.ts`, `.repository.ts`, `.service.ts`). Type-only file (`.types.ts`) erased at compile per ts-jest — expected.

**Design gate (each MUST be present + provable via test evidence)**
4. **Repository EXACTLY 2 methods**: `findDispatchByExternalId(hotelId, externalId)` + `persist(input)`. NO `markProcessed` / `markFailed` (those are T12 `webhook_events` concern). Test file has ≥ 3 cases: `find` happy (dispatch found), `find` null (orphan), `persist` happy.
5. **Repository tenant guard MANDATORY** — `findDispatchByExternalId` Prisma `where` filters BOTH `hotelId` AND `externalId`. Test asserts `db.outboundDispatch.findFirst.mock.calls[0][0].where` contains both fields. Cross-tenant hijack prevention is non-negotiable security floor.
6. **Service signature-agnostic** — `ingestStatuses(hotelId, envelope, signatureValid)` accepts `signatureValid: boolean` parameter (T12 precedent). Service NEVER computes signature. HMAC-agnostic docstring on service explains T04-plugin-at-wiring pattern.
7. **Service returns rich result, never throws for per-status failures** — `WhatsappDeliveryReceiptsIngestResult = { receipts: DeliveryReceiptIngestOutcome[], orphanCount: number }`. Test asserts `.resolves.toEqual(...)` for orphan cases + repo-persist-fail cases; ZERO `.rejects` on per-status failure paths.
8. **Sync throws only `ValidationError`** on schema-parse fail. Test asserts `.rejects.toBeInstanceOf(ValidationError)`. Only throw path in the service.
9. **Orphan handling — 3 assertions in the test suite**:
   - Orphan externalId → skip persist, `orphanCount++`, receipt outcome `{dispatched: false, error: 'orphan_no_dispatch'}` (or equivalent stable string)
   - Multi-status mix (2 found + 1 orphan) → `receipts[].length === 3` (all 3 status entries reflected in outcomes), `orphanCount === 1`, `persist` called exactly 2×
   - `repo.persist` fails on one entry (e.g. FK violation somehow bypassed check) → outcome for that entry has `dispatched: false, error: <string>`, service returns normally, remaining entries continue
10. **Multi-row per external_id status progression accepted** — test with 3 statuses (`sent, delivered, read` of same `externalId`) → all 3 persist calls succeed + `receipts[].length === 3` + `persist` called exactly 3×. No dedup logic in primitive. Docstring notes Q-B-07 T15-followup will add UNIQUE + ON CONFLICT semantics.
11. **PII floor via `maskWaPhone(recipientId)`** — service log statements mask; test asserts (a) `logger.info.mock.calls[N][0].recipientId === maskWaPhone(RAW_PHONE)`, (b) `JSON.stringify(logged).not.toContain(RAW_PHONE)`, (c) `JSON.stringify(logged).length < 500` heuristic. T10-a2/T11/T12 pattern.

**Scope gate**
12. `git diff --stat main..HEAD` — must show exactly **7 create + 1 modify** = 8 files. Zero touches to `api.ts`, `worker.ts`, `plugins/*` (T04/T05/T09 — do NOT mutate), `prisma/*`, `package.json`, `pnpm-lock.yaml`, T06/T10/T11/T12/T16 files (byte-for-byte), `_template/*`, `telegram/*`, `core/http/*`, `core/prisma/*`.
13. **Barrel additive-only** — T06 (L1-7) + T10 (L9-18) + T16 (L20-44) + T11 (L46-56) + T12 (L58-79) blocks byte-for-byte preserved. T15 exports appended after L79. NO adapter re-export (informational — T15 has no adapters; **6th cross-primitive T06 discipline confirmation**).

**Documentation gate**
14. **HMAC-agnostic docstring** — service `.service.ts` docstring notes: "**HMAC-agnostic**: signature verification lives at T04 HMAC plugin (router-layer preHandler); this service consumes `signatureValid` as a trusted boolean parameter. T12 precedent extended to statuses branch."
15. **Router-boundary docstring** — service `.service.ts` docstring notes: "T15-followup router discriminates payload branch (`messages` → T12, `statuses` → T15, template branch → T16) and persists the `webhook_events` audit row ONCE via T12's `WhatsappWebhookEventsRepository.persist` BEFORE calling this service. No cross-service RPCs — receiver-only flow."
16. **Orphan-outcome docstring** — service `.service.ts` docstring above `ingestStatuses` notes: "**Orphans**: `externalId` not in `outbound_dispatch_queue` (late / spoofed / foreign receipts) skipped + logged warn + counted in `orphanCount`. Never throws per-status. Sync worker-discipline extended from T11 probe + T12 async patterns."
17. **Multi-row / Q-B-07 docstring** — schema `.schema.ts` or types `.types.ts` docstring notes: "Multi-row per `(dispatch_id, external_id, status)` triple is native to `delivery_receipts` DDL (only status CHECK; no UNIQUE). Q-B-07 potential future enhancement adds UNIQUE + ON CONFLICT for retry idempotency; not applied in primitive."

**Discipline gate**
18. **No `as string` / `as X` pattern** — one-off `IngestOutcome`-like invariant assertion (T12 tolerated deviation) should NOT be needed here because T15's per-status outcome union is simpler (no cross-message state tracking). If Executor finds themselves reaching for a type assertion, prefer to encode the shape as a discriminated union up-front — the T12 future-refactor recommendation applies pre-emptively. If PM sees `as string` in code, that's a REJECT.

**Tolerated deviations to declare in SUBMIT §Notes** (pre-accepted):
- Prisma-mock stopgap in `.repository.test.ts` — T10/T11/T12/T16 stopgap precedent (5× now); T15-INTEG follow-up parked awaiting Q-C-01.
- Multi-row per triple accepted — Q-B-07 filed as future enhancement (not blocking).
- `HttpPoster` misnomer / any-other-existing tolerated pattern — moot (T15 has no HTTP adapter).
- Q-A-03 test-env workaround MAY re-appear if service test needs env — cross-slot pattern, not on slot B to solve.

**Follow-ups to file in SUBMIT** (list, do NOT implement):
- **T15-followup** — router branch discrimination + `statuses` handler wiring in the T12-followup router (piggyback signature verify at T04 wiring per Q-A-04 resolution). Optional: `ON CONFLICT DO NOTHING` upsert semantic once Q-B-07 schema-add lands. Blocked on Q-A-04 + Q-C-02 + T12-followup router structure.
- **T15-INTEG** — real-DB integration test with populated `outbound_dispatch_queue` rows (testcontainers Postgres). Blocked on Q-C-01 + T13 (which writes `external_id` on send confirmation).

**Discipline**:
- Branch `feat/wa-delivery-receipts` per CLAUDE §12.
- Conventional commit: `feat(whatsapp): T15 delivery receipts ingest primitive (types + schema + repo + service)`.
- Single commit for the primitive.
- Push branch; do NOT open PR until PM B rerun locally + says "open PR" in VERDICT.
- **Squash-merge**: T12 established the CLAUDE §12 precedent (PR #14). PR #15 for T15 SHOULD follow same pattern.

**Rebuttal channel**: If any of the 18 conditions, 7 GAP decisions, or Q-B-07 escalation feels wrong for T15, post `REBUTTAL T15 item-#N` before coding — PM B re-checks in-session.

**No attempt-2 PLAN required** — all 7 GAP defaults ACK'd + Q-B-07 optional-future filing doesn't affect primitive shape. Executor codes directly per 7-file inventory + 18 binding conditions + Q-B-07 stamp.

Proceed. Run `make prisma-generate` if not fresh → code per §Approach 1-8 → `make check` → SUBMIT.

#### SUBMIT T15 — exec-B (Nanak) at H17 18:35 (attempt 1, narrow primitive per PM ACK clean-approval 7-file inventory)

Task: T15 — WA delivery receipts ingest **primitive** (types + Meta statuses envelope schema + cross-table sibling repository + single-method sync service — no ports, no adapters, receiver-only flow). Clean-approval per PM ACK: all 7 GAP defaults spec-aligned, no scope narrow needed (T15's shape is intrinsically slimmer than T12 modified-B because no external RPCs). Branch: `feat/wa-delivery-receipts` @ commit `a1576f5`.

Files changed: **8** (7 create + 1 modify) — **1177 insertions** total (1162 new-file LOC + 15 net barrel delta; single prettier-collapse iteration on schema test).
- `src/modules/whatsapp/whatsapp-delivery-receipts.types.ts` (new, 73 LOC — **discriminated union outcome** per binding #18)
- `src/modules/whatsapp/whatsapp-delivery-receipts.schema.ts` (new, 100 LOC — Meta statuses envelope + `extractStatuses` helper + Q-B-07 stamp)
- `src/modules/whatsapp/whatsapp-delivery-receipts.repository.ts` (new, 42 LOC — **EXACTLY 2 methods** per binding #4, cross-table by design)
- `src/modules/whatsapp/whatsapp-delivery-receipts.service.ts` (new, 167 LOC — 4 mandated docstrings, discriminated-union outcome return, single-method sync)
- `src/modules/whatsapp/__tests__/whatsapp-delivery-receipts.schema.test.ts` (new, ~221 LOC post-prettier, 11 tests: 7 envelope parse + 4 extract normalization)
- `src/modules/whatsapp/__tests__/whatsapp-delivery-receipts.repository.test.ts` (new, 151 LOC, 5 tests: 3 for `findDispatchByExternalId` including tenant-guard cross-check + 2 for `persist`)
- `src/modules/whatsapp/__tests__/whatsapp-delivery-receipts.service.test.ts` (new, 408 LOC, 12 tests: happy/multi-row/orphan/persist-fail/signature-valid/PII floor)
- `src/modules/whatsapp/index.ts` (modified, +15 net) — additive; T06 (L1-7) + T10 (L9-18) + T16 (L20-44) + T11 (L46-56) + T12 (L58-79) blocks byte-for-byte preserved; T15 exports L81-95

DoD self-check — **all 18 ACK binding conditions**:
- [x] **#1 `make check` PASS end-to-end** — lint 0/0 (`--max-warnings 0`), format-check clean, typecheck strict + `exactOptionalPropertyTypes`, test-unit 28/30 suites 276/278 tests (2 pre-existing `_template/*` baseline skips). PM B rerun invited.
- [x] **#2 Drift scans 0 hits on T15 module files** — all 6 EXECUTOR §4.4 categories. Special-attention verified: **NO `throw new Error(`** in module (drift scan #3 returns 0 hits; sync throws `ValidationError` only, per-status failures return outcome error strings); **NO `throw new WebhookVerificationError`** (T11 concern, unrelated); **NO `as any` / `as unknown as` pattern-abuse** in code — see also §Notes on `as string`.
- [x] **#3 Coverage 100% stmt/branch/func/line** on 3 runtime files — **first-pass, no iteration** (discriminated-union outcome eliminated the T12 `firstError ?? 'unknown error'` unreachable-branch problem). Type-only `whatsapp-delivery-receipts.types.ts` erased at compile per ts-jest — matches ACK #3 caveat.
- [x] **#4 Repository EXACTLY 2 methods** — `whatsapp-delivery-receipts.repository.ts` grep confirms: `findDispatchByExternalId` (`:22`), `persist` (`:29`). NO `markProcessed` / `markFailed` (that's T12 `webhook_events` concern; T15 has different lifecycle — receipts are terminal). Test file has 5 cases: 3 for `findDispatchByExternalId` (happy + null + cross-tenant safety) + 2 for `persist` (happy + Prisma rejection propagates).
- [x] **#5 Repository tenant guard MANDATORY** — `repository.ts:23-27` `findFirst({ where: { hotelId, externalId } })` filters BOTH fields. Test `whatsapp-delivery-receipts.repository.test.ts:73-83` asserts `double.outboundDispatch.findFirst.mock.calls[0][0]` = `{ where: { hotelId, externalId } }` — both fields present. Additional cross-tenant test at `:95-105` asserts hotelId-swap does NOT hijack: `HOTEL_ID_OTHER` in query → repo filters correctly by that id, doesn't hit HOTEL_ID's dispatches. Cross-tenant hijack prevention is non-negotiable security floor. ✓
- [x] **#6 Service signature-agnostic** — `service.ts:70` `ingestStatuses(hotelId, envelope, signatureValid)` accepts `signatureValid: boolean` as parameter. `:83` propagates to ingest-level log. Service NEVER computes signature. HMAC-agnostic docstring `:9-13` explains T04-plugin-at-wiring pattern (see #14).
- [x] **#7 Service returns rich result, never throws for per-status failures** — service `:78` returns `{receipts, orphanCount}`. Test asserts `.resolves.toEqual(...)` for:
  - orphan (correlation returns null): `whatsapp-delivery-receipts.service.test.ts:154-171`
  - correlation lookup itself rejects: `:206-219`
  - per-persist reject (mid-batch): `:239-262`
  - non-Error persist rejection: `:264-280`
  Zero `.rejects` on per-status failure paths. Discriminated union outcome ensures type-safe access to `receipt.receiptId` (dispatched=true) vs `receipt.error` (dispatched=false).
- [x] **#8 Sync throws only `ValidationError`** — service `:71-75` is the only throw path. Test `:325-334` asserts `.rejects.toBeInstanceOf(ValidationError)` on bad envelope.
- [x] **#9 Orphan handling — 3 assertions** ✓:
  - **Assertion 1** (`:154-171` "should skip persist + log warn + increment orphanCount when the dispatch is not found"): outcome `{dispatched: false, error: 'orphan_no_dispatch'}` (stable string per binding #9); `orphanCount === 1`; `persist` NOT called; `logger.warn` called
  - **Assertion 2** (`:173-197` "should reflect mixed found+orphan in per-status outcomes when the envelope carries 3 status entries"): `receipts.length === 3` (all 3 reflected), `orphanCount === 1`, `persist` called exactly 2×
  - **Assertion 3** (`:239-262` "should record a failed outcome + log error + continue processing when a single persist fails"): mid-batch persist fails, outcome error contains `'persist'`, service continues remaining entries
- [x] **#10 Multi-row per external_id status progression accepted** — service test `:126-144` dedicated case: sent → delivered → read of same externalId → all 3 persist calls succeed, `receipts.length === 3`, all `dispatched === true`, `persist` called exactly 3×. Docstring `types.ts:12-20` + `schema.ts:9-17` notes Q-B-07 T15-followup will add UNIQUE + ON CONFLICT for Meta-retry idempotency.
- [x] **#11 PII floor via `maskWaPhone(recipientId)`** — service `:107` masks recipientId in `LOG_RECEIPT`. Test `:359-378` asserts (a) `logged.recipientId === maskWaPhone(RECIPIENT)`, (b) `JSON.stringify(logged)` does NOT contain raw `RECIPIENT`, (c) `JSON.stringify(logged).length < 500`. Additional test `:380-407` asserts recipientId key OMITTED (not `undefined`) when Meta didn't send one — matches `exactOptionalPropertyTypes` shape hygiene.
- [x] **#12 `git diff --stat main..HEAD` scope-clean** — exactly 7 create + 1 modify = 8 files. Zero touches to `api.ts`, `worker.ts`, T04/T05/T09 plugins (do NOT mutate), `prisma/*`, `package.json`, `pnpm-lock.yaml`, T06/T10/T11/T12/T16 primitive files, `_template/*`, `telegram/*`, `core/http/*`, `core/prisma/*`.
- [x] **#13 Barrel additive-only** — `src/modules/whatsapp/index.ts`: T06 (L1-7) + T10 (L9-18) + T16 (L20-44) + T11 (L46-56) + T12 (L58-79) blocks byte-for-byte preserved. T15 exports appended L81-95. **NO adapter re-export** — `grep -E "adapters/" src/modules/whatsapp/index.ts` returns 0 hits. **6th cross-primitive T06 discipline confirmation** (T10, T16, T11, T12, T15 all preserve — fixed norm per ACK GAP #7).
- [x] **#14 HMAC-agnostic docstring** — service `:9-13` explicitly notes: "**HMAC-agnostic**: signature verification lives at the T04 HMAC plugin (router-layer preHandler); this service consumes `signatureValid` as a trusted boolean parameter. T12 precedent extended to the statuses branch."
- [x] **#15 Router-boundary docstring** — service `:15-19` explicitly notes: "**Router-boundary**: T15-followup router discriminates payload branch (`messages` → T12, `statuses` → T15, template branch → T16) and persists the `webhook_events` audit row ONCE via T12's `WhatsappWebhookEventsRepository.persist` BEFORE calling this service. No cross-service RPCs — receiver-only flow."
- [x] **#16 Orphan-outcome docstring** — service `:21-26` explicitly notes: "**Orphans**: `externalId` not in `outbound_dispatch_queue` (late / spoofed / foreign receipts) skipped + logged warn + counted in `orphanCount`. Never throws per-status. Sync worker-discipline extended from T11 probe + T12 async patterns (T12 tolerated-deviation lesson pre-applied: outcome shape is a discriminated union — no `as string` needed)."
- [x] **#17 Multi-row / Q-B-07 docstring** — `whatsapp-delivery-receipts.types.ts:12-20` + `schema.ts:9-17` both carry Q-B-07 stamp explaining multi-row per `(dispatch_id, external_id, status)` triple is native to DDL (only status CHECK, no UNIQUE) + Q-B-07 T15-followup will add UNIQUE + ON CONFLICT semantics for Meta-retry idempotency.
- [x] **#18 No `as string` / `as X` pattern** — grep on runtime files: 3 hits, all safe:
  - `schema.ts:27` — `['sent', 'delivered', 'read', 'failed'] as const` (idiomatic zod enum pattern, T10/T11/T12 all use)
  - `service.ts:24` — literal `` "as `as string` needed" `` in docstring (referencing the T12 pattern to explain why we don't use it)
  - `types.ts:53` — literal `` "as `as string` / `as X` casts needed anywhere" `` in docstring (same reference)
  **Zero actual `as string` / `as X` type assertions in code.** Discriminated union `DeliveryReceiptIngestOutcome` at `types.ts:39-52` proves via TypeScript that `receiptId` exists when `dispatched: true` and `error` exists when `dispatched: false` — no cast needed.

Quality gate
- `make typecheck`: PASS (0 errors, strict + `exactOptionalPropertyTypes`)
- `make lint`: PASS (0 errors, 0 warnings — `eslint . --max-warnings 0`)
- `make format-check`: PASS (all matched files use Prettier code style)
- `make test-unit`: PASS (28 of 30 suites, 276 of 278 tests — 2 pre-existing baseline skips in `_template/*`; my 3 new suites 28/28 pass — 248 previous approved baseline + 28 T15 = 276)
- `make check`: PASS end-to-end (concatenation of the above)

Drift scans (all 6 EXECUTOR §4.4 categories — 0 hits on T15 module files)
- `any` types: 0 (pre-existing 2 in `_template/*` untouched — same baseline as T10/T11/T12/T16 approved)
- `console.log/info/debug`: 0 (repo-wide 0)
- `throw new Error(` in `src/modules/` + `src/core/`: 0 in module scope (pre-existing 4 in `_template/*` + `core/config/env.ts:75` + `core/http/http-client.ts:19,27` — all untouched)
- Forbidden imports: 0 (repo-wide 0)
- `^export default ` outside entrypoints/config: 0 (repo-wide 0)
- `.skip(` in `*.test.ts`: 0 in module scope (pre-existing 2 in `_template/*` untouched)

Security check (CLAUDE §6 + spec §4.6 + PM ACK design intent)
- **Signature-agnostic service** — `service.ts:70` `ingestStatuses(hotelId, envelope, signatureValid)` accepts trusted `signatureValid` input; T04 plugin at router-layer wiring (T15-followup) sets the flag before calling service. Docstring `:9-13` cross-references T12 precedent. Primitive genuinely agnostic.
- **Persist-always audit trail via router at T12 repo** — per PM ACK GAP T15-#2 A, router persists `webhook_events` once per POST via T12's `WhatsappWebhookEventsRepository` BEFORE branch discrimination. T15 service handles ONLY `delivery_receipts` writes. `signatureValid` propagates in T15's ingest-level log for observability (test at `:314-327` asserts propagation).
- **Orphan handling: skip + log warn + orphanCount++** — DDL FK CASCADE means physical impossible to insert orphan with NULL FK. Service takes the graceful-degradation path (worker-discipline) rather than fail-hard-request-then-Meta-retry-storm. Verified in 3+ test cases per binding #9.
- **Multi-row status progression accepted** — spec §4.6 has only status CHECK; no UNIQUE on `(dispatch_id, external_id, status)` triple. Test `:126-144` confirms 3 persists succeed on sent → delivered → read.
- **Per-status never throws (rich discriminated union outcome)** — test cases cover 4 failure paths that all return outcome shape without throwing.
- **Sync throws only `ValidationError`** — test `:325-334` asserts on bad envelope; all other paths use `.resolves`.
- **PII floor via `maskWaPhone`** — service `:107` mask; test `:359-378` asserts positive + negative + length heuristic + optional-omit; test `:380-407` asserts omit-when-absent.
- **Tenant guard MANDATORY** — repo `:23-27` filters BOTH `hotelId` AND `externalId`; test asserts both fields present + cross-tenant safety at `:95-105`.

Test evidence
- Unit: **28 tests, 3 suites** — `whatsapp-delivery-receipts.schema.test.ts` (11: 7 envelope + 4 extract), `whatsapp-delivery-receipts.repository.test.ts` (5: 3 findDispatch + 2 persist), `whatsapp-delivery-receipts.service.test.ts` (12: 2 happy + 1 multi-row + 4 orphan/repo-fail + 2 signature/validation + 2 PII floor)
- Integration: 0 — deferred as **T15-INTEG** follow-up (see §Follow-ups); repository test uses Prisma-mock stopgap per T10/T11/T12/T16 precedent (5× now)
- Coverage (jest, scoped to 3 runtime files):
  ```
  File                                      | % Stmts | % Branch | % Funcs | % Lines
  ------------------------------------------|---------|----------|---------|--------
  All files                                 |   100   |   100    |   100   |   100
   whatsapp-delivery-receipts.repository.ts |   100   |   100    |   100   |   100
   whatsapp-delivery-receipts.schema.ts     |   100   |   100    |   100   |   100
   whatsapp-delivery-receipts.service.ts    |   100   |   100    |   100   |   100
  ```
  Type-only `whatsapp-delivery-receipts.types.ts` erased at compile per ts-jest, not instrumented. Matches ACK #3 caveat.
  **First-pass 100% coverage on all 3 runtime files** — no branch-coverage iteration needed (contrast T12 attempt 1 which needed `firstError ?? 'unknown error'` fix). The discriminated-union outcome shape encoded upfront eliminated the unreachable-branch problem categorically.

Notes / discipline discoveries / tolerated deviations
- **NO `as string` recurrence — discriminated union pattern encoded up-front per PM ACK design nudge** (T12 tolerated-deviation lesson pre-applied). Type-level enforcement via `DeliveryReceiptIngestOutcome = { dispatched: true; receiptId: string } | { dispatched: false; error: string }` at `types.ts:39-52` means TypeScript proves member access is type-safe without any cast. Result: **first-pass 100% coverage** (no branch coverage remediation needed).
- **First-pass 100% coverage on 3 runtime files** — no branch coverage iteration needed. The discriminated-union pattern eliminated the "unreachable fallback branch" pattern that plagued T12 attempt 1.
- **6th cross-primitive T06 barrel discipline confirmation** — T10 + T16 + T11 + T12 + T15 all preserve `no-restricted-imports` `**/adapters/*'` discipline byte-for-byte (T15 has no adapters so the rule is moot but the additive barrel append respected the pattern anyway). Now a fixed norm per PM ACK GAP T15-#7.
- **Round 1 prettier collapse only** — `pnpm prettier --write` on `whatsapp-delivery-receipts.schema.test.ts` (single file). No other iterations required. Semantic content identical.
- **Actual test count 28 (not 29 pre-estimated)** — my report before self-validate estimated 29; actual is 28. Doesn't affect binding.
- **T15 tolerated deviations (per ACK pre-accept)**:
  - Prisma-mock stopgap in `whatsapp-delivery-receipts.repository.test.ts` (T10/T11/T12/T16 precedent, 5× now) — T15-INTEG follow-up parked pending Q-C-01 + T13.
  - Multi-row per triple accepted — Q-B-07 filed as optional future enhancement (not blocking).
  - Q-A-03 test-env workaround NOT triggered — service test uses no crypto / no env-key seeding (T15 has no plaintext secrets in-flow).

Q register / follow-ups
- **Q-B-07 stamp embedded** — `types.ts:12-20` + `schema.ts:9-17` docstrings both carry the stamp explaining multi-row per `(dispatch_id, external_id, status)` triple is native to DDL. Q-B-07 (optional future enhancement) is filed at PM B ACK time; primitive accepts multi-row + T15-followup can wire `ON CONFLICT DO NOTHING` upsert semantic after schema-add ratifies. No new Q filed during coding.
- **T15-followup** — router branch discrimination + `statuses` handler wiring in the T12-followup router (piggyback signature verify at T04 wiring per Q-A-04 resolution). Optional: `ON CONFLICT DO NOTHING` upsert semantic once Q-B-07 schema-add lands. Blocked on Q-A-04 + Q-C-02 + T12-followup router structure.
- **T15-INTEG** — real-DB integration test with populated `outbound_dispatch_queue` rows (testcontainers Postgres). Blocked on Q-C-01 + T13 (which writes `external_id` on send confirmation).

Requesting PM B VERDICT.

##### VERDICT T15 — APPROVED (H17, attempt 1, primitive) by PM B (Nanak)

✅ **APPROVED**. Independent PM rerun on `feat/wa-delivery-receipts @ a1576f5` (code) + `e491a16` (SUBMIT status). All 18 ACK binding conditions verified against code (file:line), not claim. Notable discipline win: **discriminated-union pattern encoded up-front successfully eliminated the T12 `as string` recurrence** — 100% first-pass coverage with zero runtime type casts. Ready for PR + squash-merge review.

**Independent verification trace** (rerun on PM shell, Node 22.23.1 + pnpm 9.0.0 via nvm/corepack):

- **`make check`** — **PASS end-to-end** (1.662s). `lint` clean (`eslint . --max-warnings 0`), `format-check` "All matched files use Prettier code style!", `typecheck` (`tsc --noEmit` strict + `exactOptionalPropertyTypes`) 0 errors, `test:unit` 28/30 suites passed (2 pre-existing `_template/*` baseline skips), 276/278 tests passed. My 3 new suites = **28/28 pass, 0 fail** (11 schema + 5 repo + 12 service).
- **Drift scans (6 EXECUTOR §4.4 categories)** on T15 scope — **all 0 hits**: `any` = 0, `console.log/info/debug` = 0, `throw new Error(` = 0, forbidden imports = 0, `^export default ` = 0, `.skip(` / `describe.skip` = 0.
  - **Special-attention `as string` gate** (T12 lesson): PM grep on runtime source files (`.ts`, excluding tests) returned **2 hits, both in DOCSTRINGS explaining why the pattern is avoided**:
    - `service.ts:24` — comment: `"...is a discriminated union — no \`as string\` needed"`
    - `types.ts:53` — comment: `"...no \`as string\` / \`as X\` casts needed anywhere in service or tests"`
  - Additional benign match `schema.ts:27` (`... as const` — idiomatic zod enum, T10/T11/T12 all use identically).
  - **Zero runtime `as string` / `as X` type assertions.** Binding #18 PASS.
- **Coverage rerun** (`pnpm test:coverage --collectCoverageFrom='src/modules/whatsapp/whatsapp-delivery-receipts.*.ts' --testPathPattern='whatsapp-delivery-receipts'`):
  ```
  File                                      | % Stmts | % Branch | % Funcs | % Lines
  All files                                 |   100   |   100    |   100   |   100
   whatsapp-delivery-receipts.repository.ts |   100   |   100    |   100   |   100
   whatsapp-delivery-receipts.schema.ts     |   100   |   100    |   100   |   100
   whatsapp-delivery-receipts.service.ts    |   100   |   100    |   100   |   100
  ```
  Type-only `whatsapp-delivery-receipts.types.ts` erased at compile per ts-jest — expected per ACK #3 caveat. **First-pass 100% — no branch-coverage iteration needed** (contrast T12 attempt 1 which needed the `firstError ?? 'unknown error'` fix). Discriminated-union up-front encoding categorically eliminated the T12 unreachable-fallback problem.
- **`git diff --stat main..feat/wa-delivery-receipts -- src/ prisma/ package.json pnpm-lock.yaml`** — exactly **7 create + 1 modify** = 8 files. Zero touches to `api.ts`, `worker.ts`, `plugins/*` (T04/T05/T09 preserved), `prisma/*`, `package.json`, T06/T10/T11/T12/T16 primitive files.

**18 binding conditions — file:line evidence**:

- **#1 `make check` PASS** — PM rerun above. ✓
- **#2 Drift scans + special-attention gates** — PM greps above. ✓
- **#3 Coverage 100% first-pass** — PM rerun above (3 runtime files). ✓
- **#4 Repository EXACTLY 2 methods** — `whatsapp-delivery-receipts.repository.ts`: `findDispatchByExternalId` (`:22`), `persist` (`:29`). NO `markProcessed` / `markFailed` (T12 concern; T15 lifecycle is terminal). Test file 5 cases: 3 for `findDispatchByExternalId` + 2 for `persist`. ✓
- **#5 Repository tenant guard MANDATORY** — PM inspected `repository.ts:23-27` `findFirst({ where: { hotelId, externalId } })` — BOTH fields present verbatim. Test `.repository.test.ts:73-83` asserts `where` includes both; test `:95-105` cross-tenant safety asserts `HOTEL_ID_OTHER` in query filters to only that tenant's dispatches (no hotel-A→hotel-B hijack). Security floor non-negotiable, passed. ✓
- **#6 Service signature-agnostic** — `service.ts:70` `ingestStatuses(hotelId, envelope, signatureValid)` accepts `signatureValid: boolean` param. Service NEVER computes signature. `:83` propagates to ingest-level log. ✓
- **#7 Service returns rich result, never throws for per-status failures** — service `:78` returns `{receipts, orphanCount}` (discriminated union receipts). Test `.resolves.toEqual(...)` for 4 failure paths: orphan (`:154-171`), correlation-lookup reject (`:206-219`), per-persist reject mid-batch (`:239-262`), non-Error persist rejection (`:264-280`). ZERO `.rejects` on per-status paths. ✓
- **#8 Sync throws only `ValidationError`** — service `:71-75` sole throw path. Test `:325-334` asserts `.rejects.toBeInstanceOf(ValidationError)`. ✓
- **#9 Orphan handling — 3 assertions** ✓:
  - Assertion 1 (`:154-171`): outcome `{dispatched: false, error: 'orphan_no_dispatch'}` + `orphanCount === 1` + `persist` NOT called + `logger.warn` called
  - Assertion 2 (`:173-197`): mixed 2-found + 1-orphan → `receipts.length === 3`, `orphanCount === 1`, `persist` called exactly 2×
  - Assertion 3 (`:239-262`): mid-batch persist fails → outcome error contains `'persist'`, service continues remaining entries
- **#10 Multi-row status progression accepted** — service test `:126-144` dedicated case: `sent → delivered → read` of same `externalId` → 3 persist calls succeed, `receipts.length === 3`, all `dispatched === true`. Docstring `types.ts:12-20` + `schema.ts:9-17` note Q-B-07 T15-followup. ✓
- **#11 PII floor via `maskWaPhone(recipientId)`** — service `:107` masks. Test `:359-378` asserts (a) `logged.recipientId === maskWaPhone(RECIPIENT)`, (b) `JSON.stringify(logged)` excludes raw `RECIPIENT`, (c) `length < 500`. Extra test `:380-407` asserts `recipientId` key OMITTED (not `undefined`) when Meta didn't send one (`exactOptionalPropertyTypes` shape hygiene). ✓
- **#12 `git diff --stat` scope-clean** — PM rerun above. 7 create + 1 modify, zero cross-boundary touches. ✓
- **#13 Barrel additive-only** — PM inspected `src/modules/whatsapp/index.ts`: T06 (L1-7) + T10 (L9-18) + T16 (L20-44) + T11 (L46-56) + T12 (L58-79) blocks byte-for-byte preserved. T15 exports appended L81-95. `grep "adapters/" src/modules/whatsapp/index.ts` → 0 hits. **6th cross-primitive T06 discipline confirmation** — fixed norm. ✓
- **#14 HMAC-agnostic docstring** — service `:9-13` verbatim: "**HMAC-agnostic**: signature verification lives at the T04 HMAC plugin (router-layer preHandler); this service consumes `signatureValid` as a trusted boolean parameter. T12 precedent extended to the statuses branch." ✓
- **#15 Router-boundary docstring** — service `:15-19` verbatim: "**Router-boundary**: T15-followup router discriminates payload branch (`messages` → T12, `statuses` → T15, template branch → T16) and persists the `webhook_events` audit row ONCE via T12's `WhatsappWebhookEventsRepository.persist` BEFORE calling this service. No cross-service RPCs — receiver-only flow." ✓
- **#16 Orphan-outcome docstring** — service `:21-26` verbatim: "**Orphans**: `externalId` not in `outbound_dispatch_queue` (late / spoofed / foreign receipts) skipped + logged warn + counted in `orphanCount`. Never throws per-status. Sync worker-discipline extended from T11 probe + T12 async patterns (T12 tolerated-deviation lesson pre-applied: outcome shape is a discriminated union — no `as string` needed)." ✓
- **#17 Multi-row / Q-B-07 docstring** — `types.ts:12-20` + `schema.ts:9-17` both carry Q-B-07 stamp: multi-row native to DDL; UNIQUE + ON CONFLICT DO NOTHING is T15-followup enhancement. ✓
- **#18 No `as string` / `as X` pattern in runtime** — PM grep confirmed 2 docstring-only hits + 1 idiomatic `as const`. Zero runtime type assertions. Discriminated union `DeliveryReceiptIngestOutcome` at `types.ts:52` (verified by PM: `type DeliveryReceiptIngestOutcome = { dispatched: true; ... receiptId: string } | { dispatched: false; ... error: string }`) proves via TypeScript that `receiptId` exists when `dispatched: true` and `error` exists when `dispatched: false` — no cast needed. **T12 lesson successfully applied pre-emptively.** ✓

**Spec-alignment audit**:
- `04 §4.6 L263-272` DDL — `dispatch_id UUID NOT NULL FK CASCADE` verified; multi-row per triple native (only status CHECK, no UNIQUE). Repo `persist` writes with FK-validated dispatchId; orphan skip prevents FK violations. ✓
- `04 §4.5 L245-257` — `outbound_dispatch_queue.external_id VARCHAR(80) NULL` + partial index for correlation. Repo `findDispatchByExternalId` uses this via Prisma `findFirst` with tenant+externalId filter. ✓
- `04 §3.1 L106` "Persists delivery receipt when WA Cloud webhook returns" — service `ingestStatuses` implements this leg (statuses branch of shared endpoint). ✓
- `MVP §1.2 B7` + `§5 AC L121` — T15 primitive lays the correlation-and-persist path; T13 will write the correlation source; router at T15-followup wires the branch discrimination. Clean split. ✓
- Q-B-06 correctly N/A — different semantics (delivery_receipts = status progression, not dedup). ✓

**Security floor check (CLAUDE §6)**:
- **Tenant guard mandatory** — repo `where: { hotelId, externalId }` prevents cross-tenant hijack; test asserts. ✓
- **Signature-agnostic** — T04 plugin at router-layer wiring; primitive genuinely agnostic. ✓
- **Orphan skip + log + count** — worker-discipline; graceful degradation over Meta-retry-storm. ✓
- **PII floor** — `maskWaPhone(recipientId)` + positive log-shape + negative plaintext + `length<500` heuristic + optional-omit test. ✓
- **Sync throws only `ValidationError`** — all other paths return outcome union. ✓
- **No hardcoded secrets** — T15 has no outbound HTTP. ✓

**Design win — discriminated union eliminates T12's `as string`**:
- `types.ts:39-52` explicit union:
  ```
  type DeliveryReceiptIngestOutcome =
    | { dispatched: true;  externalId; status; receiptId: string }
    | { dispatched: false; externalId; status; error: string }
  ```
- Service consuming the union at `:110-165` narrows via `if (!outcome.dispatched)` — TypeScript proves `error` field access is safe without any cast.
- **Result**: 100% coverage FIRST PASS. No branch-coverage remediation. No `as string` invariant lie.
- **Recommendation to Executor + adopting cross-slot**: this pattern (discriminated-union outcome up-front) is now the recommended approach for future primitives with per-item outcome shapes (T13/T14, and slot C future). PM B will flag in future ACKs as "adopt T15's discriminated-union outcome pattern".

**Tolerated deviations accepted** (all pre-declared per ACK):
- Prisma-mock stopgap in `.repository.test.ts` — T10/T11/T12/T16 precedent (5× now); T15-INTEG parked pending Q-C-01 + T13.
- Multi-row per triple accepted — Q-B-07 filed as optional future enhancement (not blocking).
- Actual test count 28 (not 29 pre-estimated) — negligible variance.
- Prettier collapse on schema test file — semantic identical.

**Follow-ups accepted** (files, do not action):
- **T15-followup**: router branch discrimination + `statuses` handler wiring + optional `ON CONFLICT DO NOTHING` upsert post-Q-B-07. Blocked on Q-A-04 + Q-C-02 + T12-followup router structure.
- **T15-INTEG**: real-DB integration test with populated `outbound_dispatch_queue` rows. Blocked on Q-C-01 + T13.

**Actions taken**:
- → §1 task tracker row for T15 updated (`backlog` → `approved (primitive)` with `PM B (H17, a1)` verified-by).
- → PARENT §1 row for T15 mirrored (same shape as T10/T11/T12/T16).
- → PARENT §2 short roll-up appended (1 line, format per `PM-AGENT.md §0.8`, append-at-bottom; noting discriminated-union pattern win).

**Next expected action**: Executor B open PR on `feat/wa-delivery-receipts` for PO merge review; PM B re-verify on CI green post-PR; **PR SHOULD squash-merge per PR #14 CLAUDE §12 precedent** (guide session handles). **Slot B progress: 5/7 (T10 + T11 + T16 + T12 merged; T15 approved primitive)** · T13 (outbound dispatch — deps T06 + T09 merged, needs HC quota RPC contract) + T14 (retry — deps T07 + T13) backlog. T15-followup + T15-INTEG parked pending Q chain.

### ASSIGNMENT T13 — claimed by exec-B (Nanak) at H17 21:22
- Branch: feat/wa-outbound-dispatch (will branch off `main` before first `src/` commit; PLAN commit lands on `main`)
- Routed from: PM-STATUS-B.md §8 queue (self-claim per EXECUTOR-PROTOCOL §3B — T06 BSP + T09 internal RPC auth both merged; primitive builds under Q-B assumption stamps per T12/T16 precedent)

#### PLAN T13 — exec-B (Nanak) at H17 21:22

**Scope recap** (spec: `MVP §1.2 B4 §5 AC L121-123` + `docs/spec/04-integration-channels.md §2.4 L83 §3.1 L98-105 §4.4 §4.5 §4.9 §9`)

T13 = **WA outbound dispatch RPC + DND check + quota two-phase** — the most complex slot B task. HC/AI calls US via internal RPC `send_wa_message(hotel_id, guest_id, body, template?, variables?)` (§2.4 L83). US executes the 6-step outbound flow per §3.1 L98-105:
1. **Look up wa_config** (BSP, access_token, phone_number_id) — needs plaintext access token → see GAP #3
2. **DND check** — RPC HC `is_hotel_dnd(hotelId, guestId?)` → check window + VVIP-exempt + inbound-trigger flags (§4.4)
3. **Quota check + reserve** (Phase 1) — RPC HC `check_and_reserve_outbound_quota(hotelId)` → if 100% → 429 `RATE_LIMIT` (§4.5, §9 L377)
4. **Persist outbound_dispatch_queue row** — status='pending' or 'failed' depending on GAP #4 decision
5. **Dispatch to Meta via T06 BSP adapter** — `sendText` or `sendTemplate` per GAP #7
6. **Quota commit** (Phase 2) — RPC HC `commit_outbound_quota_increment(hotelId, 1)` on Meta success; rollback semantic on Meta failure per GAP #5

Following T12/T16 modified-B discipline: **primitive only**. NO routes.ts (RPC receiver), NO worker.ts, NO HC quota adapter, NO HC DND adapter (both TYPE-ONLY ports). NO retry queue integration (T14 territory). NO Prisma schema change (`outbound_dispatch_queue` in T02). T06 BSP port consumed DIRECTLY via ctor injection.

**Discriminated union outcome** (T15 pattern — pre-empt T12 `as string` recurrence):
```ts
type OutboundDispatchOutcome =
  | { kind: 'dispatched'; dispatchId: string; externalId: string }
  | { kind: 'rejected_dnd'; dispatchId?: string; reason: string }
  | { kind: 'quota_exhausted'; dispatchId?: string; reason: string }
  | { kind: 'meta_failed'; dispatchId: string; status?: number; body?: unknown }
```
(exact variants + `dispatchId?` presence per GAP #4 persistence-sequence decision)

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot B (Nanak) ✓
- CLAUDE.md loaded ✓
- Task spec read: `MVP §1.2 B4 L35` (RPC endpoint), `§4.4 L96` (DND VVIP + inbound-trigger), `§4.5 L98` (quota two-phase), `§4.9 L106` (retry NOT in T13 — permanent failures for quota/template-not-approved), `§5 AC L121-123` (dispatched + DND blocks + quota gates); `04 §2.4 L83` (RPC signature), `§3.1 L98-105` (6-step flow), `§4.5 L245-257` (outbound_dispatch_queue DDL: `provider, guest_id?, template_name?, body?, variables JSON, scheduled_for, attempts, status ∈ pending|sent|failed|dead, sent_at?, external_id?, last_error JSON?`), `§4.9 L106` (retry policy — T14), `§9 L376-377` (`DND_BLOCK` 422 + `RATE_LIMIT` 429) ✓
- Parent docs spot-read: `docs/MODULE_TEMPLATE.md` (external-IO variant, ports+adapters) · `src/modules/whatsapp/ports/whatsapp-bsp.port.ts` T06 (verified: `sendText({credentials, to, body})` + `sendTemplate({credentials, to, templateName, languageCode, variables?})`; both return `{messageId}`; `BspCredentials = {phoneNumberId, accessToken}`) · `src/modules/whatsapp/adapters/1engage.adapter.ts` T06 (existing 1engage impl for reference) · `src/modules/whatsapp/whatsapp-config.service.ts` T10 (verified: `getForHotel(hotelId)` masks `accessToken` in domain response — need plaintext accessor, see GAP #3) · `src/modules/whatsapp/whatsapp-delivery-receipts.types.ts` T15 (discriminated union outcome pattern reference) · `src/plugins/internal-rpc-auth.plugin.ts` T09 (server-side guard for incoming RPC — router-layer wiring at T13-followup; primitive is auth-agnostic) · `src/core/errors/app-errors.ts` (existing `DndBlockError:108` + `OutboundQuotaError:114` classes for 422/429 codes — spec-catalog-aligned; ready for reuse if service maps outcomes to errors, but discriminated union return is preferred per T15 pattern) · `prisma/schema.prisma:86-106` `OutboundDispatch` model — verified structural shape ✓
- Dependencies check:
  - T02 (Prisma init + `outbound_dispatch_queue`): MERGED ✓
  - T06 (BSP port + 1engage adapter): MERGED (`3c1274a` PR #6) ✓ — consumed DIRECTLY via ctor injection (no new adapter needed for primitive; entrypoint wiring at T13-followup injects `create1engageAdapter(...)`)
  - T09 (internal RPC auth guard): MERGED — server-side guard for INBOUND RPC (T13-followup router calls the plugin; primitive itself is auth-agnostic per T12 signature-agnostic precedent)
  - T10 (WA config CRUD primitive): MERGED — CONSUMED but with mask constraint (see GAP #3)
  - Q-C-01/02/03: **NOT blockers** for T13 primitive (no api.ts wiring, no session)
  - Q-A-04 / Q-B-04/05/06/07: N/A for T13 (Q-A-04 is HMAC verify T12/T15 concern; Q-B-04/05 are T12 HC/AI RPC; Q-B-06 is T12 dedup; Q-B-07 is T15 receipts UNIQUE)
- `make typecheck`: PASS on `main` ✓ ; `make lint`: PASS on `main` ✓
- Scaffolder risk: **none proposed** (no schema change, no new deps).

**Files to create** (default proposal — see GAP #8 for alternatives; matches T12 modified-B envelope)

```
src/modules/whatsapp/whatsapp-outbound-dispatch.types.ts
src/modules/whatsapp/whatsapp-outbound-dispatch.schema.ts
src/modules/whatsapp/whatsapp-outbound-dispatch.repository.ts
src/modules/whatsapp/whatsapp-outbound-dispatch.service.ts
src/modules/whatsapp/ports/hotel-core-quota.port.ts
src/modules/whatsapp/ports/hotel-core-dnd.port.ts
src/modules/whatsapp/__tests__/whatsapp-outbound-dispatch.schema.test.ts
src/modules/whatsapp/__tests__/whatsapp-outbound-dispatch.repository.test.ts
src/modules/whatsapp/__tests__/whatsapp-outbound-dispatch.service.test.ts
```

**9 files** (4 source + 2 TYPE-ONLY ports + 3 tests). Mirror of T12 modified-B envelope: 2 unratified HC RPC contracts (Q-B-08 quota + Q-B-09 DND) → both TYPE-ONLY per T12 precedent. T06 BSP port already merged so consumed directly (no new BSP-related file).

**Files to modify** (1)

- `src/modules/whatsapp/index.ts` — append T13 exports. Preserve T06 (L1-7) + T10 (L9-18) + T16 (L20-44) + T11 (L46-56) + T12 (L58-79) + T15 (L81-95) blocks byte-for-byte.

**Files explicitly NOT touched**

- `prisma/schema.prisma`, `prisma/migrations/*` — `outbound_dispatch_queue` in T02
- `src/entrypoints/api.ts`, `src/entrypoints/worker.ts` — stubs (Q-C-02)
- `src/core/prisma/prisma-client.ts`, `src/core/http/http-client.ts` — stubs
- `src/plugins/*` (T04/T05/T09) — router-layer concerns
- T06 BSP files (`ports/whatsapp-bsp.port.ts`, `adapters/1engage.adapter.ts`, `__tests__/1engage.adapter.test.ts`) — byte-for-byte; CONSUMED via ctor
- T10 config files — see GAP #3 (my default: **do NOT mutate**, use sibling read path)
- T11/T12/T15/T16 primitive files — byte-for-byte
- `src/modules/telegram/*` — slot C
- `src/modules/_template/*` — reference
- `package.json`, `pnpm-lock.yaml` — no dep add

**Approach**

Hexagonal Disiplin: T06 BSP (external Meta) already has port+adapter — my service consumes T06's `WhatsappBspPort` via ctor. HC quota + HC DND are new external IOs → TYPE-ONLY ports (Q-B-08/09 stamps, T12/T16 precedent). Coding order:

1. **`whatsapp-outbound-dispatch.types.ts`** — domain types:
   - `OutboundDispatchProvider = 'whatsapp'`
   - `OutboundDispatchStatus = 'pending' | 'sent' | 'failed' | 'dead'` (matches DDL CHECK)
   - `OutboundDispatchRequest = { hotelId, guestId, recipientPhone, body?, template?: { name, languageCode, variables? } }` — RPC input from HC
   - `OutboundDispatchPersistenceInput = { hotelId, guestId, provider, templateName?, body?, variables?, status, externalId?, sentAt? }` — repo write shape
   - `OutboundDispatchOutcome` — discriminated union (4 variants per §Scope-recap above; final variants per GAP #6)
   - `QuotaCheckResult = { reserved: true, reservationId: string } | { reserved: false, reason: string }` (Q-B-08 stamp)
   - `DndCheckResult = { inDnd: false } | { inDnd: true, vvipExempt?: boolean, reason: string }` (Q-B-09 stamp)
2. **`whatsapp-outbound-dispatch.schema.ts`** — zod strict for `OutboundDispatchRequest` (HC RPC body); response envelope for outcome (discriminated by `kind`).
3. **`whatsapp-outbound-dispatch.repository.ts`** — sibling to T10-T15 pattern. **EXACTLY 3 methods** (T12 precedent):
   - `persistPending(input)` → creates row with status='pending'
   - `markSent(dispatchId, externalId, sentAt)` → update to sent + populate external_id
   - `markFailed(dispatchId, lastError)` → update to failed with JSON error
   - NO WaConfig read here (per GAP #3 default — separate concern)
4. **`whatsapp-outbound-dispatch.service.ts`** — orchestrator. Ctor `(repo, configService, bspPort, quotaPort, dndPort, logger)`. Direct imports for pure helpers (T15 precedent). Method `dispatchMessage(request): Promise<OutboundDispatchOutcome>`:
   - Parse `request` via schema → throws only `ValidationError` on fail
   - Fetch wa_config via T10's `WhatsappConfigService.getForHotel(hotelId)` for BSP + phoneNumberId (note: `accessToken` masked in T10 domain — see GAP #3 for plaintext read strategy)
   - DND check via `dndPort.checkDnd(hotelId, guestId)` → if inDnd + not VVIP-exempt → return `{kind: 'rejected_dnd', reason}` (persist choice per GAP #4)
   - Quota Phase 1 via `quotaPort.checkAndReserve(hotelId)` → if not reserved → return `{kind: 'quota_exhausted', reason}` (persist choice per GAP #4)
   - Persist pending row via `repo.persistPending(...)` (GAP #4 timing)
   - BSP call via `bspPort.sendText(...)` or `bspPort.sendTemplate(...)` (GAP #7 selection)
   - On BSP success: `repo.markSent(dispatchId, externalId, now)` + `quotaPort.commit(reservationId)` → return `{kind: 'dispatched', dispatchId, externalId}`
   - On BSP failure: `repo.markFailed(dispatchId, error)` + `quotaPort.rollback(reservationId)` (GAP #5 rollback semantic) → return `{kind: 'meta_failed', dispatchId, status?, body?}`
   - **Never throws** for external-service failures (worker discipline for RPC receiver at T13-followup)
   - PII floor: `maskWaPhone(recipientPhone)` in log
5. **`ports/hotel-core-quota.port.ts`** — TYPE-ONLY (Q-B-08 stamp):
   ```
   interface HotelCoreQuotaPort {
     checkAndReserve(hotelId: string): Promise<QuotaCheckResult>;
     commit(reservationId: string): Promise<void>;
     rollback(reservationId: string): Promise<void>;  // per GAP #5
   }
   ```
6. **`ports/hotel-core-dnd.port.ts`** — TYPE-ONLY (Q-B-09 stamp):
   ```
   interface HotelCoreDndPort {
     checkDnd(hotelId: string, guestId?: string): Promise<DndCheckResult>;
   }
   ```
7. **`__tests__/whatsapp-outbound-dispatch.schema.test.ts`** — request parse: happy, missing fields, invalid template shape, both body + template present, neither present (must have at least one).
8. **`__tests__/whatsapp-outbound-dispatch.repository.test.ts`** — Prisma-mock stopgap. 3 methods × happy path.
9. **`__tests__/whatsapp-outbound-dispatch.service.test.ts`** — mock all boundaries. Cases:
   - Happy path text: DND ok → quota reserved → persist → send → mark sent + commit → `{kind: 'dispatched'}`
   - Happy path template: same flow with sendTemplate
   - DND rejected: `{kind: 'rejected_dnd'}` — quota NOT reserved, no persist (per GAP #4)
   - Quota exhausted: DND ok → `{kind: 'quota_exhausted'}` — no persist
   - Meta failure: DND ok → quota reserved → persist → BSP throws → mark failed + rollback → `{kind: 'meta_failed'}`
   - VVIP-exempt bypass: `dndPort` returns `{inDnd: true, vvipExempt: true}` → proceed (per GAP #9)
   - Never throws: 6 failure paths (config not found, quota reject, DND reject, BSP fail, mark* fail, rollback fail) all use `.resolves`
   - Schema fail → `ValidationError` (only throw path)
   - PII floor: recipientPhone masked; positive shape + no-plaintext + length<500

**Security floor** (CLAUDE §6):
- `recipientPhone` masked via `maskWaPhone` in log
- Plaintext `accessToken` never in log (PII floor test asserts)
- Tenant guard: repo methods filter by hotelId; DND/quota RPCs scoped by hotelId in request

**Deferred (out of T13 primitive, tracked as follow-ups)**

- **T13-followup** — RPC receiver route `POST /internal/rpc/send-wa-message` + T09 auth guard wiring + HC quota adapter + HC DND adapter + entrypoint wiring for T06 BSP adapter. Blocked on Q-B-08 + Q-B-09 + Q-C-02 (api.ts bootstrap + env config).
- **T13-INTEG** — real-DB integration test + mock HC quota/DND servers + real T06 adapter against mock Meta. Blocked on Q-C-01 + T13-followup.
- **T14 retry queue** — separate primitive; T13 service returns rich outcome for T14 worker consumption.

**GAPs / questions** (blocking PM B ACK before I write any code)

- **GAP T13-#1 — HC quota RPC contract (Q-B-08)**: Spec §4.5 mentions `check_and_reserve_outbound_quota(hotelId)` + `commit_outbound_quota_increment(hotelId, 1)` — 2-phase. No URL/path/response/error catalog. Contract-drift analogous to Q-B-04. **Options**: A) File as **Q-B-08** — port TYPE-ONLY, adapter deferred to T13-followup [my default per T12/T16 precedent] · B) Hard-code assumption · C) Block T13.
- **GAP T13-#2 — HC DND RPC contract (Q-B-09)**: Spec §4.4 says DND is `hotels.dnd` in Auth (cross-service read via HC or shared DB). No RPC signature given. **Options**: A) File as **Q-B-09** — port TYPE-ONLY, adapter deferred [my default] · B) Hard-code · C) Block. **Additional sub-question**: is DND a separate RPC or combined with quota check into a single `precheck_outbound(hotelId, guestId)`? Spec suggests separate (§3.1 checks them sequentially at L101-102) — I'll default to separate ports.
- **GAP T13-#3 — Plaintext `accessToken` accessor from `wa_configs`**: T10 `WhatsappConfigService.getForHotel(hotelId)` masks `accessToken` in domain response (T10 security floor). T13 dispatch needs PLAINTEXT for T06 BSP `credentials.accessToken`. **Options**: A) NEW sibling method file `whatsapp-outbound-dispatch.repository.ts` also reads `wa_configs` directly + decrypts via `crypto.decrypt` (cross-concern in T13's repo — like T15's cross-table on outbound_dispatch_queue) [my default; preserves T10 byte-for-byte] · B) MUTATE T10 `WhatsappConfigService` with new `getForDispatch(hotelId)` unmasked method (breaks T10 byte-for-byte discipline) · C) Direct Prisma read in T13 service (skip repo layer). **Prefer A** unless PM disagrees.
- **GAP T13-#4 — Persistence sequence timing**: When does the `outbound_dispatch_queue` row land? **Options**: A) **Fail-early** — DND/quota fail BEFORE persist → no row for immediate rejects; `dispatchId` absent in `rejected_dnd`/`quota_exhausted` outcomes; simpler but no audit for rejects [my default] · B) **Persist-always** — always persist status='pending', update to 'failed'/'sent' after checks; full audit but writes for pure rejects · C) **Persist-on-reserve** — persist after quota reserve, only rejected_dnd has no dispatchId. **Prefer A** but PM may prefer B for audit trail.
- **GAP T13-#5 — Rollback semantics on Meta failure**: After quota reserve → Meta call fails → should we rollback the reservation or consume-anyway (record as attempt)? Spec §4.9 says "quota / template-not-approved failures are PERMANENT — do NOT retry" but doesn't specify rollback. **Options**: A) **Rollback on Meta failure** — reservation released, hotel's quota unchanged [my default; matches "meter reflects only actually-sent messages" from §4.5] · B) **Consume-anyway** — reservation committed, quota decremented; hotel pays for attempted sends · C) File as sub-question in Q-B-08.
- **GAP T13-#6 — Discriminated union outcome variants**: 4 variants proposed (dispatched, rejected_dnd, quota_exhausted, meta_failed). **Options**: A) my proposed 4 variants [my default] · B) 5+ variants (add `config_not_found`, `schema_invalid` as outcomes vs throws) — but config_not_found from T10 = `NotFoundError` propagates (not an outcome); schema_invalid throws `ValidationError` (also propagates) · C) 3 variants (merge quota_exhausted into meta_failed) — loses spec §9 distinction between 422 DND_BLOCK vs 429 RATE_LIMIT.
- **GAP T13-#7 — T06 BSP port method selection**: Spec RPC signature accepts `body?` OR `template?`. **Options**: A) If `template` provided → `sendTemplate`, else → `sendText`; validation ensures exactly one is present [my default] · B) Require both to always be present (over-strict) · C) Support neither (spec violation).
- **GAP T13-#8 — Primitive scope depth**: **Options**: A) my proposed 9 files (4 source + 2 type-only ports + 3 tests) — matches T12 modified-B envelope [my default] · B) 11 files including HC quota + DND adapters (contracts unratified per #1 + #2 — T12 precedent adapter-defer applies) · C) 7 files without repo tests (unjustified — Prisma-mock stopgap 5× cross-primitive precedent).
- **GAP T13-#9 — VVIP-exempt + inbound-trigger flag handling**: Spec §4.4 mentions "VVIP-exempt" + "not inbound-trigger" as DND bypass conditions. **Options**: A) DND port response includes `vvipExempt` boolean; service proceeds if `vvipExempt: true`; inbound-trigger is caller responsibility (HC/AI decide when sending) [my default; simpler primitive] · B) T13 service determines VVIP status itself (needs another RPC to Auth's `hotels.vvip_list`) — over-engineered · C) Skip VVIP handling in primitive; T13-followup handles.

Awaiting PM B ACK on GAPs #1–#9 (esp. #3 T10 plaintext access, #4 persistence timing, #5 rollback) before writing any code.

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

| ID            | Question | Raised by | Source         | Status | Resolution |
| ------------- | -------- | --------- | -------------- | ------ | ---------- |
| Q-B-01 | **`waba_id` (WhatsApp Business Account ID) storage location.** Meta's `/{waba_id}/message_templates` needs WABA ID (account-level, distinct from per-phone `phone_number_id`). `wa_configs` DDL §4.1 has NO `waba_id` column. **Options**: A) HC sends `waba_id` per-RPC in the payload (defers to HC-side config; primitive assumes this) [PM B default in T16 primitive]; B) add `waba_id VARCHAR(80) NOT NULL` to `wa_configs` — schema follow-up analogous to Q-A-04 `app_secret_enc`, needs slot-A/Nathan land; C) new `wa_business_accounts` table — overkill for MVP. **Sibling to Q-A-04.** Blocks T16 router-layer + possibly T13 dispatch (if T13 also needs waba_id). Mirrored to PARENT §3a. | PM B (Nanak) H17 | schema.prisma:33 vs Meta `/message_templates` API; T16 PLAN GAP-#2 | open | — |
| Q-B-02 | **HC callback endpoint contract for `updateWaTemplateStatus` (cross-service).** Spec `04-integration-channels.md §3.1` L108 mentions "internal callback to HC" for template status transitions — no URL, no path, no payload shape, no expected HC response. `docs/spec/02-hotel-core.md` file does NOT exist in this repo. **Options**: A) narrow port `HotelCoreTemplateCallbackPort` — adapter accepts `{ baseUrl, path, internalSecret }` at construction, PM/HC ratifies exact path via config later [PM B keeps port as TYPE-ONLY in T16 primitive; adapter deferred to T16-followup]; B) hard-code assumed `POST /internal/wa-templates/:id/status` with body `{ status, reason?, meta_template_id }` — clean if HC confirms, otherwise refactor churn; C) block T16 until HC exposes contract. Cross-service ratification (HC-team + PO). Blocks T16-followup HC adapter. Mirrored to PARENT §3a. | PM B (Nanak) H17 | spec §3.1 L108 vs missing `02-hotel-core.md`; T16 PLAN GAP-#5 | open | — |
| Q-B-03 | **HC → us RPC payload shape for `submit_wa_template_to_meta` / `resubmit_wa_template_to_meta` (cross-service, Q-CONTRACT-07 territory).** Spec §2.4 L85-86 signatures are `submit_wa_template_to_meta(template_id)` + `resubmit_wa_template_to_meta(template_id)` — template_id only. But Meta's `/message_templates` needs `{ name, category, language, components[], waba_id, access_token }`. **Options**: A) HC sends full payload in RPC body — `template_id` is shorthand for a richer payload; matches spec §3.1 narrative; avoids HC→us→HC round-trip [PM B default in T16 primitive]; B) HC sends only `{ template_id }` and we RPC HC back via a new `getWaTemplate(template_id)` internal RPC — extra hop, requires new RPC contract; C) block T16 until PO ratifies (spec §10 Q-CONTRACT-07 designated for endpoint shape ratification). Cross-service ratification. Blocks T16-followup inbound RPC receiver. Mirrored to PARENT §3a. | PM B (Nanak) H17 | spec §2.4 L85-86 + §3.1 L108 + §10 Q-CONTRACT-07; T16 PLAN GAP-#1 | open | — |
| Q-B-04 | **HC `upsert_guest_by_wa_phone` RPC endpoint contract (cross-service).** Spec `04 §3.1 L115` gives signature `upsert_guest_by_wa_phone(hotel_id, wa_phone, name?) → guest_id` — no URL, no path, no payload shape, no HC response envelope, no error catalog. `docs/spec/02-hotel-core.md` does NOT exist in repo. **Options**: A) narrow port `HotelCoreGuestUpsertPort` — adapter accepts `{ baseUrl, path, internalSecret }` at construction, PM/HC ratifies exact path later [PM B keeps port TYPE-ONLY in T12 primitive; adapter deferred to T12-followup]; B) hard-code assumed `POST /internal/hc/guests/upsert-by-wa-phone` with `{ hotelId, waPhone, name? } → { guestId }`; C) block T12 until HC exposes contract. Cross-service ratification (HC-team + PO). Sibling to Q-B-02. Blocks T12-followup HC adapter. Mirrored to PARENT §3a. | PM B (Nanak) H17 | spec §3.1 L115 vs missing `02-hotel-core.md`; T12 PLAN GAP-#3 | open | — |
| Q-B-05 | **AI `inbound_wa_message` RPC endpoint contract (cross-service, AI-team).** Spec `04 §3.1 L116` + `§3.2 L311` gives signature `inbound_wa_message(guest_id, body, hotel_id)` marked "opaque, RPC only, no DB FK" — no URL, no path, no response shape, no error catalog. **Options**: A) narrow port `AiInboundMessagePort` — adapter accepts `{ baseUrl, path, internalSecret }` at construction, PM/AI ratifies later [PM B keeps port TYPE-ONLY in T12 primitive; adapter deferred to T12-followup]; B) hard-code assumed `POST /internal/ai/inbound/wa-message` with `{ hotelId, guestId, body, messageId } → void`; C) block. Cross-service ratification (AI-team + PO). Sibling to Q-B-04. Blocks T12-followup AI adapter. Mirrored to PARENT §3a. | PM B (Nanak) H17 | spec §3.1 L116 + §3.2 L311; T12 PLAN GAP-#4 | open | — |
| Q-B-06 | **`webhook_events.external_id` column addition — schema follow-up sibling to Q-A-04.** `MVP §4.6` mandates dedupe on `(provider, external_id)` for inbound webhook messages. `04 §4.4 L221-232` DDL + Prisma model (schema.prisma:72-83) have **NO `external_id` column** on `webhook_events`. Contrast: `outbound_dispatch_queue.external_id VARCHAR(80) NULL` (§4.5 L251) + `delivery_receipts.external_id VARCHAR(80) NOT NULL` (§4.6 L267) both have it — pattern established, missing on webhook_events. **Options**: A) add `external_id VARCHAR(80) NULL` on `webhook_events` + partial unique index `WHERE external_id IS NOT NULL` (analogous to Q-A-02 `outbound_dispatch_queue.external_id` index pattern) — Nathan/T02 territory [T12 primitive assumes this shape; `WhatsappInboundIngestResponseSchema.isDuplicate` field always `false` in primitive as placeholder]; B) JSON-path query on `payload->'entry'->0->'changes'->0->'value'->'messages'->0->>'id'` — slow at scale, write-throw when A lands; C) synthetic key at runtime — same JSON-parse cost as B; D) skip dedup entirely in primitive (T16 modified-B precedent) [PM B default]. Schema follow-up + slot-A/Nathan land. Blocks T12-followup dedup semantics. Mirrored to PARENT §3a. | PM B (Nanak) H17 | schema.prisma:72-83 + spec §4.4 L221-232 vs §4.6 dedupe mandate; T12 PLAN GAP-#5 | open | — |
| Q-B-07 | **`delivery_receipts` UNIQUE constraint on `(dispatch_id, external_id, status)` triple — OPTIONAL future enhancement (schema follow-up, sibling to Q-B-06 pattern).** `04 §4.6 L263-272` DDL only has status CHECK constraint; NO UNIQUE on triple. Multi-row per triple is NATIVE to `delivery_receipts` semantics (status progression `sent → delivered → read` produces 3 rows for same message). BUT Meta CAN send duplicate status events on network retry — currently produces duplicate DB rows. **Options**: A) add `UNIQUE (dispatch_id, external_id, status)` + partial UNIQUE index + `ON CONFLICT DO NOTHING` upsert semantic in T15-followup repo — Nathan/T02 territory + T15-followup wiring [PM B default for future ratification]; B) skip Q-B-07 entirely — accept duplicate rows as harmless append-only audit noise; C) compute synthetic dedup key at runtime — polluting service logic. **NOT blocking T15 primitive** (multi-row accepted per DDL). Filed for future enhancement scheduling. Mirrored to PARENT §3a. | PM B (Nanak) H17 | schema.prisma:108-119 + spec §4.6 L263-272; T15 PLAN GAP-#5 | open | — |

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
