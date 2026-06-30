# ADR-0008: Repo scope = Integration / Channels service

- **Status**: accepted
- **Tanggal**: 2026-06-29 (bootstrap from core-backend infra; scope per H12 PO ruling)
- **Pengambil keputusan**: PO + Planning agent
- **Authoritative spec**: [`docs/spec/04-integration-channels.md`](../spec/04-integration-channels.md) + [`docs/spec/MVP-INTEGRATION-FIRST.md`](../spec/MVP-INTEGRATION-FIRST.md)

## Konteks

Setelah `auth-backend-qooma-hotel-ai` (Auth, H11) dan `core-backend-qooma-hotel-ai` (Hotel Core, H12 trim) live, sibling ke-3 di backend MVP = **Integration / Channels**. H12 PO ruling 2026-06-29 menetapkan:

- Semua `/api/integrations/*` surface (config CRUD + actions) MOVE dari Hotel Core ke Integration repo (sebelumnya Hotel Core memegang config CRUD; Integration hanya actions).
- Outbound dispatch (WA + Telegram) OWNED by Integration (Q-OPS-03 resolved).
- Cross-service write untuk per-dept Telegram routing (`PUT /api/integrations/telegram/departments/:dept_id`) persists ke HC's `departments` table — shared DB direct write recommended untuk MVP (Q-OPS-06).

Repo ini di-bootstrap dari `core-backend-qooma-hotel-ai` via `rsync` (excluded `.git`, `node_modules`, `prisma/migrations`, `.env`, `dist`) supaya boilerplate / ADR-0001..0007 / Makefile / Dockerfile / CI workflows / EXECUTOR-PROTOCOL.md / PM-AGENT.md tetap konsisten.

## Opsi yang dipertimbangkan

### Opsi A: Tetap dengan core-backend yang juga handle integration

- **Pros**: Satu repo, satu deploy
- **Cons**: Operational shape Integration sangat berbeda (webhook ingress, retry queues, third-party rate limits, signature verification) dari CRUD-heavy HC. Scaling needs berbeda. Pasangan kerja Nathan/Nanak/Satrio tidak bisa paralel proper di satu repo.

### Opsi B (pilihan): Integration di repo terpisah

- **Pros**: Single owner per bounded context. Webhook ingress + dispatch + queue terpisah dari CRM CRUD. Slot routing Nathan/Nanak/Satrio bisa dialokasi ulang di repo ini tanpa konflik dengan HC.
- **Cons**: 3 repo backend = 3 deploy pipeline (acceptable).

### Opsi C: Monorepo backend (Auth + HC + Integration in one)

- **Pros**: Tight integration, no cross-repo coord
- **Cons**: Off-spec ADR-0004 (1 service = 1 DB). Tidak diambil.

## Keputusan

**Opsi B.** Repo ini = service **Integration / Channels**.

### Scope (final, H12)

- Config CRUD: `wa_configs`, `telegram_configs`, `qr_state` (per-hotel)
- Action endpoints: `verify-webhook`, `qr/regenerate`, `qr/download`, `health`, `GET /api/integrations` overview
- Webhook ingress: `POST /webhook/whatsapp/:hotel_slug`, `POST /webhook/telegram/:hotel_slug`
- Outbound dispatch: WA + Telegram (with DND + quota gating via HC RPC)
- WA template Meta relay (HC owns `wa_templates` table; Integration relays)
- OTA email parser (IMAP poller → HC pending-visit RPC)
- Channel health probes + snapshots
- Internal RPC server (`send_wa_message`, `send_telegram_message`, etc.)

### Cross-service contracts (key bits)

- `hotel_id` columns FK to Auth's `hotels(id)` via shared DB (Q-OPS-06 MVP default). If you split DBs, change to opaque UUID.
- Quota two-phase RPC to HC (`check_and_reserve_outbound_quota` → `commit_outbound_quota_increment`).
- Per-dept Telegram write-through to HC's `departments` (shared DB direct write).
- WA template Meta callback via HC internal `updateWaTemplateStatus`.

## Konsekuensi

### Positif

- Webhook ingress isolated dari CRM CRUD (different scaling profile)
- Single owner per channel (no fragmented WA / Telegram handling)
- Encryption-at-rest discipline localized (sensitive token columns hanya di repo ini)
- BSP adapter ABI di satu tempat — siap untuk multi-BSP wave 2

### Negatif (yang kami terima)

- 3 backend repos = 3 deploy pipelines (Auth + HC + Integration), 3 PM trackers, 3 ADR-0001..0007 corpus
- Cross-service write coupling (Integration → HC departments) terselesaikan via shared-DB; bila scaling demands split, perlu migrate ke RPC pattern
- Operational coupling shared-DB Auth+HC+Integration; AI tetap own-DB

## Trigger untuk revisit

- Saat AI service launch & WA inbound flow stabil → consider merging Integration outbound retry queue dengan AI handover flow
- Saat operational coupling shared-DB jadi bottleneck → split DBs + migrate cross-service writes ke RPC
- Saat multi-BSP support diperlukan → activate ABI dengan adapter ke-2 (Twilio/Vonage/etc.)
