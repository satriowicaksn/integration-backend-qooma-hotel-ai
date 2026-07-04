# PM-STATUS-PARENT — Qooma Backend (cross-dev roll-up)

> **Parent PM tracker.** Read-only buat Executor & PM A/B/C kecuali bagian roll-up yang explicit dipost oleh PM A/B/C. Parent PM authority untuk section §1, §3, §4, §5, §6, §7, §8. PM A/B/C append baris short ke §2 setelah tiap APPROVE (per `PM-AGENT.md §0.8`).
>
> Detail per-dev assignment (ASSIGNMENT → PLAN → SUBMIT → VERDICT) tinggal di **`PM-STATUS-A.md`** (Nathan), **`PM-STATUS-B.md`** (Nanak), **`PM-STATUS-C.md`** (Satrio).
>
> Komunikasi PO ↔ Parent PM ↔ PM A/B/C ↔ Executor semua via git-synced markdown. Tidak ada DM kecuali eskalasi formal (lihat §9).
>
> **Identity check**: setiap session WAJIB sebut role + slot di response pertama (lihat `KICKOFF.md §4`).

---

## 0. Current focus (global)

- **Day**: H12+ (bootstrapped 2026-06-29 from core-backend infra; scope per H12 PO ruling; task tracker activated 2026-06-30)
- **Phase**: Bootstrap / pre-T01 — authoritative spec live di [`docs/spec/MVP-INTEGRATION-FIRST.md`](./docs/spec/MVP-INTEGRATION-FIRST.md) (Slice 3 of 3 backend MVP slices — ship after Auth + HC)
- **Active gate**: G1 — Boilerplate + Prisma schema ready (kriteria default `PM-AGENT.md §5`; PO konfirmasi)
- **Active devs**: A (Nathan) · B (Nanak) · C (Satrio) — T01-T03 + T10 + T17 assigned, sisanya backlog
- **Progress (global)**: 0 / 25 task approved · 5 assigned · 20 backlog (T01-T09 = slot A · T10-T16 = slot B · T17-T25 = slot C; lihat MVP-INTEGRATION-FIRST §1)
- **Dependencies**: Auth + Hotel Core MUST be deployed first. Integration RPCs HC for guest upsert + quota two-phase + per-dept dept write-through; webhook routes look up `hotels.code → hotels.id` from Auth.
- **Reading order untuk fresh dev**: `KICKOFF.md` → `docs/SERVICE-CHARTER.md` → `docs/spec/MVP-INTEGRATION-FIRST.md` → `docs/spec/04-integration-channels.md` (full DDL + RPC catalog + retry strategy) → `docs/spec/data-model.md` → `docs/spec/open-questions.md` → claim task di §1a

> **H12 PO rulings baked in (2026-06-29)**: Integration owns ALL `/api/integrations/*` (config CRUD + actions) + webhook ingress + outbound dispatch. Q-OPS-03 RESOLVED (dispatch owned here). Q-CONTRACT-25 + Q-OPS-06 NEW (per-dept Telegram write-through — shared DB recommended; see `docs/spec/open-questions.md`).

---

## 1. Global task tracker (Parent PM authority)

> Otoritas Parent PM untuk edit row in-place. Status: `backlog` | `assigned` | `wip` | `submit-pending` | `approved` | `rejected` | `escalated`.
>
> Setiap task **wajib** punya kolom **Slot** untuk routing ke PM A/B/C. ID `T##` di-issue oleh PO atau Parent PM dari §1a pre-G1 queue.

