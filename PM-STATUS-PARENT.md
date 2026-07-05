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
- **Active devs**: A (Nathan) · B (Nanak) · C (Satrio) — **slot A foundation T01-T09 = 9/9 MERGED**; B (T10+) & C (T17+) unblocked, not yet started
- **Progress (global)**: **9 / 25 merged** (T01-T09 slot A, all attempt 1) · 0 slot B · 0 slot C · T10-T25 backlog (T10-T16 = slot B · T17-T25 = slot C)
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
| T08 | Common error handlers (Integration-specific codes per spec §9)                   | A    | Nathan  | merged   | PM A (H12)  | F7 complete: 7 §9 error classes + canonical `{error:{…}}` envelope handler (README §2.3), non-AppError→500 INTERNAL no-leak, correlationId log. 100% new-code cov. Merged PR #8 `b503041`. Consumed by all B/C endpoints. Q-A-08 (generic-code drift) |
| T09 | Internal RPC server (HTTP/mTLS auth scheme; spec §10 catalog)                    | A    | Nathan  | merged   | PM A (H12)  | shared-secret guard (`X-Internal-Secret`), timingSafeEqual + empty-secret-reject, 401 native, injected secret, 100% line cov. Merged PR #9 `633b45f`. Q-A-09 (cross-svc auth contract). **Slot-A foundation 9/9 ALL MERGED** |
| T10 | WA config CRUD (`GET, PUT /api/integrations/whatsapp`)                           | B    | Nanak   | merged | PM B (H16, a2) | Primitive shipped: types+zod+Prisma-direct-ctor-inject repo+service (encrypt+decrypt-mask on view + PII-floor log BEFORE encrypt + round-trip mask stability) + 28 unit tests, 100% module cov, drift clean, make check green on PM rerun. Router+api.ts wiring = T10-followup blocked on Q-C-01/02/03. Merged PR #10 `36462d2` |
| T11 | Verify webhook action (`POST /api/integrations/whatsapp/verify-webhook`)         | B    | Nanak   | backlog  | —           | After T10                                                                   |
| T12 | WA inbound webhook ingest (signature → persist → HC guest upsert → AI RPC)       | B    | Nanak   | backlog  | —           | After T04 + T05 + T10                                                       |
| T13 | Outbound WA dispatch RPC + DND check + quota two-phase                           | B    | Nanak   | backlog  | —           | After T06 + T09; HC RPC `check_and_reserve_outbound_quota`                  |
| T14 | Outbound retry queue (3 attempts exponential backoff)                            | B    | Nanak   | backlog  | —           | After T07 + T13                                                             |
| T15 | Delivery receipts ingest (WA Cloud webhook stream)                               | B    | Nanak   | backlog  | —           | After T04 + T12                                                             |
| T16 | WA template Meta relay (submit/resubmit/callback to HC)                          | B    | Nanak   | approved (primitive) | PM B (H17, a1) | Narrow primitive per PM ACK modified-B: types + zod + service + BSP template port + HC callback port TYPE-ONLY + 1engage template adapter (PATCH-preferred + DELETE+POST fallback) + 48 unit tests, 100% module cov, drift clean, make check green on PM rerun. Q-B-01/02/03 stamped in 4 files; HC adapter dropped to T16-followup pending Q-B-02/Q-C-02. Branch `feat/wa-template-relay @ 1a5c20d`, PR pending push |
| T17 | Telegram config CRUD (`GET, PUT /api/integrations/telegram`)                     | C    | Satrio  | pr-open (red-docker) | PM C (H13 code · H14 PR) | PR #11 open, CI 3/4 green (lint+typecheck/unit/integration) + Docker-build RED = Q-C-05 shared-infra Dockerfile×pnpm×Prisma bug (same failure that shipped in T10/PR#10 red-merge; not T17 defect). Merge policy escalated. Router+api.ts wiring = T17-followup on Q-C-01/02/03 |
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
[2026-07-03 H12] [PM A Nathan] **T09 APPROVED (attempt 1) — 🎉 SLOT-A FOUNDATION COMPLETE (T01-T09, 9/9, all attempt 1, zero rejects).** T09 = internal-RPC shared-secret auth guard, PM code-audit vs MVP §4.11: `X-Internal-Secret` not cookie/JWT, timingSafeEqual + empty-secret fail-closed (tested both ways), 401 native + handler-skip proven, injected secret (no env added), 100% line cov, make check green. Callback-style hook (correct Fastify fix for arity-hang, flagged). Code awaiting PO merge. **B (T10+) & C (T17+) fully unblocked** (schema+crypto+HMAC+tenant+BSP+queue+errors+RPC-auth all delivered). ⚠ **New cross-service Q-A-09 (§3a):** internal-RPC auth contract (header/secret/README doc + transport decision) needs PO + HC/AI ratification. **9 open Qs total** — recommend Parent PM batch the shared-boilerplate trio (Q-A-03 test-env, Q-A-05 eslint, Q-A-08 error-codes) + route the B/C-gating contract Qs (Q-A-01 topology, Q-A-04 WA-secret, Q-A-06 module-name, Q-A-07 retry-count, Q-A-09 RPC-auth) to PO before B/C reach the dependent tasks.
[2026-07-03 H12] [PM A Nathan] T07 MERGED (PR #7). **T08 APPROVED (attempt 1)** — F7 complete: 7 spec-§9 error classes + canonical-envelope handler. PM-verified: codes exact vs §9, envelope wrapper `{error:{code,message,details}}` matches README §2.3 (exec found the wrapper doc + `INTERNAL`-for-500, matched-not-invented), non-AppError→500 no-leak (tested), correlationId logging, 100% new-code cov, make check green. Code awaiting PO merge. **8 of 9 slot-A foundation approved (T01-T08); only T09 RPC left.** ⚠ **New Q-A-08 (§3c) — shared boilerplate, all services:** generic AppError codes (`AUTH_ERROR`/`RATE_LIMIT_EXCEEDED`/…) drift from README §2.3 canonical (`UNAUTHENTICATED`/`RATE_LIMIT`) → FE won't recognize; needs a boilerplate-reconcile, Parent PM to schedule.
[2026-07-04 H13] [PM C Satrio] Online. Last approved: none (session start). Active: 1 (T17 PLAN attempt 1). Next-up: T17→wip narrow. Open Qs: 0 (pre-review).
[2026-07-04 H13] [PM C Satrio] **T17 PLAN a1 REJECT-scope-narrow** — PLAN faithful vs spec §2.1/§4.2, but bundled 3 shared-infra edits (prisma singleton uncomment, api.ts bootstrap, stub JWT `requireGmAdmin`) into slot-C scope + 1 wrong masking design (masked envelope-hash instead of decrypt→mask-plaintext). Narrowed to unit-testable primitive per PM A T04-T09 precedent (types/schema/repo/service+unit tests; router+api.ts wiring deferred). **4 new open Qs raised (§3, foundation gaps affecting B+C):** Q-C-01 Prisma client singleton wiring (blocks all repos), Q-C-02 api.ts bootstrap (blocks all HTTP endpoints), Q-C-03 session/JWT auth plugin (cross-service contract w/ Auth svc repo — blocks T10-T20+T23), Q-C-04 tenant-id source on CRUD endpoints (cascades Q-C-03). **Parent PM: please route Q-C-01/02 (assign foundation follow-ups F10/F11) + Q-C-03 to PO (cross-service Auth contract) — all three block Nanak's T10 too.** T17 status → wip.
[2026-07-04 H13] [PM C Satrio] **T17 primitive APPROVED (attempt 2)** — narrow scope respected (only `src/modules/telegram/**` touched; prisma-client/api.ts/plugins zero-touched). All 3 REJECT items addressed: masking = decrypt→maskTokenForLog on GET view (stable, round-trip test-verified); scope contained (git diff confirmed); repository Prisma-direct with ctor-injected `PrismaClient` (ADR-0001 preserved). PM independent rerun: `make check` green, 108 tests / 12 suites, +22 new (11 service + 3 repo + 8 schema), 100% module cov; drift scans clean (0 any/console/throw/default-export/forbidden-imports/.skip). Security floor OK (AES-256-GCM via T03 helper, no plaintext in DB/log/view, PII floor test asserts `JSON.stringify(loggedPayload)` excludes plaintext). Branch `feat/telegram-config-crud @ 98f098b` — executor to push + open PR; PM re-verify on CI green. **1 tolerated deviation flagged**: repo unit test mocks Prisma (CLAUDE §8 dislikes) — accepted as stopgap because Q-C-01 blocks integration test; required follow-up when Q-C-01 lands. **Slot C progress: 1/9 (T17 primitive)** · router+wiring parked as T17-followup awaiting Q-C-01/02/03. Q-A-03 workaround re-appeared in T17 tests, confirming shared-infra baseline test env still needed.
[2026-07-05 H14] [PM C Satrio] **PR #11 (T17) CI review — 3/4 green, Docker-build RED (shared-infra bug — main is red since T10 merge)**. Lint+Typecheck / Unit / Integration all SUCCESS on CI; Docker-build FAILURE with `TS2305: Module '@prisma/client' has no exported member 'TelegramConfig'`/`'WaConfig'`. Root-cause investigation: NOT a T17 code defect — locally `make check` green + same import pattern works in code (Prisma schema:33+49 declares both models). Dockerfile L25 runs `pnpm prisma:generate` but tsc in stage-3 doesn't see generated types — suspected pnpm strict-hoist × Prisma custom-output (`output = "../node_modules/.prisma/client"` at schema.prisma:3). **T10 (PR #10, PM B) merged RED at 2026-07-04T16:28:09Z with the SAME failure** → main has been red on Docker-build since; T17 inherits + repeats, doesn't introduce. **Precedent conflict with PM-AGENT §4 "Merge tanpa lulus CI"** — Parent PM needs to ratify merge policy for T10+T17 pending Dockerfile fix (rollback T10 or waive Docker check batch-wide). **New Q-C-05 raised (§3b tooling)** — shared-infra Dockerfile fix affects every future PR with `@prisma/client` type imports (T13/T15/T17-followup/T18-T25). PM C **NOT unilaterally merging** PR #11 under strict CI policy; awaiting Parent PM decision on both Q-C-05 fix routing + merge-policy consistency.
[2026-07-04 H16] [PM B Nanak] **T10 primitive APPROVED (attempt 2)** — mirror T17-a2 shape. Narrow scope respected (only `src/modules/whatsapp/whatsapp-config.*` + barrel append; api.ts/prisma-client/plugins/schema.prisma/package.json zero-touched). All 5 REJECT items addressed (routes dropped, `maskTokenForLog`-not-roll-own, direct crypto/mask imports, PII-floor log + `Logger` dep with events-ordering test proving log-BEFORE-encrypt, attribution corrected). PM independent rerun on `feat/whatsapp-config-crud @ 175faa5`: `make check` green (117 tests / 12 suites; +28 new: 16 schema + 3 repo + 9 service), 100% stmt/branch/func/line on all 3 runtime files; drift scans clean (0 hits all 6 categories). Security floor OK: AES-256-GCM via T03 (`v1:` envelope verified), PII-floor log fires BEFORE encrypt (events-array test `['log','upsert']`), no plaintext in view (`JSON.stringify(result)` assertion). Spec DDL §4.1 length caps verified 1:1 vs zod. **2 tolerated deviations pre-declared**: (a) Prisma-mock stopgap in repo test — T10-INTEG follow-up parked awaiting Q-C-01; (b) defensive over-mask on `webhookVerifyToken` in GET view (spec §5 AC only mandates `access_token` masked; keep unless FE surfaces read-back need). Q-A-03 shared-infra workaround re-appeared in service tests — cross-slot confirmation with T17. Q-B-01 NOT filed; T12 blocker references existing Q-A-04. **Slot B progress: 1/7 (T10 primitive)** · T10-followup (routes+wiring) + T10-INTEG parked awaiting Q-C-01/02/03. Branch pushed, PR pending; PM re-verify on CI green.
[2026-07-04 H16] [PM B Nanak] T10 primitive MERGED (PR #10 `36462d2`) — 1/7 slot B; global merged 10/25 (T01-T09 slot A + T10 slot B). T10-followup (routes + api.ts wiring + JWT hotelId) + T10-INTEG (real-DB integration test) parked awaiting Q-C-01/02/03. Next slot-B pick: TBD from T11-T16 backlog per Parent PM routing.
[2026-07-05 H17] [PM B Nanak] **T16 primitive APPROVED (attempt 1, narrow per PM ACK modified-B)** — WA template Meta relay (submit / resubmit / status-callback). Narrow scope respected (only `src/modules/whatsapp/whatsapp-template.*` + 2 new ports + BSP template adapter + barrel append; T06 BSP + T10 config + api.ts/prisma-client/plugins zero-touched). ACK modified-B honored: 9 files (types + schema + service + 2 ports + BSP adapter + 3 tests + barrel), HC callback adapter DROPPED to T16-followup pending Q-B-02/Q-C-02. PM independent rerun on `feat/wa-template-relay @ 1a5c20d`: `make check` green (186 tests / 20 suites; +48 new: 18 schema + 17 service + 13 adapter), 100% stmt/branch/func/line on all 3 runtime files (schema.ts, service.ts, 1engage-template.adapter.ts); drift scans clean (0 hits all 6 categories). All 14 ACK binding conditions verified file:line — PII-floor test + ordering `events: ['log', 'bsp']`, `ExternalServiceError` not raw (`service: '1engage-template'` distinct from T06 `'1engage'`), HC callback port TYPE-ONLY (19 LOC), `HttpPoster` re-declared inline mirroring T06, Meta URL `/{waba_id}/message_templates` asserted in adapter tests, PATCH-preferred + DELETE+POST fallback both branches covered, Q-B-01/02/03 stamps in 4 files. Security floor OK (no plaintext in log/response; access token only in `Authorization` header at network boundary). Spec §2.4/§3.1 3-leg flow implemented (HC→us RPC, us→Meta, Meta→us→HC). Prettier collapse + `exactOptionalPropertyTypes` widening (non-semantic) noted. **1 discipline discovery**: adapter re-exports blocked by `no-restricted-imports` — T06 barrel discipline confirmed cross-slot; adapter wiring deferred to entrypoint (Q-C-02 land). **Slot B progress: 2/7 (T10 + T16 primitives merged/approved)** · T11 (verify-webhook) + T12 (inbound ingest) + T13 (outbound dispatch) + T14 (retry) + T15 (delivery receipts) backlog · T16-followup + T16-INTEG parked awaiting Q-B-01/02/03 + Q-C-01/02 + Q-A-04. Branch pushed, PR pending; PM re-verify on CI green.

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
| Q-A-09 | **Internal RPC auth scheme — cross-service (HC/AI caller side).** T09 ships a shared-secret guard reading `X-Internal-Secret` (MVP §4.11: shared-secret/mTLS not cookie; document in README). HC + AI (callers per §2.4) must send the same header + secret. Needs: (a) README doc of scheme, (b) cross-service ratify header + secret provisioning, (c) transport decision (internal routes on main API vs dedicated server/port per F8). T09 not blocked (guard is transport-agnostic). PO + HC/AI to ratify. | PM A (Nathan) | MVP §4.11; spec §2.4; F8 | open | — |
| Q-B-01 | **`waba_id` (WhatsApp Business Account ID) storage location — sibling to Q-A-04; affects T16 router-layer + possibly T13.** Meta's `/{waba_id}/message_templates` needs WABA ID (account-level, distinct from per-phone `phone_number_id`). `wa_configs` DDL §4.1 has NO `waba_id` column. **Options**: A) HC sends `waba_id` per-RPC in payload (defers to HC-side config; T16 primitive assumes this) [PM B default]; B) add `waba_id VARCHAR(80) NOT NULL` to `wa_configs` — schema follow-up analogous to Q-A-04's `app_secret_enc`, needs slot-A/Nathan land; C) new `wa_business_accounts` table — overkill for MVP. **T16 primitive not blocked** (builds under assumption A with explicit stamp); router-layer T16-followup is. PO/HC to rule. | PM B (Nanak) | schema.prisma:33 vs Meta `/message_templates` API; T16 PLAN GAP-#2 | open | — |
| Q-B-02 | **HC callback endpoint contract for `updateWaTemplateStatus` (cross-service, HC-team + PO).** Spec `04-integration-channels.md §3.1` L108 mentions "internal callback to HC" for template status transitions — no URL, no path, no payload shape, no expected HC response. `docs/spec/02-hotel-core.md` does NOT exist in this repo. **Options**: A) narrow port `HotelCoreTemplateCallbackPort` — adapter accepts `{ baseUrl, path, internalSecret }` at construction, PM/HC ratifies exact path via config later [PM B keeps port TYPE-ONLY in T16 primitive; adapter deferred to T16-followup]; B) hard-code assumed `POST /internal/wa-templates/:id/status` with `{ status, reason?, meta_template_id }`; C) block T16 until HC exposes contract. Blocks T16-followup HC adapter. HC-team + PO ratify. | PM B (Nanak) | spec §3.1 L108 vs missing `02-hotel-core.md`; T16 PLAN GAP-#5 | open | — |
| Q-B-03 | **HC → us RPC payload shape for `submit_wa_template_to_meta` / `resubmit_wa_template_to_meta` — Q-CONTRACT-07 territory (cross-service).** Spec §2.4 L85-86 signatures are `submit_wa_template_to_meta(template_id)` + `resubmit_wa_template_to_meta(template_id)` — template_id only. But Meta's `/message_templates` needs `{ name, category, language, components[], waba_id, access_token }`. **Options**: A) HC sends full payload in RPC body — `template_id` is shorthand; matches spec §3.1 narrative; avoids HC→us→HC round-trip [PM B default]; B) HC sends only `{ template_id }` and we RPC HC back via a new `getWaTemplate(template_id)` internal RPC — extra hop, new contract; C) block T16 until PO ratifies (spec §10 Q-CONTRACT-07). **T16 primitive not blocked** (schema stamps assumption A); router-layer T16-followup inbound RPC receiver is. PO + HC to rule. | PM B (Nanak) | spec §2.4 L85-86 + §3.1 L108 + §10 Q-CONTRACT-07; T16 PLAN GAP-#1 | open | — |
| Q-A-07 | **Outbound retry count — spec self-contradicts; affects slot B (T14).** spec §7 L344 "3 retries (1s,5s,30s)" vs §7 L345 "after 3 attempts→failed" vs MVP §4.9 "3-attempt". 3 total attempts (30s delay unused) or 3 retries=4 attempts (30s used)? **T07 ships default `attempts=3` (restrictive per CLAUDE §14, per-job configurable) + `[1s,5s,30s]` strategy** → not blocked. PO: ratify + fix spec §7 wording before B builds T14 outbound retry queue. | PM A (Nathan) | spec §7 L344-345 vs MVP §4.9 | open | — |
| Q-C-03 | **Session/JWT auth plugin — cross-service contract w/ Auth svc repo; blocks all `gm_admin` CRUD (spec §2.1).** `src/plugins/` has hmac+tenant+internal-rpc-auth+error-handler only; no session/JWT. `env.ts:36-39` declares `JWT_ACCESS_SECRET`/refresh secrets, no consumer. Auth svc = separate repo (KICKOFF §1 L11) — Integration verifies JWTs. **Cross-service Qs**: (a) verification method — JWKS URL fetch vs HS256 shared secret? (b) JWT payload shape — `{ sub, hotel_id, role, exp }`? (c) refresh-token relevance (Integration doesn't issue)? Preferred MVP: HS256 shared secret + `{ sub, hotel_id, role }` + verify-only plugin. Blocks T10 (B), T17 route (C), T18-T20, T23. | PM C (Satrio) H13 | KICKOFF §1 L11; env.ts:36-39; src/plugins/*; T17 PLAN GAP-#3 | open | — |

### 3b. Package / tooling questions

| ID            | Question | Raised by | Source         | Status | Resolution |
| ------------- | -------- | --------- | -------------- | ------ | ---------- |
| Q-A-03 | **Test env (shared-infra, affects B/C).** `NODE_ENV=test` (Jest default) not in `env.ts` enum → any test calling `loadConfig()` throws. T03/T04 used a localized in-test `NODE_ENV:'development'`. Recommend small chore: baseline test env in `src/shared/utils/test-setup.ts` (or add `'test'` to enum). | PM A (Nathan) | env.ts:16; T03 SUBMIT | open | — |
| Q-A-05 | **ESLint async-hook (shared-config, affects B/C).** `@typescript-eslint/no-misused-promises` false-positives on async Fastify hooks in route-option properties (`checksVoidReturn.properties`); typecheck passes, runtime correct. T04 used a local 1-line disable (test only). Recommend project-level `['error', { checksVoidReturn: { properties: false } }]` (keeps `no-floating-promises`). Hits B/C on every async `preHandler`/hook. | PM A (Nathan) | T04 SUBMIT; `.eslintrc.cjs` | open | — |
| Q-C-05 | **Dockerfile × pnpm × Prisma custom-output — SHARED-INFRA BUG; main is currently RED on Docker-build.** `pnpm build` inside Docker (tsc -p tsconfig.build.json) fails with `TS2305: Module '@prisma/client' has no exported member 'TelegramConfig'` + `no exported member 'WaConfig'`. Locally + CI unit/integration/lint/typecheck: green. Dockerfile stage 2 L25 `RUN pnpm prisma:generate`; schema custom `output = "../node_modules/.prisma/client"` (schema.prisma:3). Suspected pnpm strict-hoisting × Prisma custom-output. **T10 (PR #10, PM B) merged RED with the SAME failure at 2026-07-04T16:28:09Z** — main has been red on Docker-build since. Precedent conflict with `PM-AGENT.md §4` "Merge tanpa lulus CI". PR #11 (T17) inherits + repeats — not a T17 code defect. **Ask Parent PM**: (a) fix candidate — remove custom output vs `.npmrc public-hoist-pattern[]=*prisma*` vs Dockerfile-hoist step? (b) route as slot-A/foundation follow-up (F12?)? (c) merge-policy ratify for T10 + T17 pending fix (rollback T10 or waive Docker-build check batch-wide)? Blocks PR #11 merge under strict policy; blocks all future PRs with `@prisma/client` type imports (T13/T15/T17-followup/T18-T25). | PM C (Satrio) H14 | Dockerfile L22-32; prisma/schema.prisma:1-5; GH Actions run 28716832757; T10 PR #10 red-merge precedent | open | — |

### 3c. Architecture / planning questions

| ID            | Question | Raised by | Source         | Status | Resolution |
| ------------- | -------- | --------- | -------------- | ------ | ---------- |
| Q-A-06 | **WA module name (cross-slot A↔B).** T06 (BSP adapter, A) + T10 (WA config CRUD, B) share one bounded-context module. **PM A decided `whatsapp`** (matches ratified provider enum `'whatsapp'` + spec API/webhook routes `/whatsapp`; `wa` is only the DB-column/RPC abbrev). T06 proceeds on `src/modules/whatsapp/`. **Parent PM: ensure PM B builds T10 in `src/modules/whatsapp/` too** (rename cheap now — no consumers). | PM A (Nathan) | schema provider enum; spec routes; T06 GAP-#1 | PM A decided; awaiting B alignment | `whatsapp` |
| Q-A-08 | **Generic `AppError` codes drift from README §2.3 canonical — shared boilerplate, affects ALL services.** `AuthError`=`AUTH_ERROR` (FE expects `UNAUTHENTICATED`), `RateLimitError`=`RATE_LIMIT_EXCEEDED` (canonical `RATE_LIMIT`), `ExternalServiceError`=`EXTERNAL_SERVICE_ERROR`. FE won't recognize these. Surfaced during T08 (which left them untouched per scope). Needs a boilerplate-reconcile — Parent PM to schedule. NB: reconciling `RateLimitError`→`RATE_LIMIT` would collide with T08's `OutboundQuotaError` (429 `RATE_LIMIT`) — decide merge-or-keep. | PM A (Nathan) | app-errors.ts vs README §2.3 §1.5 | open | — |
| Q-A-01 | **DB topology (affects B+C).** `schema.prisma` header L19-22 claims "Q-OPS-06 H12 shared-DB ratification + real `hotel_id→hotels(id)` FK", but ADR-0004 + CLAUDE §1 (1 svc = 1 DB, BUKAN shared) + data-model §1/§2 + spec §4.1 ("FK opaque if separate DB") mandate/permit **isolated DB**. Schema models declare no FK (already isolated). Runtime tension: spec §2.2 L101 "cross-table SELECT to Auth `hotels.dnd`" + T18 per-dept write-through assume shared. **T02 shipped isolated/opaque — forward-compatible (additive FK later if flipped).** PO: confirm isolated authoritative + fix stale header comment, OR ratify shared-DB (then ADR-0004 needs update + B/C impact). | PM A (Nathan) | schema.prisma:19-22 vs ADR-0004/data-model/spec §4.1 | open | — |
| Q-C-01 | **Prisma client singleton wiring — foundation gap; affects B+C.** `src/core/prisma/prisma-client.ts:29` still `export const db = {} as unknown as ...` placeholder. Not delivered by T01-T09 (PM A precedent: primitives shipped, wiring deferred to "assembly"). Blocks any repository / integration test in T10 (B) + T17-T25 (C). **Ask**: (a) route as slot-A foundation follow-up (F10?), or (b) authorize slot-B/C to ship (1-line uncomment; `@prisma/client` dep already declared). Preferred (a). | PM C (Satrio) H13 | src/core/prisma/prisma-client.ts:11-29; T17 PLAN GAP-#1 | open | — |
| Q-C-02 | **`src/entrypoints/api.ts` bootstrap — foundation gap; affects all HTTP endpoints.** File still stub (line 38 `console.warn`). Fastify server + error-handler plugin (T08) + correlation-id + tenant-resolver (T05) + config load + graceful shutdown not wired. Blocks endpoint reachability for T10-T20 + T23. Q-A-05 (eslint async-hook `checksVoidReturn.properties: false`) recommended land **before** or bundled with this so all future async `preHandler`/hook code passes lint cleanly. **Ask**: prioritize/assign api.ts bootstrap task (F11?). | PM C (Satrio) H13 | src/entrypoints/api.ts:11-45; T17 PLAN GAP-#2 | open | — |
| Q-C-04 | **Tenant identification for CRUD endpoints — cascading from Q-C-03.** Spec `/api/integrations/telegram` has no `:hotel_slug` in path (unlike webhook routes at `/webhooks/wa/:hotel_slug` spec §2.2). Alternatives: (a) JWT payload `hotel_id` (session-bound; preferred if Q-C-03 lands JWT); (b) header `X-Hotel-Id` (weak); (c) path rewrite `/api/hotels/:hotel_slug/...` (spec-drift). Locked to Q-C-03 outcome. | PM C (Satrio) H13 | spec §2.1 vs §2.2; T17 PLAN GAP-#4 | open | — |

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

### H13 — 2026-07-04 (sub-PM contributions; Parent PM to consolidate)

Dev C (Satrio) — H13: 1 approved, 0 wip, 1 rejected (PLAN a1) today. Next: T17-followup (router+wiring) — parked awaiting Q-C-01/02/03. Blocker: foundation assembly gaps (prisma singleton, api.ts bootstrap, JWT plugin) — Q-C-01/02/03 in §3 need Parent PM/PO action; all three also block Nanak's T10.

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
