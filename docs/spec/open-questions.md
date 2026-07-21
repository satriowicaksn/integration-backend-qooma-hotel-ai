# Shared — Open Questions for Backend to Ratify

> The FE was built against MSW (Mock Service Worker) using ASSUMED contracts for endpoints that didn't exist in the original techspec. Backend's job: **ratify or push back on each, BEFORE H17 (Gate G2)**. Mismatches discovered after G2 are per-endpoint fix-up cost — manageable but avoidable.
>
> Each entry below is in the form: **what FE assumed → what backend needs to confirm → cost-of-change if backend deviates**.
>
> Reference: PM-STATUS.md §3 (Wave B Q-CONTRACT-07..22; Q-14 resolved H3) for the original FE-side context and which task locked which shape.

---

## Q-CONTRACT-07 — Integrations endpoints — ⚠ REASSIGNED H12 2026-06-29 to Integration service

**FE assumed**: the surface in API-CONTRACT §2.7 — config CRUD (`PUT /api/integrations/whatsapp`, `/telegram`, per-dept telegram), action endpoints (`POST /verify-webhook`, `POST /qr/regenerate`, `GET /qr/download`), and `GET /api/integrations/health` poll endpoint with `IntegrationState` response shape.

**H12 PO ruling**: all `/api/integrations/*` surface — config CRUD AND actions — moved from Hotel Core to Integration service. See `04-integration-channels.md` §2 for the canonical surface.

**Backend (Integration team) needs to confirm**:

- Endpoint shapes match (especially the BSP field for WA — currently `'1engage'` is the only enum value FE knows).
- Health response shape with `status: healthy | degraded | down` literal union.
- QR PNG dimensions (FE assumes 1024×1024).
- Cross-service write semantics for `PUT /api/integrations/telegram/departments/:dept_id` — see Q-CONTRACT-25 below.

**Cost of deviation**: low — `src/services/integrations.api.ts` is isolated.

---

## Q-CONTRACT-08 — Feature flags shape

**FE assumed**: `GET /api/feature-flags` returns array of `FeatureFlagListItem { flag, category, min_tier, is_enabled, is_tier_locked, config, depends_on_active_data }`. PATCH per-flag with `{ is_enabled, config? }`. 19 flag names locked in fixtures.

**Backend needs to confirm**:

- The 19 flag names (full list in `src/mocks/fixtures/feature-flags.ts`).
- `is_tier_locked` is a server-computed field (not stored).
- `depends_on_active_data` shape per flag (current example: `{ campaigns_count, menu_items_count }`).

**Cost of deviation**: medium — feature-flags page has tier-locked UI logic tied to the field set.

---

## Q-CONTRACT-09 — WhatsApp templates lifecycle

**FE assumed**: 5 endpoints (GET list, POST submit, PATCH edit-pending, DELETE archive, POST resubmit). `WaTemplate` shape with `status: pending | approved | rejected | archived`, `template_id_meta`, `rejection_reason`. 8 standard names per ADD-08.2.

**Backend needs to confirm**:

- Meta approval webhook handling — backend updates `status` async.
- Whether `is_global=true` templates are read-only at hotel level (FE assumes yes).
- `language` field per template (FE assumes single-language per template; if a template needs multi-language, schema breaks).

**Cost of deviation**: medium — WA templates page is its own surface.

---

## Q-CONTRACT-10 — Operating hours + DND embedding

**FE assumed**: `operating_hours` JSONB embedded in `Department` object; `dnd` JSONB embedded in `Hotel` object (returned from `GET /api/settings/hotel`).

**Backend needs to confirm**:

- Embedding (vs separate endpoints `/api/departments/:id/operating-hours`).
- `operating_hours.timezone` per-dept (FE assumes yes — useful if a chain spans timezones).
- DND `exception_inbound` and `exception_vvip` semantics — FE renders both as toggles in `/settings/hotel`.

**Cost of deviation**: low if embedding (FE just updates type defs); high if endpoints split (FE refactors the form).

---

## Q-CONTRACT-11 — Escalation tree embedding

**FE assumed**: `escalation_chain` JSONB embedded in `Department` object with L1/L2/L3 SLAs + user IDs + `skip_to_l3_categories`.

**Backend needs to confirm**:

- Embedding location.
- L2 must be a `dept_head` of the same dept; L3 must be a `gm_admin`. Validate on write.
- `skip_to_l3_categories` enum values — FE assumes `['vvip', 'urgent', 'complaint']` are the supported values.

**Cost of deviation**: low.

---

## Q-CONTRACT-12 — Billing full shape (ADD-13)

