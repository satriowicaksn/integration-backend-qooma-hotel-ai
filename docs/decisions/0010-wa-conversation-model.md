# ADR-0010: WA conversation + message model (Integration owns storage, HC owns read API)

- **Status**: accepted
- **Tanggal**: 2026-07-08
- **Pengambil keputusan**: PO + Planning agent
- **Konteks teknis**: Feature request 2026-07-08 (CRM inbox view untuk WA); complements ADR-0009

## Konteks

Spec §04-integration-channels sebelumnya tidak mendefinisikan conversation / message storage. Data yang ada di Integration hanya:
- `webhook_events` — raw Meta payload JSON, 1 row per event (batch of messages dalam 1 event).
- `outbound_dispatch_queue` — 1 row per outbound attempt.

CRM butuh **inbox view**: list conversations per hotel (grouping by guest WA phone) + list messages per conversation (unified inbound + outbound, chronological, dgn read/unread state).

Data mentahnya sudah ada di Integration. Tiga alternatif storage/ownership:

## Opsi yang dipertimbangkan

### Opsi A: Derive on-the-fly dari `webhook_events` + `outbound_dispatch`
- Pros: No duplicate storage
- Cons: Join complex (payload JSON extraction), slow di scale, no index untuk `last_message_at` per guest, ordering harus di-compute setiap request

### Opsi B: Integration store dedicated `messages` + `conversations` tables, expose via internal RPC ke HC (pilihan)
- Pros: Data sudah ownership Integration (inbound + outbound sudah lewat sini), storage marginal, cursor pagination cepat, index-friendly
- Cons: Sedikit duplicate dgn raw `webhook_events` (raw tetap simpan untuk audit)

### Opsi C: HC store conversation state, Integration cuma emit event
- Pros: HC yang expose public read → align dgn ADR-0009 boundary
- Cons: Duplicate storage HC-side, event-driven sync fragile (event lost = HC state inconsistent), Integration tetap butuh simpan raw untuk audit → sama-sama duplicate

## Keputusan

Ratify **Opsi B**:

- **Storage owner**: Integration (`messages` + `conversations` tables) — data sudah passthrough di sini, marginal untuk simpan proper.
- **Read API**: internal RPC `POST /internal/wa/conversations.list` + `POST /internal/wa/messages.list`, dipanggil HC. HC expose public API `gm_admin` ke CRM. Konsisten dgn ADR-0009 boundary.
- **Raw `webhook_events` tetap ada**: sebagai audit log; `messages` = derived structured view.

### Data model MVP

**`conversations` (baru)**:

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` |
| hotel_id | UUID NOT NULL | index |
| wa_config_id | UUID NOT NULL FK → `wa_configs` | which config number |
| guest_wa_phone | VARCHAR(20) NOT NULL | E.164 |
| guest_id | UUID NULL | resolved via HC upsert; nullable saat first message |
| last_message_at | TIMESTAMPTZ NOT NULL | for sort |
| last_message_preview | TEXT NULL | max 200 char |
| unread_count | INT NOT NULL DEFAULT 0 | staff-side unread |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

- `UNIQUE (hotel_id, guest_wa_phone)` — 1 conversation per (hotel, phone).
- `INDEX (hotel_id, last_message_at DESC)` — inbox listing.

**`messages` (baru)**:

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` |
| conversation_id | UUID NOT NULL FK → `conversations` | cascade |
| direction | ENUM(`inbound`, `outbound`) | |
| body | TEXT NULL | text content; NULL untuk template-only |
| template_ref | VARCHAR(120) NULL | template name / id kalau outbound template |
| template_variables | JSONB NULL | untuk audit |
| external_message_id | VARCHAR(120) NULL | Meta `wamid.xxx` (inbound) atau BSP response id (outbound) |
| status | VARCHAR(20) NOT NULL | inbound → `received`; outbound → `pending`\|`sent`\|`delivered`\|`read`\|`failed` |
| received_at | TIMESTAMPTZ NULL | inbound only |
| sent_at | TIMESTAMPTZ NULL | outbound only |
| dispatch_id | UUID NULL FK → `outbound_dispatch_queue` | outbound linkage |
| webhook_event_id | UUID NULL FK → `webhook_events` | inbound linkage |
| created_at | TIMESTAMPTZ | |

- `INDEX (conversation_id, created_at DESC)` — messages-of-conversation.
- `INDEX (external_message_id) WHERE external_message_id IS NOT NULL` — for delivery receipt joins.

### Scope MVP (yang IN)

- Text messages (inbound + outbound).
- Template messages (outbound only; store `template_ref` + `template_variables`).
- Read: list conversations per hotel dgn cursor pagination (`last_message_at` cursor).
- Read: list messages per conversation dgn cursor pagination (`created_at` cursor).
- Delivery status update: T15 delivery receipts webhook update `messages.status` via `external_message_id` join.

### Scope MVP (yang OUT — phase 2)

- Attachment (image, doc, audio, video) — butuh Meta `media_id` download + object storage.
- Search / filter (by keyword, date range).
- Realtime push ke CRM (WebSocket / SSE) — bergantung Q-C-12 socket transport decision.
- Mark-as-read RPC dari HC → Integration.
- Internal-only messages (staff notes, AI reasoning trace).

## Konsekuensi

### Positif
- CRM inbox view feasible tanpa change ownership boundary.
- Delivery status naturally flow ke `messages` via existing T15 receipt pipeline.
- Cursor pagination scale-friendly.

### Negatif (yang kami terima)
- Marginal storage duplicate dgn `webhook_events` (raw) + `outbound_dispatch_queue` — accepted karena audit vs display concern.
- Realtime not in MVP — CRM polling atau tunggu Q-C-12 socket transport.
- Attachment not in MVP.

### Migrasi / rollout
1. Schema migration (task T29) — Slot C sentuh `prisma/schema.prisma` + `prisma/migrations/`.
2. T27 (webhook route landing) update untuk juga upsert `conversations` + insert `messages` inbound per event.
3. T28 (outbound dispatch RPC) update untuk insert `messages` outbound saat dispatch persist.
4. T15 delivery receipts (already merged) — update `messages.status` via `external_message_id` join, tanpa perubahan T15 primitive (join di route/handler layer).

## Trigger untuk revisit

- Kalau CRM butuh realtime → revisit dgn Q-C-12 socket transport (mungkin butuh notification port di conversation service).
- Kalau attachment jadi requirement → tambah `message_attachments` table + Meta `media_id` download adapter.
- Kalau HC decide own conversation state → deprecate `conversations` table di Integration, keep `messages` sebagai audit only.