| T## | Title                                                                            | Slot | Owner   | Status   | Verified by | Notes                                                                       |
| --- | -------------------------------------------------------------------------------- | ---- | ------- | -------- | ----------- | --------------------------------------------------------------------------- |
| T01 | `make check` green dari boilerplate (lint + typecheck + format)                  | A    | Nathan  | merged   | PM A (H12)  | Opsi B jest.config.cjs (zero-dep). Merged to main PR #1 `7b40e11`. Foundation critical path |
| T02 | Prisma schema initial migration (8 Integration tables + indexes per §4 DDL)      | A    | Nathan  | merged   | PM A (H12)  | ✅ **B (T10+) + C (T17+) schema-unblocked.** Merged PR #2 `53a4925`, make check green on main. Opsi A (isolated/opaque). Q-A-01/Q-A-02 open, non-blocking |
| T03 | Encryption-at-rest helper (AES-256-GCM or KMS for token columns)                 | A    | Nathan  | merged   | PM A (H12)  | Opsi A, 100% cov, tamper+fail-fast verified. Merged PR #3 `ca9685b`. **Foundation T01→T03 DONE — B/C fully unblocked (schema+crypto).** Consumed by T10+T17 |
| T04 | Webhook signature-verification middleware (Meta `X-Hub-Signature-256` + Telegram)| A    | Nathan  | merged   | PM A (H12)  | plugin-level preHandler, timingSafeEqual, raw-byte HMAC, 401 native, no-insert invariant proven, 100% line cov. Merged PR #4 `ad46125`. Consumed by T12+T15+T19 |
| T05 | Tenant resolution from `:hotel_slug` (LRU cache 5-min, hotels.code lookup)       | A    | Nathan  | merged   | PM A (H12)  | factory TTL-LRU, injected lookup port (Q-A-01-agnostic per spec §4.3 L71), 404 native, never-trust-body proven, 100% resolver cov. Merged PR #5 `59e8218`. Consumed by T12+T19 |
| T06 | BSP adapter interface + `1engage` impl                                           | A    | Nathan  | merged   | PM A (H12)  | module `whatsapp`, vendor-agnostic port + factory 1engage adapter, ExternalServiceError, injected HttpPoster, 100% adapter cov. Merged PR #6 `3c1274a`. Consumed by T13+T16. Q-A-06 (B align module) |
| T07 | Queue + scheduler infra (BullMQ-based, retry policy + DLQ)                       | A    | Nathan  | merged   | PM A (H12)  | **Bull 4.x** (title "BullMQ" = misnomer), backoff [1s/5s/30s] attempts=3 configurable, DLQ `<mod>:dead` forwarder (exhaustion-gated), Redis-injected, logic 100% cov. Merged PR #7 `6654d46`. Consumed by T14+T19+T21+T24. Q-A-07 (retry count) |
| T08 | Common error handlers (Integration-specific codes per spec §9)                   | A    | Nathan  | approved | PM A (H12)  | F7 complete: 7 §9 error classes + canonical `{error:{…}}` envelope handler (README §2.3), non-AppError→500 INTERNAL no-leak, correlationId log. 100% new-code cov. Awaiting PO merge. Consumed by all B/C endpoints. Q-A-08 (generic-code drift) |
| T09 | Internal RPC server (HTTP/mTLS auth scheme; spec §10 catalog)                    | A    | Nathan  | backlog  | —           | After T01 + T05; consumed by HC for outbound dispatch                       |
| T10 | WA config CRUD (`GET, PUT /api/integrations/whatsapp`)                           | B    | Nanak   | assigned | —           | Spec reading + module skeleton OK; impl blocked on T02 + T03                |
| T11 | Verify webhook action (`POST /api/integrations/whatsapp/verify-webhook`)         | B    | Nanak   | backlog  | —           | After T10                                                                   |
| T12 | WA inbound webhook ingest (signature → persist → HC guest upsert → AI RPC)       | B    | Nanak   | backlog  | —           | After T04 + T05 + T10                                                       |
| T13 | Outbound WA dispatch RPC + DND check + quota two-phase                           | B    | Nanak   | backlog  | —           | After T06 + T09; HC RPC `check_and_reserve_outbound_quota`                  |
| T14 | Outbound retry queue (3 attempts exponential backoff)                            | B    | Nanak   | backlog  | —           | After T07 + T13                                                             |
| T15 | Delivery receipts ingest (WA Cloud webhook stream)                               | B    | Nanak   | backlog  | —           | After T04 + T12                                                             |
| T16 | WA template Meta relay (submit/resubmit/callback to HC)                          | B    | Nanak   | backlog  | —           | After T06; HC internal `updateWaTemplateStatus` callback                    |
| T17 | Telegram config CRUD (`GET, PUT /api/integrations/telegram`)                     | C    | Satrio  | assigned | —           | Spec reading + module skeleton OK; impl blocked on T02 + T03                |
| T18 | Per-dept Telegram routing write-through (HC `departments` table)                 | C    | Satrio  | backlog  | —           | After T17; per Q-OPS-06 shared-DB direct write                              |
| T19 | Telegram inbound webhook + commands (`/take`, `/release`, `/done`, `/help`)      | C    | Satrio  | backlog  | —           | After T04 + T05 + T17                                                       |
| T20 | Outbound Telegram dispatch RPC                                                   | C    | Satrio  | backlog  | —           | After T06 + T09; per-dept routing per T18                                   |
| T21 | OTA email IMAP poller + parser pipeline + HC pending-visit RPC                   | C    | Satrio  | backlog  | —           | After T07; HC internal RPC for pending-visit insert                         |
| T22 | QR generation + download (1024×1024 PNG, object storage)                         | C    | Satrio  | backlog  | —           | After T02 + T10                                                             |
| T23 | Integration overview endpoint (`GET /api/integrations`)                          | C    | Satrio  | backlog  | —           | After T10 + T17                                                             |
| T24 | Channel health probes + snapshots + 2-poll debounce                              | C    | Satrio  | backlog  | —           | After T07 + T10 + T17                                                       |
| T25 | `integration:health_changed` socket emits                                        | C    | Satrio  | backlog  | —           | After T24                                                                   |

