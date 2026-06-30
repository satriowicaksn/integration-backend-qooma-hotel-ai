# Shared — Data Model & Table Ownership

> Cross-service ERD and the rules for cross-service references.

---

## 1. Shared DB vs separate DBs

Recommended split per the original kickoff conversation:

| Services               | DB strategy                                     |
| ---------------------- | ----------------------------------------------- |
| Auth + Hotel Core      | **Shared DB** (single Postgres instance)        |
| AI / Conversation      | **Own DB** (or own schema in the same instance) |
| Integration / Channels | **Own DB** (or own schema)                      |

Why:

- **Auth + Hotel Core share** because `users.hotel_id` and `users.dept_id` are real FKs; the CRM constantly joins `tickets.assigned_user_id → users.id`. Splitting forces N+1 RPC calls for every list endpoint.
- **AI and Integration are operationally distinct** (queues, retry logic, third-party state). Their data has weak coupling to CRM data — opaque UUIDs are enough.

Alternative if you prefer microservices purity: every service owns its own DB. AI and Integration just store opaque `user_id`, `guest_id`, `hotel_id`, `dept_id` and accept orphans gracefully (return placeholders if Hotel Core's `guest_id` no longer exists). This is more work but cleaner separation.

---

## 2. Table ownership matrix

> **H11 2026-06-27 PO ruling**: `hotels` moved from Hotel Core → **Auth**. New `tiers` lookup table added in **Auth**. Hotel Core now reads `hotels`/`tiers` via cross-table join but never writes. See `01-auth-identity.md` §1.4-§1.5 for the contract.
>
> **H12 2026-06-29 PO ruling**: integration config CRUD (`wa_configs`, `telegram_configs`, `qr_state`) moved from Hotel Core → **Integration**. All `/api/integrations/*` surface now lives in Integration (both config CRUD AND actions). HC retains `departments.telegram_chat_id` + `departments.supervisor_telegram_id` columns; Integration reads them on dispatch. See `04-integration-channels.md` §2 for the contract.

| Table                                                    | Owner       | Cross-service refs                                                                                            |
| -------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| `users`                                                  | Auth        | FK `users.hotel_id → hotels.id` (intra-Auth), `users.dept_id → departments.id` (cross-service to Hotel Core)  |
| `sessions`                                               | Auth        | FK `user_id → users.id`                                                                                       |
| `password_reset_tokens`                                  | Auth        | FK `user_id → users.id`                                                                                       |
| `hotels` ⚠ MOVED H11                                     | Auth        | FK `tier_id → tiers.id` (intra-Auth). Read by Hotel Core / AI / Integration via opaque `hotel_id`.            |
| `tiers` (NEW H11)                                        | Auth        | —                                                                                                             |
| `departments`                                            | Hotel Core  | —                                                                                                             |
| `guests`                                                 | Hotel Core  | —                                                                                                             |
| `guest_preferences`                                      | Hotel Core  | FK `guest_id → guests.id`                                                                                     |
| `visits`                                                 | Hotel Core  | FK `guest_id → guests.id`                                                                                     |
| `tickets`                                                | Hotel Core  | FK `guest_id → guests.id`, `dept_id → departments.id`, `assigned_user_id → users.id`, `created_by → users.id` |
| `ticket_updates`                                         | Hotel Core  | FK `ticket_id`, `actor_user_id → users.id`                                                                    |
| `ticket_messages`                                        | Hotel Core  | FK `ticket_id`, opaque `conversation_id` (AI service)                                                         |
| `notifications`                                          | Hotel Core  | FK `user_id → users.id` (recipient)                                                                           |
| `menu_categories` / `menu_items`                         | Hotel Core  | —                                                                                                             |
| `knowledge_entries`                                      | Hotel Core  | —                                                                                                             |
| `wa_templates`                                           | Hotel Core  | —                                                                                                             |
| `feature_flags`                                          | Hotel Core  | — (per-hotel state)                                                                                           |
| `billing_quotas` / `billing_invoices` / `billing_extras` | Hotel Core  | —                                                                                                             |
| `conversations`                                          | AI          | opaque `guest_id`, `hotel_id`                                                                                 |
| `messages` (AI's)                                        | AI          | FK `conversation_id`                                                                                          |
| `ai_runs`                                                | AI          | FK `conversation_id`                                                                                          |
| `kb_retrievals`                                          | AI          | FK `ai_run_id`, opaque `knowledge_id`                                                                         |
| `voice_sessions`                                         | AI          | opaque `hotel_id` (groundwork only)                                                                           |
| `wa_configs` (NEW H12)                                   | Integration | opaque `hotel_id` — encrypted access_token                                                                    |
| `telegram_configs` (NEW H12)                             | Integration | opaque `hotel_id` — encrypted bot_token                                                                       |
| `qr_state` (NEW H12)                                     | Integration | opaque `hotel_id`                                                                                             |
| `webhook_events`                                         | Integration | opaque `hotel_id`                                                                                             |
| `outbound_dispatch_queue`                                | Integration | opaque `hotel_id`, `guest_id`                                                                                 |
| `delivery_receipts`                                      | Integration | FK `dispatch_id`                                                                                              |
| `channel_health_snapshots`                               | Integration | opaque `hotel_id`                                                                                             |
| `ota_mailbox_state`                                      | Integration | opaque `hotel_id` — encrypted imap_password                                                                   |

---

## 3. High-level ERD (Auth + Hotel Core — same DB)

> Per H11 ruling, the `hotels` table and the new `tiers` lookup live in **Auth**. Hotel Core's per-hotel tables FK on `hotels.id` (cross-service ref within the shared DB).

```
tiers (Auth) ───< (N) hotels (Auth)
                      │
                      ├───< (N) users (Auth)  (users.hotel_id → hotels.id, users.dept_id → departments.id)
                      │
                      ├───< (N) departments (Hotel Core)
                      │            │
                      │            └─────────────────────────────────┐
                      │                                              │
                      ├───< (N) guests (Hotel Core) ───< (N) visits  │
                      │         │                                    │
                      │         └───< (N) guest_preferences          │
                      │                                              │
                      ├───< (N) tickets (Hotel Core) ──> (1) departments
                      │         │      └──> (1) guests
                      │         │      └──> (1) users   (assigned_user_id)
                      │         │
                      │         ├───< (N) ticket_updates
                      │         └───< (N) ticket_messages ──┐
                      │                                     │ opaque
                      │                                     ▼
                      │                          ┌─────────────────────┐
                      │                          │ AI: conversations   │
                      │                          │       messages      │
                      │                          │       ai_runs       │
                      │                          └─────────────────────┘
                      │
                      ├───< (N) menu_categories ───< (N) menu_items   (Hotel Core)
                      ├───< (N) knowledge_entries                     (Hotel Core)
                      ├───< (N) wa_templates                          (Hotel Core)
                      ├───< (N) feature_flags                         (Hotel Core; per-hotel state rows)
                      ├───< (1) billing_quotas                        (Hotel Core; per-month rows)
                      ├───< (N) billing_invoices                      (Hotel Core)
                      └───< (N) notifications                         (Hotel Core; ──> (1) users recipient)
```

---

## 4. Cross-service reference rules

### 4.1 Auth ↔ Hotel Core (shared DB)

Use real FKs. `users.hotel_id → hotels.id` is intra-Auth (both moved to Auth per H11). `users.dept_id → departments.id` crosses Auth → Hotel Core; works because both share the DB. `tickets.assigned_user_id → users.id` and similar refs cross Hotel Core → Auth and also work in-DB.

**Tier-gating for Hotel Core**: when a Hotel Core endpoint needs the tier, JOIN — don't RPC to Auth:

```sql
SELECT t.name AS tier_name, t.features, t.outbound_quota_monthly
FROM hotels h JOIN tiers t ON h.tier_id = t.id
WHERE h.id = $session.hotel_id;
```

**On hotel deletion**: H11 PO ruling = no hard delete. Only `hotels.status = 'suspended'` (soft). The suspend cascade (UPDATE sessions SET revoked_at = NOW() WHERE user_id IN (SELECT id FROM users WHERE hotel_id = $1)) is Auth-side. Hotel Core's data for a suspended hotel remains queryable but no user can log in to view/edit it. Reactivation restores access; old sessions stay dead (users re-login).

**On user deletion**: soft-delete via `is_active = false`. Hard-delete only if no FKs (no tickets created_by, no escalation refs, etc.). Recommend keeping the row forever for audit-trail integrity. **Suspend cascade also revokes any open sessions** for the deactivated user — same `UPDATE sessions SET revoked_at = NOW()` pattern on `is_active` flip.

### 4.2 Hotel Core ↔ AI (separate DB recommended)

- `ticket_messages.conversation_id` → AI's `conversations.id`. Opaque UUID, no FK.
- `kb_retrievals.knowledge_id` → Hotel Core's `knowledge_entries.id`. Opaque UUID.

**Drift recovery**: when AI service can't find a conversation (Hotel Core has a `ticket_message` pointing at a deleted conv), return an empty conversation with a synthetic `mode: 'ai'`. Don't 500. Log for monitoring.

**Sync mechanism**: when Hotel Core deletes a KB entry, RPC AI service to drop its embeddings cache for that entry. AI service tolerates the absence either way (RAG retrieval just returns fewer hits).

### 4.3 Hotel Core ↔ Integration (separate DB recommended; shared-DB also viable per Q-OPS-06)

- `outbound_dispatch_queue.guest_id` → Hotel Core's `guests.id`. Opaque.
- `outbound_dispatch_queue.hotel_id` → Auth's `hotels.id`. Opaque.
- `webhook_events` carries the raw payload — no need to FK into Hotel Core; it's an audit log.

**Cross-service reads (Integration → HC, on dispatch)**:

- `departments.telegram_chat_id` + `departments.supervisor_telegram_id` — HC owns these columns; Integration reads them when dispatching escalation pings or daily brief PDFs to per-dept Telegram groups.
- Hotel `dnd` (now on Auth's `hotels` row per H11) — Integration reads via cross-table join (or RPC) to gate outbound during quiet hours.
- Outbound quota meter on `billing_quotas` (HC-owned) — Integration RPCs HC's `check_and_reserve_outbound_quota` + `commit_outbound_quota_increment` two-phase to ensure HC's meter reflects only confirmed sends.

**Cross-service writes (Integration → HC) — NEW H12**:

- `PUT /api/integrations/telegram/departments/:dept_id` is owned by Integration but persists to HC's `departments` table. Two implementation options (Q-OPS-06):
  - **Shared DB**: Integration writes directly to `departments` (recommended if Auth + HC + Integration co-locate in one Postgres).
  - **RPC**: Integration calls HC's internal `updateDepartmentTelegram(dept_id, fields)` (cleaner separation; one extra hop).
- WA template Meta status callback — Integration calls HC's internal `updateWaTemplateStatus(template_id, status, rejection_reason?)` after Meta webhooks back. RPC, never direct write.

**Otherwise no special sync needed** — Integration writes and reads its own queue; Hotel Core just sees the side effects (new tickets via AI flow, new notifications, updated quota meter).

### 4.4 The `hotel_id` everywhere rule

Every table in every service has a `hotel_id` column (even AI's `conversations`, Integration's `webhook_events`). Reasons:

- Tenant filter at the lowest layer (query helper, not handler logic) — see `01-auth-identity.md` §6.
- Sharding option down the road: if you ever want to split DBs per-hotel for scale, `hotel_id` is the partition key.
- Audit clarity: any row in any table can answer "which hotel does this belong to?" without joining.

**super_admin caveat**: super_admin has `hotel_id IS NULL`. When super_admin writes a hotel-scoped row, the row's `hotel_id` comes from the request body/path, NOT the session. Handler must accept it as explicit input and validate it's a real hotel.

---

## 5. Recommended Postgres conventions

These are suggestions, not contract:

- **`id`**: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`. Use `pgcrypto`'s `gen_random_uuid()` (no extension needed in PG 13+).
- **Timestamps**: `TIMESTAMPTZ` (NOT `TIMESTAMP`). Always store UTC.
- **Soft delete**: prefer `is_active BOOLEAN` or `deleted_at TIMESTAMPTZ NULL` over hard delete for any user-facing entity.
- **JSONB for sub-objects**: `departments.operating_hours`, `departments.escalation_chain`, `hotels.dnd`, `feature_flags.config` — all JSONB. Index with GIN if you query inside them.
- **Enums**: prefer `VARCHAR` with `CHECK` constraints over Postgres `ENUM` type. Easier to migrate (adding a value to a Postgres `ENUM` is `ALTER TYPE` ceremony; adding to a CHECK is a one-line migration).
- **Indexes**: at minimum, `(hotel_id)` on every multi-tenant table + `(hotel_id, created_at DESC)` on every list-heavy table (tickets, notifications, messages).

---

## 6. Migration sequencing

Suggested order for greenfield backend build:

1. Auth (`tiers` seed → `hotels` → `users` → `sessions` → `password_reset_tokens`) + Hotel Core's `departments` — minimum viable login + tenant scope. The `tiers` seed must run BEFORE `hotels` (FK dependency); the first `super_admin` must be seeded BEFORE the first hotel can be created via API (admin needs login to call `POST /api/admin/hotels`).
2. Hotel Core's `guests` + `visits` + `tickets` + `ticket_updates` + `ticket_messages` — the core CRM domain.
3. AI's `conversations` + `messages` + `ai_runs` — wires up AI processing of inbound messages.
4. Integration's `webhook_events` + `outbound_dispatch_queue` — completes inbound + outbound loop.
5. Settings tables (`menu_*`, `knowledge_entries`, `wa_templates`, `feature_flags`, `billing_*`).
6. Notifications (`notifications` + socket gateway plumbing).
7. AI's `kb_retrievals` + voice groundwork.
8. Integration's `ota_mailbox_state` + OTA email parser.

Steps 1–4 are the critical path. 5–8 can run in parallel once 1–4 land.

---

## 7. Migration tool

Backend choice — Flyway, Alembic, Prisma migrations, raw SQL files in `/migrations/`. FE doesn't care. Recommend the team picks one and sticks with it.
