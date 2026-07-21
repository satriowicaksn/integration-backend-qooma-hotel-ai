# Backend MVP — Integration Slice (H12 PO directive)

> **Audience**: backend engineer(s) building Integration / Channels after Hotel Core lands. This is the **third coherent slice** to implement — ship Integration so WhatsApp inbound creates real tickets and outbound flows from CRM action.
>
> **Authority**: derived from `04-integration-channels.md` (full Integration surface) + `docs/API-CONTRACT.md` §2.7. Where this brief abbreviates, those are canonical.
>
> **Why Integration third**: once Hotel Core ships (per `MVP-HOTEL-CORE-FIRST.md`), the CRM works end-to-end against real data — but tickets only exist via seed scripts or manual creation. Integration unlocks the **real-world ingress**: WA messages from guests become tickets automatically; staff can dispatch outbound WA / Telegram messages from the CRM. AI ships last and orchestrates the full conversation flow.

---

## 1. What's in scope (Integration MVP)

Endpoints + RPCs grouped by capability.

### 1.1 Foundation (Slot A — Nathan, ships first)

| #   | Capability                                                  | Artifact                                                                |
| --- | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| F1  | Prisma schema + initial migration (8 Integration tables)    | `prisma/schema.prisma` + first migration                                |
| F2  | Encryption-at-rest helper (tokens / passwords)              | `src/common/crypto.ts`                                                  |
| F3  | Webhook signature-verification middleware (Meta + Telegram) | `src/common/signature-verify.ts`                                        |
| F4  | Tenant resolution from `:hotel_slug`                        | `src/common/slug-lookup.ts` (cached `hotels.code → hotels.id` map)      |
| F5  | BSP adapter interface (`1engage` impl + ABI for future)     | `src/adapters/bsp/`                                                     |
| F6  | Queue + scheduler infra (BullMQ or equivalent)              | `src/common/queue.ts` + worker harness                                  |
| F7  | Common error handlers (canonical envelope + Integration codes) | `src/common/errors.ts`                                                |
| F8  | Internal RPC server (called by HC + AI)                     | `src/rpc/server.ts` (HTTP-based internal API)                           |

### 1.2 WhatsApp + Outbound Dispatch (Slot B — Nanak)

| #   | Capability                                | Endpoint(s) / RPC                                                                    | Roles                |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------ | -------------------- |
| B1  | WA config CRUD                            | `GET, PUT /api/integrations/whatsapp`                                                | `gm_admin`           |
| B2  | Verify webhook                            | `POST /api/integrations/whatsapp/verify-webhook`                                     | `gm_admin`           |
| B3  | WA inbound webhook ingest                 | `POST /webhook/whatsapp/:hotel_slug` (no session; signature-verified)                | public               |
| B4  | Outbound WA dispatch (RPC)                | `send_wa_message(hotel_id, guest_id, body, template?, variables?)`                   | internal (HC/AI)     |
| B5  | DND + quota gating in dispatch            | wired into B4 — RPC HC for quota check + reserve + commit                            | internal             |
| B6  | Retry queue for failed dispatches         | wired into B4 + queue worker                                                         | n/a                  |
| B7  | Delivery receipts ingest                  | part of B3 (WA Cloud sends receipts in same webhook stream)                          | n/a                  |
| B8  | WA template relay (submit/resubmit/callback) | RPC `submit_wa_template_to_meta(template_id)` + RPC `resubmit_wa_template_to_meta(template_id)` + Meta status webhook handler that callbacks HC | internal (HC)        |

### 1.3 Telegram + OTA + QR + Health (Slot C — Satrio)