### 1a. Pre-G1 bootstrap queue (MIRRORED into §1 on 2026-06-30 — kept as spec-driven reference)

> Roster di bawah ini sudah dimirror ke §1 dengan owner + status. Edit row di §1, JANGAN di sini.

| Suggested T## | Title                                                                            | Slot | Spec ref                                          |
| ------------- | -------------------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| T01           | `make check` green dari boilerplate (lint + typecheck + format)                  | A    | F1 prep                                           |
| T02           | Prisma schema initial migration (8 Integration tables + indexes)                 | A    | F1 — `docs/spec/04-integration-channels.md` §4 DDL|
| T03           | Encryption-at-rest helper (KMS / libsodium for tokens)                           | A    | F2                                                |
| T04           | Webhook signature-verification middleware (Meta `X-Hub-Signature-256` + Telegram)| A    | F3                                                |
| T05           | Tenant resolution from `:hotel_slug` (LRU cache 5-min, hotels.code lookup)       | A    | F4                                                |
| T06           | BSP adapter interface + `1engage` impl                                           | A    | F5                                                |
| T07           | Queue + scheduler infra (BullMQ or equivalent)                                   | A    | F6                                                |
| T08           | Common error handlers (Integration-specific codes per spec §9)                   | A    | F7                                                |
| T09           | Internal RPC server (HTTP/mTLS auth scheme)                                      | A    | F8                                                |
| T10           | WA config CRUD (`GET, PUT /api/integrations/whatsapp`)                           | B    | B1                                                |
| T11           | Verify webhook (`POST /api/integrations/whatsapp/verify-webhook`)                | B    | B2                                                |
| T12           | WA inbound webhook ingest (signature → persist → HC guest upsert → AI RPC)       | B    | B3                                                |
| T13           | Outbound WA dispatch RPC + DND check + quota two-phase                           | B    | B4 + B5                                           |
| T14           | Outbound retry queue (3 attempts exponential backoff)                            | B    | B6                                                |
| T15           | Delivery receipts ingest (WA Cloud webhook stream)                               | B    | B7                                                |
| T16           | WA template Meta relay (submit/resubmit/callback to HC)                          | B    | B8                                                |
| T17           | Telegram config CRUD (`GET, PUT /api/integrations/telegram`)                     | C    | C1                                                |
| T18           | Per-dept Telegram routing write-through (HC `departments` table)                 | C    | C2                                                |
| T19           | Telegram inbound webhook + commands (`/take`, `/release`, `/done`, `/help`)      | C    | C3                                                |
| T20           | Outbound Telegram dispatch RPC                                                   | C    | C4                                                |
| T21           | OTA email IMAP poller + parser pipeline + HC pending-visit RPC                   | C    | C5                                                |
| T22           | QR generation + download (1024×1024 PNG, object storage)                         | C    | C6                                                |
| T23           | Integration overview endpoint (`GET /api/integrations`)                          | C    | C7                                                |
| T24           | Channel health probes + snapshots + 2-poll debounce                              | C    | C8                                                |
| T25           | `integration:health_changed` socket emits                                        | C    | C9                                                |

---

## 2. Per-dev short-status roll-up (PM A/B/C append, latest di atas)

> Setiap PM A/B/C post **1-2 baris** summary ke sini setelah tiap VERDICT atau end-of-session. Parent PM scan ini untuk daily report. JANGAN paste full SUBMIT/VERDICT di sini — itu tetap di PM-STATUS-{slot}.md.
>
> Format:
> ```
> [YYYY-MM-DD H{N}] [PM <SLOT> <NAME>] <T## status — 1 liner>
> ```

