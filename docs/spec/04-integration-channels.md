# Service 04 — Integration / Channels

> **Bounded context**: every conversation with the outside world. WhatsApp Cloud API, Telegram Bot, OTA email parsers, QR provisioning, webhook ingress, retry queues, channel health, **plus integration config CRUD** (per H12 PO ruling 2026-06-29 — moved here from Hotel Core).
>
> **Owns**: integration **config CRUD** (`/api/integrations/whatsapp`, `/api/integrations/telegram`, per-dept Telegram routing), outbound dispatch (WA + Telegram), inbound webhook receivers, third-party rate-limit handling, retry/dead-letter queues, channel health probes, QR PNG generation, OTA email polling, action endpoints (verify-webhook, regenerate-QR, health).
>
> **Does NOT own**: conversation state (AI), ticket records (Hotel Core), WA template approval CRUD (Hotel Core owns the `wa_templates` table; this service relays submit/resubmit to Meta on Hotel Core's behalf and updates status via internal callback), `departments.telegram_chat_id` / `supervisor_telegram_id` (HC-owned columns; Integration reads them on dispatch).

---

## 1. Why this is a separate service

- **Webhook ingress is bursty and external** — WA/Telegram can hit you with bursts; isolate from CRM request loop.
- **Third-party rate limits** — WA Cloud API has per-template-per-hour quotas. Need centralized governance + retry queue. Hotel Core shouldn't be aware of Meta's quota state machine.
- **Outbound quota meter** — every WA outbound counts against per-hotel monthly quota. Centralizing dispatch makes the meter trivial (Integration RPCs Hotel Core's billing module to increment).
- **Operational shape** — long-running webhook listeners + queues differ from CRUD request/response. Different scaling needs.
- **Single owner per channel** — per H12 ruling, owning both config CRUD AND dispatch logic in one service means no cross-service round-trip for "what's my access token?" lookups. Hotel Core stays focused on CRM ops.

---

## 2. Endpoints

### 2.1 Config CRUD (API-CONTRACT §2.7 — H12 moved here)

| Method     | Path                                                  | Purpose                                                       | Roles      |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------- | ---------- |
| `GET`      | `/api/integrations`                                   | Full integration overview (whatsapp + telegram + qr + health) | `gm_admin` |
| `GET, PUT` | `/api/integrations/whatsapp`                          | WA Cloud config (BSP, phone_number_id, access_token, webhook_url) | `gm_admin` |
| `GET, PUT` | `/api/integrations/telegram`                          | Telegram bot config (bot_token, bot_username, default_chat_id) | `gm_admin` |
| `PUT`      | `/api/integrations/telegram/departments/:dept_id`     | Per-dept Telegram routing (telegram_chat_id, supervisor_telegram_id) — writes through to HC's `departments` table | `gm_admin` |

**Cross-service write detail** (`PUT /api/integrations/telegram/departments/:dept_id`):

This endpoint accepts Telegram routing fields and persists them to Hotel Core's `departments` table (since `telegram_chat_id` + `supervisor_telegram_id` are HC-owned columns on `departments`). Two implementation options:

- **Shared DB**: this service writes directly to `departments` via the same Postgres connection. Simple; requires shared-DB topology (per `shared/data-model.md` §1 Auth+HC live in shared DB — Integration can join too if you choose).
- **Separate DB + RPC**: this service RPCs Hotel Core's internal `updateDepartmentTelegram(dept_id, fields)` endpoint. Cleaner separation; one extra hop.

FE doesn't care which you pick. Pick based on infra preference; document in `shared/open-questions.md` Q-OPS-06.

### 2.2 Action endpoints (API-CONTRACT §2.7)

| Method | Path                                        | Purpose                                                  | Roles      |
| ------ | ------------------------------------------- | -------------------------------------------------------- | ---------- |
| `POST` | `/api/integrations/whatsapp/verify-webhook` | Server pings configured webhook URL to confirm reachable | `gm_admin` |
| `POST` | `/api/integrations/qr/regenerate`           | Generate new QR PNG, returns URL + download path         | `gm_admin` |
| `GET`  | `/api/integrations/qr/download`             | Stream QR PNG (1024×1024 high-res)                       | `gm_admin` |
| `GET`  | `/api/integrations/health`                  | Snapshot of Claude API + WA + Telegram status            | `gm_admin` |

`/api/integrations/health` response (polled by FE every 60s):

```json
{
  "claude_api": {
    "status": "healthy",
    "last_check_at": "...",
    "uptime_30d": 99.7,
    "avg_response_ms": 1284
  },
  "whatsapp": { "status": "healthy", "last_message_at": "..." },
  "telegram": { "status": "healthy", "last_message_at": "..." }
}
```

`status ∈ 'healthy' | 'degraded' | 'down'`.

### 2.3 Webhook ingress (NOT FE-exposed)

These endpoints receive callbacks from third parties. FE never calls them.

| Method | Path                            | Purpose                                                                       |
| ------ | ------------------------------- | ----------------------------------------------------------------------------- |
| `POST` | `/webhook/whatsapp/:hotel_slug` | WA Cloud API → inbound messages + delivery receipts + template status updates |
| `POST` | `/webhook/telegram/:hotel_slug` | Telegram bot → staff commands, message reception                              |
| (poll) | OTA email mailbox (IMAP)        | No webhook; poll periodically                                                 |

**Hotel routing**: `:hotel_slug` in the URL maps to `hotel_id` via lookup against Auth's `hotels.code` (cache the slug→id map for speed). Validate the webhook signature (Meta sends `X-Hub-Signature-256`; Telegram has its own scheme).

### 2.4 Internal RPC surface (called by other services)

Transport: HTTP + `X-Internal-Secret` header (shared secret, `timingSafeEqual`). Path convention: `/internal/<domain>/<action>`. See T09 (internal-rpc-auth plugin) + ADR-0009.

| RPC                                            | Caller     | Purpose                                                              |
| ---------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| `POST /internal/wa/dispatch`                   | Hotel Core | Dispatch outbound WA (text or template). **Caller (HC) MUST run DND + quota check BEFORE calling** — Integration does NOT gate (ADR-0009). Body: `{ hotel_id, wa_config_id?, guest_id, guest_wa_phone, body?, template_ref?, template_variables?, correlation_id }`. Default `wa_config_id` = hotel's primary config (schema 1:1 for now, forward-compat multi-number). |
| `POST /internal/wa/conversations.list`         | Hotel Core | List conversations per hotel dgn cursor pagination. Body: `{ hotel_id, cursor?, limit? }` → `{ items: [...], next_cursor? }`. ADR-0010 storage. |
| `POST /internal/wa/messages.list`              | Hotel Core | List messages per conversation, cursor-paginated chronological. Body: `{ hotel_id, conversation_id, cursor?, limit? }` → `{ items: [...], next_cursor? }`. ADR-0010 storage. |
| `POST /internal/telegram/dispatch`             | Hotel Core (escalation worker) | Dispatch escalation pings to dept staff + L2 (`chat_id`, `body`, `parse_mode?`) |
| `POST /internal/wa-templates/submit`           | Hotel Core | Relay POST `/api/wa-templates` to Meta (`template_id` → returns Meta ref) |
| `POST /internal/wa-templates/resubmit`         | Hotel Core | Relay `/resubmit` after edit |

These are internal — never exposed to FE. CRM staff-triggered send + inbox read go via Hotel Core public API, which calls these RPCs.

**Superseded**: `send_wa_message(...)` / `send_telegram_message(...)` bare-function signatures dari revisi sebelumnya di-replace dgn HTTP RPC paths di atas per ADR-0009. Semantik payload sama, transport eksplisit.

---

## 3. Channels — per-provider notes

### 3.1 WhatsApp Cloud API (via BSP, currently `1engage`)

**Outbound flow** (CRM → Hotel Core public API → this service internal RPC → WA Cloud → guest) — per ADR-0009 boundary:

1. CRM calls Hotel Core public API (`POST /api/hotels/:slug/wa-messages` or equivalent — HC-owned).
2. **Hotel Core** (business layer, NOT Integration) performs:
   - DND check against hotel's `dnd` policy (`hotels.dnd` in Auth) — VVIP-exempt + inbound-trigger flags.
   - Outbound quota check + reserve (2-phase).
   - Audit: which staff triggered send.
3. Hotel Core calls `POST /internal/wa/dispatch` at this service with `{ hotel_id, wa_config_id?, guest_id, guest_wa_phone, body?, template_ref?, template_variables?, correlation_id }`.
4. This service:
   - Looks up WA config from `wa_configs` (BSP, access_token decrypted, phone_number).
   - Picks template (if `template_ref`) or sends raw text (if `body`).
   - Persists row to `outbound_dispatch_queue` (pending).
   - Persists row to `messages` (`direction=outbound`, `status=pending`) per ADR-0010.
   - Dispatches to WA Cloud API via BSP adapter.
   - On BSP ack: mark `outbound_dispatch_queue` sent + update `messages.status=sent` + `external_message_id`.
   - Reports outcome to caller (HC) — HC commits quota / rollback per its own state.
5. **Delivery receipt path** (Meta → us webhook `POST /webhook/whatsapp/:hotel_slug`): T15 pipeline updates `messages.status` via `external_message_id` join.

**DND + quota are NOT enforced by Integration** — Integration trusts caller (HC) already checked. T13 primitive's DND/quota ports retain as no-op passthrough for backward compat; Q-B-08 + Q-B-09 closed from Integration perspective.

**Template approval flow**: CRUD endpoints in Hotel Core (`/api/wa-templates/*` per `02-hotel-core.md` §1.9). **Submit / resubmit relay handlers here**: on Hotel Core POST, Hotel Core RPCs this service which relays to Meta. Update template status via internal callback to HC when Meta webhooks back (`template:approved` / `template:rejected`).

**Inbound flow**:

1. Meta hits `POST /webhook/whatsapp/:hotel_slug` with `{ messages: [...] }`.
2. Verify signature (`X-Hub-Signature-256`).
3. Persist raw payload to `webhook_events` (audit).
4. For each message: identify or create guest (by WA phone) — RPC Hotel Core's `upsert_guest_by_wa_phone(hotel_id, wa_phone, name?)` → returns `guest_id`.
5. Upsert `conversations` (by `hotel_id + guest_wa_phone`) + insert `messages` (`direction=inbound`, `status=received`) per ADR-0010. Link `webhook_event_id` FK.
6. RPC AI service: `inbound_wa_message(guest_id, body, hotel_id)`.
7. AI processes (may create ticket via Hotel Core, may reply via this service's outbound).
8. 200 to Meta within 10s (Meta retries on timeout).

### 3.2 Telegram Bot

**Outbound**: staff notifications (escalation, ticket assignment, daily brief PDF).

- Per-dept `telegram_chat_id` (HC-owned column) for group routing.
- `supervisor_telegram_id` (HC-owned column) for L2 escalation.
- `gm_telegram_id` for L3 + high-alert.

**Inbound**: staff commands (`/take 1234`, `/release 1234`, `/done 1234`, `/help`). Route via Telegram webhook → identify the staff Telegram user → RPC AI service (for handover) or Hotel Core (for ticket status update).

**Per-dept config update**: `PUT /api/integrations/telegram/departments/:dept_id { telegram_chat_id, supervisor_telegram_id }`. Per §2.1 cross-service write detail — Integration writes through to HC's `departments` table.

### 3.3 OTA email parser

**No webhook** — poll a configured IMAP mailbox per hotel (cron). Per-hotel email account that OTAs (Booking.com, Agoda, etc.) send reservation confirmations to.

**Parser pipeline**:

1. Cron triggers every N minutes per hotel mailbox.
2. Fetch unread emails.
3. Match against per-OTA templates (Booking.com confirmation format, Agoda format, etc.).
4. Extract: guest_name, check_in_date, check_out_date, room_number, booking_source.
5. RPC Hotel Core to create `Visit { status: 'pending_verification' }`. Hotel Core emits `verification:pending`.
6. Mark email as processed.

**Failure mode**: unrecognized format → log + skip (don't crash poll loop). Optionally surface in an admin queue for manual triage.

**Wave 1 scope**: email parsing only. Direct OTA API integration (Booking.com Reservation API, Agoda XML, etc.) is **OUT of MVP** per CLAUDE.md §11.5.

### 3.4 QR code generation

`POST /api/integrations/qr/regenerate`:

1. Generate `wa.me/<phone>?text=<greeting>` URL.
2. Render as 1024×1024 PNG (`qrcode` lib or equivalent).
3. Upload to object storage.
4. Persist URL + generated_at on the hotel's `qr_state` row (this service's table — see §4).
5. Return `{ url, png_url, generated_at }`.

`GET /api/integrations/qr/download`: stream the latest PNG (server-side fetch from storage, no FE redirect).

### 3.5 PMS direct integration

**OUT of MVP** per CLAUDE.md §11.5. Enterprise tier only, post-wave-1. Don't build UI hooks for it.

---

## 4. Data model (this service owns) — DDL

Conventions per `shared/data-model.md` §5: UUID PKs via `gen_random_uuid()`, TIMESTAMPTZ, JSONB for sub-objects, `(hotel_id)` index on every multi-tenant table.

> **Standing rule**: every table below carries `hotel_id UUID NOT NULL` and has a `(hotel_id)` index. Webhook public endpoints (no session) derive `hotel_id` from `:hotel_slug` lookup. All other endpoints derive from session.

### 4.1 `wa_configs`

```sql
CREATE TABLE wa_configs (
  hotel_id            UUID PRIMARY KEY,                                -- one config per hotel; FK opaque if separate DB
  bsp                 VARCHAR(40) NOT NULL DEFAULT '1engage',
  phone_number_id     VARCHAR(80) NOT NULL,
  phone_number        VARCHAR(20) NOT NULL,                            -- display phone (E.164)
  access_token_enc    TEXT NOT NULL,                                   -- encrypted at rest
  webhook_url         VARCHAR(500) NOT NULL,
  webhook_verify_token VARCHAR(80) NOT NULL,
  verified_at         TIMESTAMPTZ NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wa_configs_hotel ON wa_configs(hotel_id);
```

### 4.2 `telegram_configs`

```sql
CREATE TABLE telegram_configs (
  hotel_id            UUID PRIMARY KEY,
  bot_token_enc       TEXT NOT NULL,                                   -- encrypted at rest
  bot_username        VARCHAR(40) NOT NULL,                            -- 'qooma_demo_bot'
  default_chat_id     VARCHAR(64) NULL,                                -- fallback group
  gm_telegram_id      VARCHAR(64) NULL,                                -- L3 escalation
  webhook_url         VARCHAR(500) NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_telegram_configs_hotel ON telegram_configs(hotel_id);
```

### 4.3 `qr_state`

```sql
CREATE TABLE qr_state (
  hotel_id           UUID PRIMARY KEY,
  wa_link            VARCHAR(500) NOT NULL,                            -- 'wa.me/<phone>?text=...'
  png_url            VARCHAR(500) NOT NULL,                            -- object storage URL
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.4 `webhook_events` (raw audit log)

```sql
CREATE TABLE webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID NOT NULL,
  provider        VARCHAR(20) NOT NULL,        -- 'whatsapp' | 'telegram'
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature_valid BOOLEAN NOT NULL,
  payload         JSONB NOT NULL,
  processed_at    TIMESTAMPTZ NULL,
  process_error   JSONB NULL,
  CONSTRAINT webhook_events_provider_check CHECK (provider IN ('whatsapp','telegram'))
);
CREATE INDEX idx_webhook_events_hotel ON webhook_events(hotel_id, received_at DESC);
CREATE INDEX idx_webhook_events_unprocessed ON webhook_events(hotel_id, received_at) WHERE processed_at IS NULL;
```

### 4.5 `outbound_dispatch_queue`

```sql
CREATE TABLE outbound_dispatch_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID NOT NULL,
  provider        VARCHAR(20) NOT NULL,        -- 'whatsapp' | 'telegram'
  guest_id        UUID NULL,                    -- NULL for telegram dispatches
  template_name   VARCHAR(80) NULL,
  body            TEXT NULL,
  variables       JSONB NULL,
  scheduled_for   TIMESTAMPTZ NOT NULL DEFAULT NOW(),                  -- DND deferral support
  attempts        INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  sent_at         TIMESTAMPTZ NULL,
  external_id     VARCHAR(80) NULL,                                    -- WA message ID for receipt correlation
  last_error      JSONB NULL,
  CONSTRAINT outbound_status_check CHECK (status IN ('pending','sent','failed','dead'))
);
CREATE INDEX idx_outbound_hotel ON outbound_dispatch_queue(hotel_id, scheduled_for);
CREATE INDEX idx_outbound_pending ON outbound_dispatch_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_outbound_external ON outbound_dispatch_queue(external_id) WHERE external_id IS NOT NULL;
```

### 4.6 `delivery_receipts`

```sql
CREATE TABLE delivery_receipts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID NOT NULL,
  dispatch_id     UUID NOT NULL REFERENCES outbound_dispatch_queue(id) ON DELETE CASCADE,
  external_id     VARCHAR(80) NOT NULL,
  status          VARCHAR(20) NOT NULL,        -- 'sent' | 'delivered' | 'read' | 'failed'
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT delivery_receipts_status_check CHECK (status IN ('sent','delivered','read','failed'))
);
CREATE INDEX idx_delivery_receipts_hotel ON delivery_receipts(hotel_id);
CREATE INDEX idx_delivery_receipts_dispatch ON delivery_receipts(dispatch_id);
```

### 4.7 `channel_health_snapshots`

```sql
CREATE TABLE channel_health_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID NOT NULL,
  provider        VARCHAR(20) NOT NULL,        -- 'whatsapp' | 'telegram' | 'claude_api'
  status          VARCHAR(20) NOT NULL,        -- 'healthy' | 'degraded' | 'down'
  latency_ms      INTEGER NULL,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT channel_health_status_check CHECK (status IN ('healthy','degraded','down')),
  CONSTRAINT channel_health_provider_check CHECK (provider IN ('whatsapp','telegram','claude_api'))
);
CREATE INDEX idx_channel_health_hotel_provider ON channel_health_snapshots(hotel_id, provider, checked_at DESC);
```

### 4.8 `ota_mailbox_state`

```sql
CREATE TABLE ota_mailbox_state (
  hotel_id          UUID PRIMARY KEY,
  imap_host         VARCHAR(255) NOT NULL,
  imap_username     VARCHAR(255) NOT NULL,
  imap_password_enc TEXT NOT NULL,
  last_poll_at      TIMESTAMPTZ NULL,
  last_uid_seen     INTEGER NULL,
  poll_error        JSONB NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true
);
```

### 4.9 Cross-service reference summary

- **To Auth (opaque or shared-DB join)**: `hotel_id` → `hotels(id)` if shared DB, else opaque. Webhook `:hotel_slug` → Auth's `hotels.code` lookup (cache).
- **To Hotel Core (opaque or shared-DB join)**: reads `departments.telegram_chat_id` + `supervisor_telegram_id` + `dnd` on dispatch. Writes back via `PUT /api/integrations/telegram/departments/:dept_id` (per §2.1).
- **To AI (opaque)**: RPC only — `inbound_wa_message(guest_id, body, hotel_id)`. No DB FK.

---

## 5. Socket events

Emitted via gateway:

| Event                                                                       | When                                                           |
| --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `integration:health_changed`                                                | Health snapshot transitions to/from `healthy` for any provider |
| (no direct ticket/conversation emits — those route through Hotel Core / AI) |

---

## 6. External dependencies

| Dependency                                                   | Purpose                                              | Notes                                                            |
| ------------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------- |
| **WhatsApp Cloud API** (via BSP)                             | WA outbound + inbound                                | Current BSP: `1engage`. Access token, phone number ID per hotel. |
| **Telegram Bot API**                                         | Telegram bot                                         | Bot token per hotel; bot username displayed in CRM.              |
| **IMAP / POP3**                                              | OTA email polling                                    | Per-hotel mailbox credentials.                                   |
| **Object storage** (S3 / R2)                                 | QR PNG upload                                        | Shared with Hotel Core for asset storage.                        |
| **QR code lib** (`qrcode` npm or backend equivalent)         | PNG generation                                       | FE also has `qrcode` for preview rendering (see T53).            |
| **Queue / scheduler** (BullMQ / Celery / Sidekiq / whatever) | Outbound dispatch retries, DND deferral, OTA polling | Backend choice.                                                  |
| **Encryption-at-rest helper**                                | Encrypt `access_token`, `bot_token`, `imap_password` | KMS-backed or libsodium                                          |

---

## 7. Retry strategy

**Outbound dispatch**:

- 3 retries with exponential backoff (1s, 5s, 30s).
- After 3 attempts → `status: 'failed'`, log to `outbound_dispatch_queue.last_error`. Optionally also `status: 'dead'` after stale period.
- Failures from quota / template-not-approved are **NOT retried** — they're permanent for the moment.

**Webhook ingress**:

- Respond 200 quickly even if downstream RPC fails — store raw payload, process async.
- If processing fails, retry from `webhook_events` queue.

**Health probes**:

- Poll Claude API, WA Cloud API, Telegram getMe every 60s per hotel.
- Smooth transitions: require 2 consecutive failures to mark `down` (avoid flapping). Emit `integration:health_changed` on transition only.

---

## 8. RBAC & tenancy

- Public webhook endpoints (`/webhook/whatsapp/:hotel_slug`, `/webhook/telegram/:hotel_slug`) have NO Auth session — secured via signature verification + `hotel_slug` URL mapping.
- Config CRUD + action endpoints (`verify-webhook`, `qr/regenerate`, `qr/download`, `health`) require `gm_admin` session (super_admin all-access applies).
- `dept_head` does NOT access `/api/integrations/*` (no UI in CRM beyond what GM sees).
- Tenant guard: webhook ingress derives `hotel_id` from `:hotel_slug` lookup; everything else from session.

---

## 9. Error catalog (Integration-specific)

| HTTP | code                            | When                                                                |
| ---- | ------------------------------- | ------------------------------------------------------------------- |
| 422  | `WEBHOOK_VERIFICATION_FAILED`   | Verify-webhook test ping failed                                     |
| 422  | `WA_CONFIG_INVALID`             | Missing required WA config fields                                   |
| 422  | `TELEGRAM_CONFIG_INVALID`       | Missing bot token or username                                       |
| 422  | `DND_BLOCK`                     | Outbound refused due to DND window (returned on internal RPC only)  |
| 429  | `RATE_LIMIT`                    | Outbound quota at 100% for the month                                |
| 502  | `THIRD_PARTY_UNREACHABLE`       | Upstream (Meta / Telegram / Claude API) failed                      |
| 503  | `CHANNEL_DEGRADED`              | Best-effort response when health is `degraded`                      |

---

## 10. Open questions

See `shared/open-questions.md`:

- **Q-CONTRACT-07** — Integrations endpoints — ratify the config CRUD + action endpoint shapes (now Integration-owned).
- **Q-CONTRACT-25** (NEW H12) — Cross-service write for `PUT /api/integrations/telegram/departments/:dept_id` (shared DB vs RPC).
- **Q-OPS-03**: should outbound dispatch live in Integration or be Hotel Core's worker that calls Integration's adapter? **Resolved H12: lives in Integration.**
- **Q-OPS-04**: BSP abstraction — code against `1engage` directly, or build a BSP-agnostic interface for future swap? (Backend's call.)
- **Q-OPS-05**: OTA email parsing — store raw email blob for re-parse if format drifts?
- **Q-OPS-06** (NEW H12): Shared-DB vs RPC for HC-owned column writes from Integration (`departments.telegram_chat_id` etc.).

---

## 11. Slot routing (3 devs — Nathan / Nanak / Satrio)

Mirrors core-backend convention. Integration repo is bootstrapped at `integration-backend-qooma-hotel-ai/`.

| Slot       | Owner   | Scope                                                                                                                                |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| A (Nathan) | Nathan  | **Foundation** — Prisma schema + initial migration, encryption-at-rest helper, signature-verification middleware, tenant-guard for webhook routes, BSP adapter interface, queue + scheduler infra |
| B (Nanak)  | Nanak   | **WA + outbound dispatch** — `wa_configs` CRUD, `verify-webhook`, outbound dispatch (DND + quota RPC + retry), WA inbound webhook ingest, template relay (submit/resubmit/status-callback), delivery receipts |
| C (Satrio) | Satrio  | **Telegram + OTA + QR + health** — `telegram_configs` CRUD, per-dept Telegram write-through, Telegram inbound webhook + commands, OTA email parser, QR generation + download, channel health probes + snapshots |

A ships first (1 week). B and C run in parallel (2 weeks).

---

## 12. Phase 1 MSW reference

| What                   | File                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Handlers               | `src/mocks/handlers/integrations.handlers.ts`                                        |
| Fixtures               | `src/mocks/fixtures/integrations.ts`                                                 |
| FE service             | `src/services/integrations.api.ts`                                                   |
| Integrations page      | `src/pages/_auth/settings/integrations.tsx` + `src/features/settings/integrations/*` |
| Health badge component | grep `HealthBadge` in `src/components/common/`                                       |

FE polls `/api/integrations/health` every 60s and toasts destructive on `down` transitions. Make sure your `down` detection is debounced (2 consecutive failures) so users don't get spammed by transient blips.