| #   | Capability                                | Endpoint(s) / RPC                                                                    | Roles                |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------ | -------------------- |
| C1  | Telegram config CRUD                      | `GET, PUT /api/integrations/telegram`                                                | `gm_admin`           |
| C2  | Per-dept Telegram routing write-through   | `PUT /api/integrations/telegram/departments/:dept_id` (writes HC `departments` table) | `gm_admin`           |
| C3  | Telegram inbound webhook + commands       | `POST /webhook/telegram/:hotel_slug` — handle `/take`, `/release`, `/done`, `/help`  | public               |
| C4  | Outbound Telegram dispatch (RPC)          | `send_telegram_message(chat_id, body, parse_mode?)` for escalation pings + daily brief | internal (HC) |
| C5  | OTA email IMAP poller                     | cron worker reading `ota_mailbox_state`, RPC HC `create_pending_visit(...)`          | n/a                  |
| C6  | QR generation + download                  | `POST /api/integrations/qr/regenerate` · `GET /api/integrations/qr/download`         | `gm_admin`           |
| C7  | Integration overview endpoint             | `GET /api/integrations`                                                              | `gm_admin`           |
| C8  | Channel health probes + snapshots         | background worker + `GET /api/integrations/health`                                   | `gm_admin`           |
| C9  | `integration:health_changed` socket emits | wired into C8                                                                        | n/a                  |

---

## 2. Out of MVP Integration slice (subsequent waves)

- **Multi-BSP support** — code against `1engage` only in MVP. Keep the BSP adapter interface so a future Twilio/Vonage/etc. swap is a one-adapter add.
- **PMS direct API integration** (Cloudbeds/Mews/Opera) — Enterprise tier only per CLAUDE.md §11.5.
- **OTA direct API** (Booking.com Reservation API, Agoda XML) — email parsing is the MVP path.
- **Voice / SIP integration** — groundwork-only per ADD-23. Integration service does NOT handle voice in MVP.
- **Advanced retry policies** — 3-attempt exponential backoff is the MVP behavior. Adaptive retry, jitter, circuit-breaker can land later.
- **Raw email blob retention** for re-parse on format drift — store the parsed output only in MVP; raw blobs optional add-on (Q-OPS-05).
- **Telegram inline keyboards / rich UI** — `/take 1234` text command is enough for MVP. Inline buttons can land later.

---

## 3. DB migration order (greenfield, Integration slice)