[2026-07-03 H12] [PM A Nathan] Online. Last approved: none (session start). Active: 1 (T01→approved). Next-up: T02 (Prisma migration, critical path). Open Qs: 0.
[2026-07-03 H12] [PM A Nathan] T01 `make check` green APPROVED (attempt 1) — Opsi B jest.config.cjs, zero new deps, make check green on PM rerun, 0 new drift. Code on `chore/ci-make-check-green` awaiting PO merge + CI. Next: T02.
[2026-07-03 H12] [PM A Nathan] T01 MERGED to main (PR #1). T02 PLAN ACK'd (Prisma init migration, isolated-DB/opaque-UUID). **2 open Qs raised for PO** (Q-A-01 DB topology §3c — schema-header claims shared-DB ratification vs ADR-0004 isolated, affects B+C; Q-A-02 schema-vs-spec drift §3a). Both non-blocking + additively fixable — T02 coding proceeds. Parent PM: please route Q-A-01 to PO (topology affects B/C).
[2026-07-03 H12] [PM A Nathan] **T02 APPROVED (attempt 1)** — Prisma init migration, 8 tables. PM independently applied to a clean throwaway DB: 8 Integration tables, 0 auth, 6 CHECK, 2 partial idx, 1 intra-schema FK, mandated forward-only order; make check green. **→ Slot B (T10+) and C (T17+) are now schema-unblocked** — Parent PM can green-light their impl. Code awaiting PO merge. ⚠ Cross-dev note: shared local `postgres_data` volume has stale Auth tables — B/C should `make start-fresh` for a clean Integration DB.
[2026-07-03 H12] [PM A Nathan] T02 MERGED (PR #2). **T03 APPROVED (attempt 1)** — AES-256-GCM crypto helper, PM-verified: 100% coverage, GCM tamper-detection + fail-fast on missing/short key, no secret leakage, 0 any, make check green. **Foundation critical path T01→T02→T03 COMPLETE.** Code awaiting PO merge. ⚠ **Shared-infra flag (Q-A-03, affects B/C):** `NODE_ENV=test` not in `env.ts` enum → any test calling `loadConfig()` throws; recommend a small chore adding baseline test env to `src/shared/utils/test-setup.ts` before B/C write loadConfig-dependent tests. Parent PM to route.
[2026-07-03 H12] [PM A Nathan] T03 MERGED (PR #3). T04 (HMAC verify plugin) PLAN ACK'd, coding. ⚠ **New contract Q-A-04 (§3a) — affects slot B (T12):** Meta signs `X-Hub-Signature-256` with the **App Secret**, not `webhook_verify_token` (which is the GET verify-challenge); `wa_configs` has no `app_secret` column. Surfaced during T04 (secret-agnostic → not blocked). PM B / PO should rule before T12, may need a schema follow-up (`app_secret_enc`). Parent PM to route.
[2026-07-03 H12] [PM A Nathan] **T04 APPROVED (attempt 1)** — webhook HMAC verify plugin, PM-verified: plugin-level preHandler (no-insert invariant proven via handler-ran=false), raw-byte HMAC (non-canonical-body proof), `timingSafeEqual`, native 401, zero new deps, 0 any, 100% line cov, make check green. Code awaiting PO merge. ⚠ **New tooling Q-A-05 (§3b, shared-config affects B/C):** eslint `no-misused-promises` false-positives on async Fastify route hooks; recommend project-level `checksVoidReturn: { properties: false }` so B/C don't per-line suppress. Parent PM to route (with Q-A-03).
[2026-07-03 H12] [PM A Nathan] T04 MERGED (PR #4). **T05 APPROVED (attempt 1)** — tenant slug-resolver + TTL-LRU cache, PM-verified: never-trust-body guard proven (body `hotel_id` ignored, URL slug wins), 404 native on unknown slug, correct LRU+TTL (no expiry-refresh-on-read), injected `HotelSlugLookup` port (Q-A-01-agnostic per spec §4.3 L71 "your choice"), zero-dep factory cache, 0 any/0 class, 100% resolver cov, make check green. Code awaiting PO merge. **5 of 9 slot-A foundation tasks approved (T01-T05).** Note: cache shipped function-based per PO style preference (no classes for stateful utils).
[2026-07-03 H12] [PM A Nathan] T05 MERGED (PR #5). T06 (BSP port + 1engage adapter) PLAN ACK'd, coding — module-scoped `whatsapp`, thin vendor-agnostic port (Q-OPS-04-backed) + factory adapter, `ExternalServiceError` mapping, injected HttpPoster. ⚠ **New cross-slot Q-A-06 (§3c) — affects PM B:** WA module name decided `whatsapp` (matches provider enum + `/whatsapp` routes); **Parent PM ensure B builds T10 config-CRUD in `src/modules/whatsapp/` too** (B's T10 now schema-unblocked, align before it starts). Cheap rename now, no consumers.
[2026-07-03 H12] [PM A Nathan] **T06 APPROVED (attempt 1)** — BSP port + 1engage adapter, PM-verified: vendor-agnostic port (no axios/vendor leak), factory adapter via injected HttpPoster, all failure paths → `ExternalServiceError` w/ {status,body} for Sentry, no hardcoded URL, barrel exports port-only (not adapter), 0 any/class, 100% adapter line/func cov, make check green. Code awaiting PO merge. **6 of 9 slot-A foundation approved (T01-T06).** `src/modules/whatsapp/` seeded — reminder Q-A-06: B's T10 CRUD goes in the SAME module.
[2026-07-03 H12] [PM A Nathan] T06 MERGED (PR #6). T07 (Bull queue infra) PLAN ACK'd, coding — Bull 4.x (title "BullMQ" = misnomer; ratified stack is Bull), backoff `[1s,5s,30s]` attempts=3 configurable, DLQ `<module>:dead` forwarder, logic unit-tested (Redis wrappers integration-deferred). ⚠ **New contract Q-A-07 (§3a) — affects slot B (T14):** spec §7 self-contradicts retry count ("3 retries" L344 vs "3 attempts" L345). T07 ships restrictive default (attempts=3, configurable) → not blocked. PO ratify + fix spec §7 before B's T14. Also: "BullMQ" wording in §1/§8 task titles is a cosmetic misnomer — Parent PM may clean up.
[2026-07-03 H12] [PM A Nathan] **T07 APPROVED (attempt 1)** — Bull queue infra, PM full code-audit vs spec §7/MVP §4.9/CLAUDE §9: correct backoff strategy (1s/5s/30s + clamp), DLQ forwarder exhaustion-gated (fires once on final failure), Redis-injected (no open handles, `--detectOpenHandles` clean), `<module>:dead` matches schema enum, logic fns 100% cov, 0 any/class/bullmq, make check green. Code awaiting PO merge. **7 of 9 slot-A foundation approved (T01-T07).** Queue/retry/DLQ primitive ready for B's T14 + C's T21/T24.
[2026-07-03 H12] [PM A Nathan] T07 MERGED (PR #7). **T08 APPROVED (attempt 1)** — F7 complete: 7 spec-§9 error classes + canonical-envelope handler. PM-verified: codes exact vs §9, envelope wrapper `{error:{code,message,details}}` matches README §2.3 (exec found the wrapper doc + `INTERNAL`-for-500, matched-not-invented), non-AppError→500 no-leak (tested), correlationId logging, 100% new-code cov, make check green. Code awaiting PO merge. **8 of 9 slot-A foundation approved (T01-T08); only T09 RPC left.** ⚠ **New Q-A-08 (§3c) — shared boilerplate, all services:** generic AppError codes (`AUTH_ERROR`/`RATE_LIMIT_EXCEEDED`/…) drift from README §2.3 canonical (`UNAUTHENTICATED`/`RATE_LIMIT`) → FE won't recognize; needs a boilerplate-reconcile, Parent PM to schedule.

<!-- TEMPLATE:
[2026-06-25 H3] [PM A Nathan] T01 boilerplate scaffold APPROVED (attempt 2) — make check green, 0 drift hits.
[2026-06-25 H3] [PM B Nanak]  T02 auth module wip — PLAN ACK'd, executor implementing JWT issuance.
[2026-06-25 H3] [PM C Satrio] T03 webhook plugin REJECT (attempt 1) — HMAC verify di middle of handler, harus plugin-level.
-->

---

## 3. Open questions register (consolidated)

> Parent PM consolidate dari PM A/B/C. PM A/B/C juga boleh edit row mereka sendiri (status update). Resolve = PO action.

### 3a. Contract questions (target: resolved sebelum G2; frozen setelah G3)

| ID            | Question | Raised by | Source         | Status | Resolution |
| ------------- | -------- | --------- | -------------- | ------ | ---------- |
| Q-A-02 | `prisma/schema.prisma` deviates from authoritative spec §4 DDL at 2 non-functional points: (i) `outbound_dispatch_queue.external_id` full index vs spec §4.5 **partial** `WHERE external_id IS NOT NULL`; (ii) client-side `@default(uuid())` vs spec L169 / data-model §5 **DB-side `gen_random_uuid()`**. Schema self-contradictory (comment L26 agrees with spec). **T02 shipped schema-as-is; both additively fixable (no init-migration redo).** PM A recommendation = spec-faithful (partial index + DB-side default, more robust for T09/T13 RPC insert surface). PO: ratify as-is OR direct reconcile. | PM A (Nathan) | schema.prisma:98,104,26 vs spec §4.4-4.8/L169 | open | — |
| Q-A-04 | **WA signature secret — affects slot B (T12).** Meta signs `X-Hub-Signature-256` with the **App Secret**; `webhook_verify_token` is only the GET verify-challenge (`hub.verify_token`). Spec §4.2 conflates them; `wa_configs` has no `app_secret` column. Surfaced during T04 (which is secret-agnostic → not blocked). B's WA webhook ingest will verify against the wrong secret unless resolved — likely needs a schema follow-up (`app_secret_enc`). PO/PM B to rule before T12. | PM A (Nathan) | spec §4.2 vs Meta WA Cloud API; schema `wa_configs` | open | — |
| Q-A-07 | **Outbound retry count — spec self-contradicts; affects slot B (T14).** spec §7 L344 "3 retries (1s,5s,30s)" vs §7 L345 "after 3 attempts→failed" vs MVP §4.9 "3-attempt". 3 total attempts (30s delay unused) or 3 retries=4 attempts (30s used)? **T07 ships default `attempts=3` (restrictive per CLAUDE §14, per-job configurable) + `[1s,5s,30s]` strategy** → not blocked. PO: ratify + fix spec §7 wording before B builds T14 outbound retry queue. | PM A (Nathan) | spec §7 L344-345 vs MVP §4.9 | open | — |

### 3b. Package / tooling questions

| ID            | Question | Raised by | Source         | Status | Resolution |
| ------------- | -------- | --------- | -------------- | ------ | ---------- |
| Q-A-03 | **Test env (shared-infra, affects B/C).** `NODE_ENV=test` (Jest default) not in `env.ts` enum → any test calling `loadConfig()` throws. T03/T04 used a localized in-test `NODE_ENV:'development'`. Recommend small chore: baseline test env in `src/shared/utils/test-setup.ts` (or add `'test'` to enum). | PM A (Nathan) | env.ts:16; T03 SUBMIT | open | — |
| Q-A-05 | **ESLint async-hook (shared-config, affects B/C).** `@typescript-eslint/no-misused-promises` false-positives on async Fastify hooks in route-option properties (`checksVoidReturn.properties`); typecheck passes, runtime correct. T04 used a local 1-line disable (test only). Recommend project-level `['error', { checksVoidReturn: { properties: false } }]` (keeps `no-floating-promises`). Hits B/C on every async `preHandler`/hook. | PM A (Nathan) | T04 SUBMIT; `.eslintrc.cjs` | open | — |

### 3c. Architecture / planning questions

| ID            | Question | Raised by | Source         | Status | Resolution |
| ------------- | -------- | --------- | -------------- | ------ | ---------- |
| Q-A-06 | **WA module name (cross-slot A↔B).** T06 (BSP adapter, A) + T10 (WA config CRUD, B) share one bounded-context module. **PM A decided `whatsapp`** (matches ratified provider enum `'whatsapp'` + spec API/webhook routes `/whatsapp`; `wa` is only the DB-column/RPC abbrev). T06 proceeds on `src/modules/whatsapp/`. **Parent PM: ensure PM B builds T10 in `src/modules/whatsapp/` too** (rename cheap now — no consumers). | PM A (Nathan) | schema provider enum; spec routes; T06 GAP-#1 | PM A decided; awaiting B alignment | `whatsapp` |
| Q-A-08 | **Generic `AppError` codes drift from README §2.3 canonical — shared boilerplate, affects ALL services.** `AuthError`=`AUTH_ERROR` (FE expects `UNAUTHENTICATED`), `RateLimitError`=`RATE_LIMIT_EXCEEDED` (canonical `RATE_LIMIT`), `ExternalServiceError`=`EXTERNAL_SERVICE_ERROR`. FE won't recognize these. Surfaced during T08 (which left them untouched per scope). Needs a boilerplate-reconcile — Parent PM to schedule. NB: reconciling `RateLimitError`→`RATE_LIMIT` would collide with T08's `OutboundQuotaError` (429 `RATE_LIMIT`) — decide merge-or-keep. | PM A (Nathan) | app-errors.ts vs README §2.3 §1.5 | open | — |
| Q-A-01 | **DB topology (affects B+C).** `schema.prisma` header L19-22 claims "Q-OPS-06 H12 shared-DB ratification + real `hotel_id→hotels(id)` FK", but ADR-0004 + CLAUDE §1 (1 svc = 1 DB, BUKAN shared) + data-model §1/§2 + spec §4.1 ("FK opaque if separate DB") mandate/permit **isolated DB**. Schema models declare no FK (already isolated). Runtime tension: spec §2.2 L101 "cross-table SELECT to Auth `hotels.dnd`" + T18 per-dept write-through assume shared. **T02 shipped isolated/opaque — forward-compatible (additive FK later if flipped).** PO: confirm isolated authoritative + fix stale header comment, OR ratify shared-DB (then ADR-0004 needs update + B/C impact). | PM A (Nathan) | schema.prisma:19-22 vs ADR-0004/data-model/spec §4.1 | open | — |

---

## 4. Approved deviations & planning updates (PO-approved)

> Parent PM mencatat tiap perubahan ke planning docs yang dilakukan untuk sync (per `PM-AGENT.md §0.6`), serta deviasi one-off yang di-approve PO. PM A/B/C tidak edit row di sini — propose via §3 atau direct ke Parent PM.

| Tanggal    | Doc / lokasi                                                       | Perubahan singkat                                                                                 | Driver task    | Disetujui oleh |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------------- | -------------- |
| 2026-06-12 | docker-compose.yml, .env.example, README.md, .claude/settings.json | Shift host port Postgres 5432→5433 & Redis 6379→6380 untuk hindari bentrok dengan service lokal | (pre-T01 fix)  | PO             |
| —          | —                                                                  | —                                                                                                 | —              | —              |

---

## 5. Gates (Parent PM enforce, PO define)

> Default kriteria di `PM-AGENT.md §5`. PO override di sini bila perlu.

| Gate | Target H | Criteria (recap)                                                                                       | Status      | Notes |
| ---- | -------- | ------------------------------------------------------------------------------------------------------ | ----------- | ----- |
| G1   | TBD      | Boilerplate ready: `make check` hijau, `make start` jalan, `_template` jalan, ADR lengkap              | not started | PO konfirmasi timeline |
| G2   | TBD      | Modul auth + 1 modul business jalan (CRUD lengkap + 1 external integration). Coverage ≥ 80%            | not started | —     |
| G3   | TBD      | Semua endpoint kontrak terimplementasi. Webhook HMAC tervalidasi. CI hijau                             | not started | —     |
| G4   | TBD      | Feature freeze — hanya bugfix                                                                          | not started | —     |
| G5   | TBD      | UAT pass. AC P0 = 100%. Migrasi prod siap. Runbook lengkap di `docs/runbooks/`                          | not started | —     |

---

## 6. Parent standup log (latest di atas)

> Parent PM consolidate dari 3 standup PM A/B/C (yang masing-masing tinggal di PM-STATUS-{slot}.md §6).
>
> Format:
> ```
> QOOMA BE PARENT — Standup — H{N}/{total}
>
> Dev A (Nathan) — <1-2 baris ringkas dari PM A standup>
> Dev B (Nanak)  — <1-2 baris ringkas dari PM B standup>
> Dev C (Satrio) — <1-2 baris ringkas dari PM C standup>
>
> 📅 Gate status
> - Next gate: G{N} di H{X} — <on track | at risk | slipping>
>
> 🚨 Eskalasi ke PO
> - <satu baris ask>
>
> 🎯 Fokus besok (cross-dev)
> - <re-balance / dependency unblock / shared-infra ship>
> ```

### H0 — 2026-06-12 (bootstrap, pre-multi-dev kickoff)

```
QOOMA BE PARENT — Standup — H0 (bootstrap)

Dev A (Nathan) — belum onboard, awaiting kickoff
Dev B (Nanak)  — belum onboard, awaiting kickoff
Dev C (Satrio) — belum onboard, awaiting kickoff

📅 Gate status
- Next gate: G1 (Boilerplate ready) — kriteria default; PO konfirmasi timeline
- Open contract questions: 0
- Open package questions: 0

🚨 Eskalasi ke PO
- Konfirmasi timeline + gate definition (G1..G5 default vs custom)
- Konfirmasi roadmap awal (T01–T##) untuk distribute ke 3 dev

🎯 Fokus besok / next session
- Setelah PO konfirmasi: Parent PM post first ASSIGNMENT batch,
  PM A/B/C onboard + identitas confirmed, executor session start.
```

---

## 7. Cross-dev incidents / lessons (Parent PM scope — affects >1 dev)

### 2026-06-12 — Docker port collision (pre-T01)

**What happened**: `make start` gagal — port 5432 host sudah dipakai service Postgres lokal user. Error: `Bind for 0.0.0.0:5432 failed: port is already allocated`.

**Fix**: Shift host port di `docker-compose.yml` — Postgres 5432→5433, Redis 6379→6380. Container internal port tetap default (5432/6379) supaya service di compose network tidak butuh perubahan. Updated: `docker-compose.yml`, `.env.example`, `.env` user, `README.md` quick-start note, `.claude/settings.json` MCP postgres DATABASE_URL.

**Tidak diubah**: `.github/workflows/ci.yml` (CI runner fresh, no collision), `docs/TESTING.md` (testcontainers pakai `getMappedPort()` random ephemeral).

**Lesson for tim**: bila task touch local dev port, cek dulu via `lsof -i :<port>` apakah ada bentrok sebelum tetap pakai default.

---

## 8. Next-up queue (Parent PM authority)

> Parent PM rewrite list ini ketika roadmap berubah. Each task **wajib** kolom Slot (A/B/C) untuk routing. PM A/B/C baca queue ini untuk lihat upcoming work — PM A/B/C tidak edit queue.

_(belum ada — tunggu PO post task / roadmap awal)_

<!-- TEMPLATE — copy untuk task baru di queue:

### T## — <Title>

- **Slot**: A | B | C (Parent PM assign)
- **Owner**: TBD (PM <SLOT> pick up via PM-STATUS-<SLOT>.md §2 ASSIGNMENT)
- **Started**: —
- **Status**: queued

#### Scope (dari roadmap / DEVELOPMENT-PLAN bila ada)
- ...

#### Files yang harus dibuat
- ...

#### Files yang akan dimodifikasi
- ...

#### T## DoD
- [ ] ...
- [ ] ...

#### Parent PM notes untuk PM <SLOT>
- Rasionalisasi slot pick: <kenapa A/B/C>
- Dependency: T## (slot X, status)
- Shared-infra risk: <none | flags file/folder shared dengan slot lain>
- Coordination needed with: <slot> for <reason>

-->

---

## 9. Eskalasi rules (recap)

DM PO langsung HANYA bila:

1. Gate (G1..G5) akan miss dalam 24 jam — Parent PM call
2. Open contract Q blocking > 48 jam — consolidated
3. Executor (via PM A/B/C) propose scope/architecture change — Parent PM ratify dulu
4. Forbidden package / pattern muncul di PR (CLAUDE.md §6 / §11)
5. Drift sistemik (>5 hits sejenis di banyak file lintas dev)
6. Security WAJIB (CLAUDE.md §6) tersentuh — Parent PM eskalasi instan

Routine miss / single drift / daily standup → PM-STATUS-{slot} → roll-up
ke §2 / §6 di sini, **bukan** ke PO langsung.

---

## 10. Cross-dev coordination notes

> Parent PM catat hal yang affect > 1 dev: file collision, shared-infra ship sequence, re-balance proposal, dependency unblocking. PM A/B/C boleh propose via §3c (architecture Q).

| Tanggal | Topic                                         | Affects        | Action / decision                         |
| ------- | --------------------------------------------- | -------------- | ----------------------------------------- |
| —       | —                                             | —              | —                                         |

<!-- Contoh:
2026-06-30 | core/queue/ Bull factory pattern decision | B, C | A ship dulu (T05), B & C unblocked H+1
2026-07-02 | shared/utils/crypto.ts signature change | A, B          | A coord with B; B re-test webhook (T11)
-->

---

## 11. Quick reference — file ownership matrix

| File / Folder                                            | Edit authority                                                                                             |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `PM-STATUS-PARENT.md`                                    | Parent PM (full) · PM A/B/C (only append to §2 roll-up & §6 standup; status update for own row in §1)      |
| `PM-STATUS-A.md`                                         | PM A (Nathan) + Executor A (assignment/PLAN/CHECKPOINT/SUBMIT only — append-only)                          |
| `PM-STATUS-B.md`                                         | PM B (Nanak) + Executor B (same)                                                                           |
| `PM-STATUS-C.md`                                         | PM C (Satrio) + Executor C (same)                                                                          |
| `CLAUDE.md`, `PM-AGENT.md`, `EXECUTOR-PROTOCOL.md`, `KICKOFF.md`, `README.md`, `docs/*`, `docs/decisions/*` | Planning agent (with PO ack) · Parent PM (sync update per `PM-AGENT.md §0.6`)                              |
| `src/`, `prisma/migrations/`                             | Executor A/B/C (each in own task scope) — never PM/Parent PM                                               |
| `prisma/schema.prisma`                                   | Executor (in task that touches schema) — never PM (kecuali typo non-semantik)                              |
| `package.json` deps                                      | PO approval via Parent PM eskalasi — no executor adds deps unilaterally                                    |
| `docker-compose.yml`, `Makefile`, env templates          | Executor (in task that touches them); Parent PM consolidate via §4 deviation log                           |
