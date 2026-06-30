# Service Charter — Integration / Channels

- **Status**: accepted
- **Tanggal**: 2026-06-29 (bootstrap from core-backend infra; scope per H12 PO ruling)
- **Ratified by**: [ADR-0008](./decisions/0008-repo-scope-integration.md)
- **Authoritative spec**: [`docs/spec/04-integration-channels.md`](./spec/04-integration-channels.md) + [`docs/spec/MVP-INTEGRATION-FIRST.md`](./spec/MVP-INTEGRATION-FIRST.md)

## 1. Bounded context

Repo ini = service **Integration / Channels**. Every conversation with the outside world goes through here.

### Owns

- **Integration config CRUD** (NEW H12): `wa_configs`, `telegram_configs`, `qr_state` (per-hotel)
- **`/api/integrations/*` surface**: config CRUD + action endpoints (`verify-webhook`, `qr/regenerate`, `qr/download`, `health`)
- **Webhook ingress**: `POST /webhook/whatsapp/:hotel_slug`, `POST /webhook/telegram/:hotel_slug` (no session; signature-verified)
- **Outbound dispatch** (WA + Telegram): DND + quota gating (via HC RPC), retry queue, delivery receipts
- **WA template Meta relay**: relay submit/resubmit/status-callback for `wa_templates` table (HC-owned)
- **OTA email parser**: IMAP poller, parser pipeline, create-pending-visit RPC to HC
- **QR generation**: 1024×1024 PNG, object storage upload
- **Channel health probes**: 60s polling, debounced down-detection, `channel_health_snapshots` history
- **Internal RPC surface**: `send_wa_message`, `send_telegram_message`, `submit_wa_template_to_meta`, `resubmit_wa_template_to_meta`

### Does NOT own (sibling services — separate repos)

| Sibling                            | Owns                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| **Auth / Identity** (01)           | Users, sessions, JWT, hotels (tenant), tiers, admin user CRUD, DND config on hotels        |
| **Hotel Core (CRM)** (02)          | Tickets, guests, visits, departments, menu, KB, WA templates **table** (lifecycle CRUD), billing meter, notifications, analytics, agents config |
| **AI Orchestration** (03)          | Agent prompts, orchestrator, conversations, KB retrieval                                   |

> **Repo names**: `auth-backend-qooma-hotel-ai` (live), `core-backend-qooma-hotel-ai` (live), `integration-backend-qooma-hotel-ai` (this repo), AI repo TBD.

## 2. Cross-service contracts

- **Tenant rule**: every multi-tenant table carries `hotel_id`. For non-webhook routes, derived from session. For webhook routes (`/webhook/*`), derived from `:hotel_slug` lookup against Auth's `hotels.code` (cached LRU 5-min).
- **Shared DB topology** (Q-OPS-06 H12 ratification — MVP default): Auth + HC + Integration co-locate in one Postgres. Integration CAN have real FKs to Auth's `hotels` and CAN read HC's `departments` / `billing_quotas` directly via cross-table SELECT. AI runs in own DB.
- **DND read**: Integration reads `hotels.dnd` (Auth-owned) on every outbound dispatch. Cross-table SELECT, no RPC.
- **Quota two-phase**: Integration RPCs HC `check_and_reserve_outbound_quota(hotel_id)` BEFORE dispatch, then `commit_outbound_quota_increment(hotel_id, 1)` AFTER confirmation. HC's meter increments only on confirmed sends.
- **Telegram per-dept write-through** (NEW H12): `PUT /api/integrations/telegram/departments/:dept_id` writes `telegram_chat_id` + `supervisor_telegram_id` to HC's `departments` table. Shared-DB direct write (MVP); RPC option later (Q-OPS-06).
- **WA template Meta callback**: when Meta webhooks back template `approved` / `rejected`, Integration calls HC internal `updateWaTemplateStatus(template_id, status, rejection_reason?)`.
- **AI handoff**: Integration RPCs AI `inbound_wa_message(guest_id, body, hotel_id)` after WA webhook signature-verified + raw-payload-persisted. AI takes over (may create ticket via HC, may reply via Integration outbound).

## 3. Slot routing (supersedes KICKOFF.md §1 defaults)

| Slot       | Owner   | Default scope (PO can override per task)                                                                                                                              |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A (Nathan) | Nathan  | **Foundation** — Prisma schema + initial migration, encryption-at-rest helper (KMS / libsodium for tokens), webhook signature-verification middleware (Meta + Telegram), tenant resolution from `:hotel_slug` (cached), BSP adapter interface (`1engage` impl + ABI), queue + scheduler infra, internal RPC server (HTTP/mTLS) |
| B (Nanak)  | Nanak   | **WA + outbound dispatch** — `wa_configs` CRUD, `verify-webhook`, WA inbound webhook ingest (signature-verify → persist → guest upsert RPC to HC → AI RPC), outbound dispatch (DND check + quota RPC + retry queue), delivery receipts, WA template Meta relay (submit/resubmit/callback) |
| C (Satrio) | Satrio  | **Telegram + OTA + QR + health** — `telegram_configs` CRUD, per-dept Telegram routing write-through to HC, Telegram inbound webhook + commands (`/take`, `/release`, `/done`, `/help`), Telegram outbound dispatch, OTA email IMAP poller + parser, QR generation + download, channel health probes + snapshots, `integration:health_changed` socket emits |

A ships first (~1 week). B and C run in parallel (~2 weeks).

## 4. Open contract questions

Source of truth: [`docs/spec/open-questions.md`](./spec/open-questions.md). Integration-relevant subset:

- **Q-CONTRACT-07** (reassigned H12) — Integrations endpoints — config CRUD + action endpoint shapes
- **Q-CONTRACT-25** (NEW H12) — Cross-service write for per-dept Telegram (shared DB vs RPC)
- **Q-OPS-03** RESOLVED H12 — outbound dispatch owned here
- **Q-OPS-04** — BSP abstraction (recommend ABI even if only `1engage` impl in MVP)
- **Q-OPS-05** — OTA raw email blob retention (recommend yes; object storage)
- **Q-OPS-06** NEW H12 — shared DB vs RPC for cross-service writes (recommend shared DB for MVP)

## 5. Out-of-scope-by-design

- Identity / hotels / tiers / admin users → Auth's job
- Tickets / guests / visits / menu / KB / billing meter logic → HC's job
- Prompt engineering / Claude API / conversation state → AI's job
- Multi-BSP runtime support (`1engage` only in MVP; ABI in place for future swaps)
- PMS direct API integration (Enterprise tier, post-MVP)
- Voice / SIP / PBX integration (wave 2a per ADD-23)