**FE assumed**: `GET /api/settings/billing` returns full `Billing` object with `tier`, `outbound_quota` (prepaid balance: `balance_total` / `balance_used` / `balance_remaining`), `active_agents`, `active_users_count`, `extra_addons`, `invoices`, `daily_brief_pdf_url_latest`. `POST /api/billing/outbound-topup { package: 'S' | 'M' | 'L' }` returns `pending_confirmation`.

**Backend needs to confirm**:

- Low-balance notification thresholds `[20, 5]` percent **remaining** (prepaid balance; no monthly allotment, no reset).
- Whether daily brief PDF URL is presigned (FE just hits it with `<a href download>`).

**Cost of deviation**: medium — billing page is rich.

---

## Q-CONTRACT-13 — Conversations + Handover endpoints

**FE assumed**: 5-field `Conversation { id, mode, handover_to_telegram_user_id, handover_to_staff_name, handover_at, handover_reason }`. 3 endpoints (GET + 2 POST). 4 errors (404 / 422 BUSINESS_RULE × 2 / 400). 2 socket events (`conversation:handover_start` + `conversation:handover_end`).

**Backend needs to confirm**:

- 5-field shape (esp. `handover_reason` enum vs free text — FE accepts string).
- Whether `handover_to_staff_dept` should be added (PO may want dept-aware handover UI).
- N6 caveat in the FE mock: unknown conv_id falls back to `mode: 'ai'` rather than 404. Real backend should 404; FE will show 404 page accordingly.

**Cost of deviation**: medium — handover banner + ticket detail message thread.

---

## Q-CONTRACT-15 — Password change + visit reject path

**FE assumed (password)**: `POST /api/auth/me/password { current_password, new_password }` → `{ success: true }` / 422 / 400.

**FE assumed (visit reject)**: `PATCH /api/visits/:id/verify-manual { action: 'reject' }` → status `rejected`. Backend may prefer dedicated `DELETE` or `PATCH /reject` endpoint.

**Backend needs to confirm**:

- Password endpoint verb (`POST` vs `PUT`).
- Visit reject endpoint shape — sub-action flag, dedicated path, or DELETE?

**Cost of deviation**: low — both isolated in `auth.api.ts` and `visits.api.ts`.

---

## Q-CONTRACT-16 — PII masking semantic

**FE assumed**: backend masks `wa_phone`, `name`, `email` when `privacy_mode === 'vvip' AND viewer.role !== 'gm_admin'` (compound predicate). Super_admin counts as gm_admin via all-access. Locked at T-FIX-07 SUBMIT per PO Q3 GM-bypass intent.

**Backend needs to confirm**:

- The compound predicate is correct.
- Mask format (`wa_phone_masked: "+62812***6789"`, `name: "B***"`, `email: "b***@example.com"`).
- Whether dept_head should be masked for ALL guests (not just vvip) — alternate policy PO may direct.

**Cost of deviation**: high if alternate policy — affects every guest serialization. Worth a quick confirm BEFORE backend implementation.

---

## Q-CONTRACT-17 — Ticket `complaint_type` classification

**FE assumed**: `ComplaintType = 'staff_attitude' | 'facility' | 'fnb' | 'general' | 'vvip'`. Field on `Ticket` and `TicketDetail` (`complaint_detail: string | null`). `resolved_satisfaction: 1|2|3|4|5 | null`. Filter param `complaint_type` CSV on list endpoint. **3-axis semantic disambiguation**: `ComplaintType.vvip` is a complaint category, distinct from `PrivacyMode.vvip` (guest privacy) and `SkipCategory.vvip` (escalation skip).

**Backend needs to confirm**:

- The 5 enum values.
- AI classifier produces this on ticket creation (lives in AI service per `03-ai-conversation.md`).
- 3-axis distinction documented in code comments (or rename one of them to avoid confusion).

**Cost of deviation**: medium — tickets list + detail UI.

---

## Q-CONTRACT-19 — Failed-3x verification flow

**FE assumed**: `FailedVerificationVisit` shape (7 fields). `PendingVerificationStatus` extended with `+'failed_verification' | 'rejected'`. 2 new endpoints (`PATCH /visits/:id/reject`, `PATCH /visits/:id/approve-manual`). Query filter `?status=failed_verification`. 4 error envelopes per endpoint. 3 socket events including the sparse `verification:failed_3x { visit_id, attempts: 3 }`.

**Backend needs to confirm**:

- Reject endpoint shape (dedicated PATCH vs DELETE vs sub-action of `verify-manual` — see Q-15).
- Whether `verification:failed_3x` payload should include full visit object for FE optimistic updates (current sparse payload forces FE refetch).