> Integration runs in its **own DB** per `shared/data-model.md` §1 recommended split. `hotel_id` is opaque (no FK to Auth's `hotels` table); webhook routing uses `:hotel_slug` lookup against a cached `hotels.code → hotels.id` map (RPC to Auth or shared-DB read, your choice).
>
> If you go shared-DB (Auth + HC + Integration all in one Postgres), then `hotel_id` CAN have a real FK. Document the choice in `shared/open-questions.md` Q-OPS-06.

1. **`wa_configs`** — first because verify-webhook needs it.
2. **`telegram_configs`** — second; Telegram outbound needs it.
3. **`qr_state`** — needed by `/qr/regenerate`.
4. **`webhook_events`** — audit log; populated by both ingress endpoints.
5. **`outbound_dispatch_queue`** — needed for B4 + B5 + B6.
6. **`delivery_receipts`** — populated as WA Cloud sends receipts.
7. **`channel_health_snapshots`** — populated by health probe worker.
8. **`ota_mailbox_state`** — needed by C5.

Each migration is forward-only. Indexes per DDL in `04-integration-channels.md` §4.

---

## 4. Critical correctness checks (don't skip)

**4.1 Encryption at rest** — `wa_configs.access_token`, `telegram_configs.bot_token`, `ota_mailbox_state.imap_password` MUST be encrypted before persist. Use KMS or libsodium; never store plaintext. Reject migration if env-var encryption key is missing (fail-fast).

**4.2 Webhook signature verification** — `/webhook/whatsapp/:hotel_slug` MUST verify `X-Hub-Signature-256` against the hotel's `wa_configs.webhook_verify_token`. `/webhook/telegram/:hotel_slug` MUST verify per Telegram's scheme. Reject with 401 if invalid. NO exceptions.

**4.3 Tenant resolution from `:hotel_slug`** — cache the slug→hotel_id map (LRU, 5-min TTL). If slug not found → 404. Never trust `hotel_id` from webhook body.

**4.4 DND gating on outbound** — `send_wa_message` MUST check `hotels.dnd` (cross-service read) BEFORE dispatch. If in DND and not VVIP-exempt and not inbound-trigger → queue for after DND end OR drop, per `exception_*` flags. Inbound messages NEVER blocked by DND.

**4.5 Quota gating on outbound** — RPC HC `check_and_reserve_outbound_quota(hotel_id)` BEFORE dispatch. If prepaid balance = 0 → 429. On success, RPC HC `commit_outbound_quota_increment(hotel_id, 1)` AFTER dispatch confirmation. This is a **two-phase** flow so HC's prepaid-balance meter reflects only actually-sent messages.

**4.6 Idempotent webhook ingest** — Meta retries on timeout. Use `webhook_events.id` + dedupe on `(provider, external_id)` for the message payload. Don't double-create tickets / messages.

**4.7 200 to Meta within 10s** — webhook handler MUST return 200 quickly even if downstream RPC fails. Persist raw payload to `webhook_events` immediately; process async via queue worker. Meta retries on 5xx OR on timeout.

**4.8 Health probe debouncing** — require 2 consecutive failures to mark `down`. Emit `integration:health_changed` on **transition only** (not every poll). Avoid alert spam.

**4.9 Retry policy correctness** — 3 attempts with exponential backoff (1s, 5s, 30s). After exhaustion → `status: 'failed'`. Quota / template-not-approved failures are PERMANENT — do NOT retry these.

**4.10 Cross-service write (Telegram per-dept)** — `PUT /api/integrations/telegram/departments/:dept_id` writes to HC's `departments` table. Either shared-DB (direct write) or RPC HC. Verify dept belongs to the session's hotel BEFORE write (cross-tenant attempt → 404).

**4.11 Internal RPC auth** — RPCs from HC / AI MUST authenticate via shared secret or mTLS, not session cookies. RPCs are SERVICE-TO-SERVICE, not user-bound. Document the auth scheme in repo's README.

---

## 5. Acceptance criteria (when Integration MVP is "done")

A test pass:

- [ ] **WA config CRUD** — `PUT /api/integrations/whatsapp { bsp: '1engage', phone_number_id, access_token, webhook_url }` succeeds. `GET` returns the config (with `access_token` MASKED in the response).
- [ ] **Verify webhook** — `POST /api/integrations/whatsapp/verify-webhook` pings the configured URL. Returns `200 { verified: true, verified_at }` on success, `422 WEBHOOK_VERIFICATION_FAILED` on failure.
- [ ] **WA inbound creates a ticket** — send a test WA message to the bot phone. Webhook fires; `webhook_events` row created; HC `upsert_guest_by_wa_phone` called; AI RPC fired; (in MVP, AI stubs return synthetic ticket creation); ticket appears in CRM via `GET /api/tickets`.
- [ ] **WA outbound dispatched** — from HC, RPC `send_wa_message(hotel_id, guest_id, "Test message")`. Dispatch enqueued; sent to WA Cloud API; receipt returned; `outbound_dispatch_queue` row shows `status: 'sent'`, `external_id` populated.
- [ ] **DND blocks outbound** — set hotel `dnd: { start: '23:00', end: '07:00' }`. RPC `send_wa_message` at 23:30 → dispatch deferred to 07:00 (or dropped per config).
- [ ] **Quota gates outbound** — set hotel prepaid balance to 1 total, 1 used (0 remaining). RPC `send_wa_message` → `429 RATE_LIMIT`. Top up balance → succeeds.
- [ ] **Telegram config CRUD** — `PUT /api/integrations/telegram { bot_token, bot_username }` succeeds.
- [ ] **Per-dept Telegram routing** — `PUT /api/integrations/telegram/departments/:dept_id { telegram_chat_id, supervisor_telegram_id }` writes to HC's `departments` table. Verify in HC: `GET /api/settings/departments/:id` returns the new values.
- [ ] **Telegram outbound (escalation)** — HC RPC `send_telegram_message(chat_id, "Escalation: ticket #...")`. Telegram bot posts to the chat.
- [ ] **Telegram inbound command** — staff sends `/take 1234` to bot → webhook fires → AI handover RPC (or HC ticket assign RPC) called. Verify ticket assignment in CRM.
- [ ] **OTA email parsed** — drop a test email into IMAP mailbox; cron poll picks it up; HC `create_pending_visit` RPC called; visit appears in CRM dashboard pending verification card.
- [ ] **QR regen + download** — `POST /api/integrations/qr/regenerate` returns `{ url, png_url, generated_at }`. `GET /api/integrations/qr/download` streams 1024×1024 PNG.
- [ ] **Health probe** — `GET /api/integrations/health` returns current snapshot. Manually disable WA cloud → after 2 polls (60s × 2 = 120s), status flips to `down`. `integration:health_changed` socket emit observed.
- [ ] **Retry on failure** — simulate WA Cloud 500 on first attempt. Verify dispatch retries 3 times then `status: 'failed'`.
- [ ] **Webhook idempotency** — fire the same Meta webhook payload twice (same `messages[0].id`). Verify only one ticket message persisted.
- [ ] **Signature rejection** — fire webhook with bad `X-Hub-Signature-256` → 401, no row in `webhook_events`.

---

## 6. How to verify against the FE

The FE has been running on MSW since H1. Once Integration MVP ships, the FE can flip `VITE_USE_MOCKS=false VITE_API_BASE_URL=<hotel-core-backend> VITE_INTEGRATION_API_BASE_URL=<integration-backend>` (or single-domain reverse-proxy — Integration owns `/api/integrations/*` paths) and exercise:

**Pages that should work after Integration MVP**:

- `/settings/integrations` (full CRUD + verify-webhook + QR regen/download + health badge)
- `/tickets` (auto-populated by inbound WA flow once AI is also up; in MVP, you can test with a synthetic AI stub)
- TopBar health badge (poll every 60s)
- Daily brief Telegram delivery (visible in the Telegram group)
- Escalation Telegram pings (visible in dept Telegram group)

**Pages that will still 404 fully wired** until AI ships:

- AI handover banner on ticket detail (AI service)
- AI-classified `complaint_type` on inbound tickets (AI service)

The FE MSW handlers (`src/mocks/handlers/integrations.handlers.ts`) are the authoritative shape reference. Match exactly.

---

## 7. Hand-off checklist (when this slice is ready for FE integration)

- [ ] All endpoints in §1 implemented per `04-integration-channels.md` shapes.
- [ ] Prisma migrations applied. (Auth + HC live in shared DB or sibling DB per choice; Integration has its own DB or joins shared — confirm via Q-OPS-06.)
- [ ] Encryption-at-rest key configured in env; all sensitive fields encrypted.
- [ ] Webhook signature verification verified on both ingress endpoints.
- [ ] Tenant guard on all `/api/integrations/*` endpoints.
- [ ] Internal RPC auth scheme documented + verified.
- [ ] Outbound dispatch retry + DND + quota verified via tests.
- [ ] Health probe + debounce verified.
- [ ] BSP adapter interface in place (even if only `1engage` impl exists).
- [ ] OTA email poller cron configured per hotel.
- [ ] Socket emits to gateway wired (`integration:health_changed`).
- [ ] `shared/open-questions.md` ratifications for Q-CONTRACT-07 + Q-CONTRACT-25 + Q-OPS-04 + Q-OPS-05 + Q-OPS-06.

Once these are green, the FE integration window opens — flip `VITE_USE_MOCKS=false`.

---

## 8. Reading order for the implementing engineer

If you're picking this up fresh:

1. **`README.md`** (this folder) — §2 cross-service contracts.
2. **`MVP-AUTH-FIRST.md`** — Auth must be up so `:hotel_slug` lookup + tier-gating work.
3. **`MVP-HOTEL-CORE-FIRST.md`** — HC must be up so quota RPC + guest upsert RPC + departments write-through work.
4. **This file** — for the scope + AC.
5. **`04-integration-channels.md`** — full Integration surface with DDL + retry + RBAC + RPC catalog.
6. **`docs/API-CONTRACT.md`** §2.7 — canonical contract; FE's MSW is built against this.
7. **`shared/data-model.md`** — table ownership matrix + cross-service rules.
8. **`shared/open-questions.md`** — Q-CONTRACT-07 + Q-25 + Q-OPS-03/04/05/06.
9. **`src/mocks/handlers/integrations.handlers.ts`** in FE repo — the literal shape reference.

---

## 9. Slot routing recap

| Slot       | Owner   | Deliverables in this MVP                                                                                              |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| A (Nathan) | Nathan  | F1–F8 foundation                                                                                                      |
| B (Nanak)  | Nanak   | B1–B8 WA + outbound dispatch                                                                                          |
| C (Satrio) | Satrio  | C1–C9 Telegram + OTA + QR + health                                                                                    |

A ships first (~1 week). B and C run in parallel (~2 weeks).