**Cost of deviation**: medium — dashboard cards + Failed 3x list.

---

## Q-CONTRACT-20 — Manual visit create

**FE assumed**: `POST /api/visits` body `{ guest_id: string | null, guest_name?, wa_phone?, check_in_date, check_out_date, room_number, booking_source: 'direct' | 'walk-in', special_request? }` → response `Guest` (visits-array refreshed). 5 errors. **`special_request` accepted by FE mock but NOT persisted** to `GuestVisit` (R13 ephemeral semantics per PO default).

**Backend needs to confirm**:

- Whether `special_request` should persist to GuestVisit (FE happy either way).
- `booking_source` enum (FE assumes `direct | walk-in` only — if PO wants `phone-walk-in` etc., add at H21).

**Cost of deviation**: low — visit-create form is self-contained.

---

## Q-CONTRACT-21 — Analytics high-alert endpoint

**FE assumed**: `GET /api/analytics/high-alert` returns `HighAlertAnalysisResponse { data: HighAlertDepartmentMetric[]; alert_summary }`. 6-field per-dept + 3-field summary + 5-value `HighAlertRecommendationKey` enum. Threshold = strict `current > prev * 1.10`.

**Backend needs to confirm**:

- Threshold formula (FE will adapt UI to whatever you pick).
- 5 `recommendation_key` values: `all_departments_healthy | single_dept_spike | multi_dept_concern | cross_dept_pattern | systemic_alert`.

**Cost of deviation**: low — high-alert card is one component.

---

## Q-CONTRACT-22 — Hotels Admin (Phase 2.7 — T75) — ⭐ PO-ratified H11 2026-06-27

**FE assumed**: 5 super_admin-only endpoints under `/api/admin/hotels` (GET list, POST create, GET detail, PATCH metadata, PATCH `/status` for suspend/reactivate). `AdminHotel` shape with `{ id, name, code, tier, status, gm_contact: {name,email,phone}, created_at, agent_count, user_count }`. Status enum = `'active' | 'suspended'`. List envelope `{ data, meta: { total } }` with no filter/search/pagination (≤ 100 tenants expected). Full shape: `01-auth-identity.md` §1.5 + API-CONTRACT §2.14.

**PO ratifications H11 2026-06-27**:

- ✅ **Service ownership**: Auth (was Hotel Core in T75 draft — moved per H11 ruling).
- ✅ **5-endpoint surface ratified** including the dedicated `/status` PATCH.
- ✅ **Suspend semantic**: `403 SUSPENDED` on login + **immediate session revocation** across the tenant (cascade `UPDATE sessions SET revoked_at = NOW() WHERE user_id IN (SELECT id FROM users WHERE hotel_id = $1)`). Reactivation restores login eligibility but does NOT auto-resurrect old sessions.
- ✅ **No hard delete in MVP** — suspend is the only "delete" semantic.
- ✅ **Atomic GM-user creation**: `POST /api/admin/hotels` writes BOTH the hotel row AND a `users` row for the GM (role=`gm_admin`, email/name from `gm_contact`, hotel_id=new) in one transaction. Response shape becomes `{ hotel, gm_user, generated_password }`.
- ✅ **Generated-and-returned password**: 16-char alphanumeric+symbols, server-generated, returned plaintext ONCE in the create response body. FE displays in a copy-modal then drops from state. `must_rotate_password: true` set on the user row → forced rotation via `POST /api/auth/me/password` on first login. NO SMTP / email-reset in MVP.
- ✅ **`code` uniqueness**: platform-wide.
- ✅ **`agent_count` + `user_count`**: backend-computed read-only telemetry.
- 🟡 **`tier: 'enterprise'` gating**: still OPEN — does it require an extra backend feature flag / approval gate, or is the validation just "row exists in tiers table" (which always passes since 4 rows are seeded)? Backend's call. FE accepts either.

**Cost of remaining deviation**: low — `src/services/admin.api.ts` + handler + page are isolated; the atomic-GM-create + generated-password fields are additive to the response, no FE refactor.

---

## Q-CONTRACT-23 — Tiers lookup table (Phase 2.8 — H11 service-split ruling)

**FE assumed**: `tiers` lookup table in Auth's DB (PO ruling H11 — "Tier exists in DB"). Read endpoint `GET /api/admin/tiers` returns all 4 rows + per-tier config (`agent_cap`, `user_cap`, `department_cap`, `features` JSONB, `is_custom` for enterprise). Outbound is **not** tier-gated — it is a prepaid top-up balance per hotel (0 included), so `outbound_quota_monthly` and `agent_minimum` are dropped from the tier schema. Super_admin-only read in MVP. `hotels.tier_id` FK → `tiers.id`. Existing `AdminHotel.tier` + `/api/hotels/me { tier }` responses keep the flat `tier: 'luxury'` string (backend joins `tiers.name` on read) for FE compatibility. Full shape: `01-auth-identity.md` §1.4 + API-CONTRACT §2.1b.

**Backend needs to confirm**:

- The 4 tier rows + the per-tier config values. `agent_cap` = TOTAL agents incl. Receptionist per tier: **lite=2, professional=4, luxury=6, enterprise=custom** (`-1` sentinel). No minimum-agent floor — the cap is an upper bound only; extra agents beyond the cap are billed as `+Agent` add-ons.
- Read scope: super_admin-only in MVP. **Alternate** PO may direct: authenticated-all (so gm_admin can show their tier's full config for upsell UX). FE accepts either.
- `is_custom: true` for enterprise — enterprise still uses the shared prepaid top-up model (no per-tenant outbound override column); only the `agent_cap` sentinel differs. Flag any per-tenant override needs if you ship later.
- Write surface (`PATCH /api/admin/tiers/:name` to edit config without redeploy) is **explicitly OUT OF SCOPE for Phase 2.8** — migration-managed only. Confirm.

**Cost of deviation**: low — `tiers` is a new code surface (no legacy mocks to retrofit). FE adds `src/services/tiers.api.ts` + types when backend ships.

---

## Q-CONTRACT-24 — Cross-hotel Admin Users (Phase 2.8 — H11 service-split ruling)

**FE assumed**: 4 super_admin-only endpoints under `/api/admin/users` (GET list, POST create, PATCH, POST reset-password). The ONLY way to create a `super_admin` user or to create users in a hotel other than your own. `POST` body `{ email, name, role, hotel_id?, dept_id?, language }` with mutual-exclusion validation (`hotel_id` required for non-super_admin, must be omitted for super_admin). Same generate-and-return password pattern as §2.5a. Full shape: `01-auth-identity.md` §1.3 + API-CONTRACT §2.5b.

**Backend needs to confirm**:

- The 4-endpoint surface (FE chose `/api/admin/users` parallel to `/api/admin/hotels` + `/api/admin/tiers` for namespace consistency).
- Mutual-exclusion validation on `(role, hotel_id)`: `super_admin` ↔ `hotel_id IS NULL`; all others ↔ `hotel_id IS NOT NULL`. Enforced at both DB CHECK constraint AND endpoint validation level (defense-in-depth).
- Last-super_admin guard: PATCH or `is_active=false` that would leave platform with zero active super_admins → 422 BUSINESS_RULE. Confirm policy.
- First super_admin seeding mechanism — see Q-OPS-01 RESOLVED below.

**Cost of deviation**: low — new code surface, no FE legacy to migrate.

---

## Q-CONTRACT-25 — Cross-service write for per-dept Telegram (NEW H12 2026-06-29)

**Context**: per H12 PO ruling, all `/api/integrations/*` lives in Integration service. But the per-dept Telegram routing endpoint (`PUT /api/integrations/telegram/departments/:dept_id`) needs to persist `telegram_chat_id` + `supervisor_telegram_id` into HC's `departments` table (those columns stay HC-owned because they're dept-scoped data, not channel-config data).

**FE assumed**: the endpoint exists at `/api/integrations/telegram/departments/:dept_id` regardless of internal implementation. FE calls with `{ telegram_chat_id, supervisor_telegram_id }`, gets back updated dept fragment.

**Backend (Integration + HC teams) needs to decide**:

- **Option A (shared DB)**: Integration writes directly to HC's `departments` table. Simple; requires shared-DB topology.
- **Option B (RPC)**: Integration calls HC's internal `updateDepartmentTelegram(dept_id, fields)`. Cleaner; one extra hop.

FE doesn't care which. Document the choice + auth scheme for internal RPC in repo READMEs.

**Cost of deviation**: zero on FE side — endpoint path is stable regardless of implementation.

---

## Backend-discovery questions (raised by these handover docs, NOT FE assumptions)

### Q-OPS-01 — super_admin provisioning — ✅ RESOLVED H11 2026-06-27 (PO ruling)

**Decision**: Two-stage mechanism.

1. **First super_admin** (chicken-and-egg) — seeded via DB migration / CLI script. Backend ships a one-off `seed-super-admin` migration or `npm run seed:super-admin` CLI that reads env vars (`SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`) and INSERTs a single `users` row with `role: 'super_admin'`, `hotel_id: NULL` if none exists yet. Idempotent (no-op if any super_admin already exists). Document the env vars in the backend README so the support team knows how to recover if the founding super_admin is locked out.
2. **Subsequent super_admins** — created by an existing super_admin via `POST /api/admin/users` (Q-CONTRACT-24). Same generate-and-return password UX as all other admin-created users. The new super_admin then changes their password via `POST /api/auth/me/password` on first login (forced by `must_rotate_password: true`).

**Self-signup is OFF** — there is no public registration endpoint for super_admin (or any role). All user creation is admin-mediated.

**Cap**: no upper limit on super_admin count (yet); add platform-policy-level cap if needed later.

**Last-super_admin guard**: enforced at PATCH/soft-delete time per Q-CONTRACT-24 — cannot demote or deactivate the last active super_admin (422 BUSINESS_RULE).

### Q-OPS-02 — Session timeout / sliding refresh

Default access token lifetime? Refresh token lifetime? Sliding window or fixed? FE doesn't care for correctness — affects UX (how often users are surprised by re-login).

Suggested defaults: 15-min access token, 7-day refresh, sliding.

### Q-OPS-03 — Outbound dispatch ownership — ✅ RESOLVED H12 2026-06-29 (PO ruling)

**Decision**: outbound WA + Telegram dispatch lives in **Integration service** (not as a Hotel Core worker). HC RPCs Integration via `send_wa_message` / `send_telegram_message`. DND + quota gating happens in Integration BEFORE dispatch, using HC's quota meter via two-phase RPC (`check_and_reserve_outbound_quota` + `commit_outbound_quota_increment`).

This decision is part of the broader H12 "Integration owns the channels surface" ruling.

### Q-OPS-04 — BSP abstraction layer

Code against `1engage` directly, or build a BSP-agnostic interface for swapping vendors later? Backend's call. Recommend a thin interface even if `1engage` is the only adapter for v1 — keeps options open.

### Q-OPS-05 — OTA email raw blob retention

Store raw email bytes for re-parse if OTA format drifts? Storage cost vs operational flexibility. Recommend yes (raw blobs in object storage; parse output in DB). Backend's call.

### Q-OPS-06 — Shared DB vs RPC for Integration → HC writes (NEW H12 2026-06-29)

Per H12, Integration owns the `/api/integrations/telegram/departments/:dept_id` endpoint but writes to HC's `departments` table. Two options:

- **Shared DB**: Auth + HC + Integration co-locate in one Postgres. Integration writes directly. Simple, no RPC infrastructure needed for this case.
- **Separate DBs + RPC**: Integration RPCs HC. Cleaner microservice boundary, but adds RPC infra (auth, retry, error handling).

Backend decision based on infra preference + team org. Same call applies to AI service for any cross-service writes it needs (none in MVP — AI writes its own conversations, opaque `conversation_id` points back to HC's `ticket_messages`).

Recommend shared DB for Auth + HC + Integration in MVP (Postgres can handle it; reduces RPC infra burden during the 30-day MVP build). Re-evaluate at wave 2 if scaling demands force a split.

### Q-AI-01 — Claude model selection per tier

Default model per tier? Sonnet for Luxury, Haiku for Lite to control cost? Backend's call; FE has no visibility into this.

### Q-AI-02 — KB embedding strategy

Pgvector (in-DB) vs external vector store? Backend's call.

### Q-AI-03 — Handover idle timeout

Auto-release handover after how many minutes idle? Techspec implies 30. Confirm.

### Q-RT-01 — super_admin socket scope

Join all hotel rooms or wildcard room? Affects gateway implementation.

### Q-RT-02 — Missed-events catch-up

Refetch-on-reconnect (current FE plan) is the simple choice. Build an event-replay buffer only if you see a real need.

### Q-INFRA-01 — CORS origin + cookie domain

What's the production FE domain? Cookie domain settings determine cross-subdomain auth. Affects backend config.

### Q-INFRA-02 — Websocket URL

`VITE_SOCKET_URL` env var on FE side. Backend tells FE where the socket lives. Same domain as REST or separate?

---

## How to use this list

1. Backend lead reads through, marks each with: **ratify** (FE was right) / **deviate** (backend will do X instead) / **defer** (decide later).
2. For each **deviate**, post the chosen shape to PM-STATUS.md §3 (or wherever planning currently tracks contract changes).
3. Planning Agent updates `docs/API-CONTRACT.md` to reflect the new canonical shape.
4. FE patches `src/services/<domain>.api.ts` + `src/mocks/handlers/<domain>.handlers.ts` to match at the H21 integration window.

**Deadline for ratify/deviate decisions: H17 (Gate G2)** — after this, the cost-of-change rises.
