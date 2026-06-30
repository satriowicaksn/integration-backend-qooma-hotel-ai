# Backend Handover — Qooma

> **Audience**: backend engineers starting work on the Qooma backend services. The frontend (this repo) has been running against MSW mocks since H1 and the contract is frozen at H10 (Gate G1, with Wave B additions at G1.5 H14).
>
> **Authority**: this folder is a service-by-service narrative for backend planning. The canonical machine contract lives in `docs/openapi.yaml` and the canonical human contract lives in `docs/API-CONTRACT.md`. **If anything here conflicts with those two files, those two files win.** Open a question against `shared/open-questions.md` and we'll reconcile.

---

## 1. Why this split

Four services. **H11 2026-06-27 PO ruling rebalanced ownership** — Auth absorbed the `hotels` tenant entity + new `tiers` lookup + cross-hotel admin user surface; Hotel Core shrank to per-hotel operational config. **H12 2026-06-29 PO ruling** moved all integration config CRUD from Hotel Core to Integration service:

| #   | Service                                                   | Why it exists separately                                                                                                                                                                                                                                       | Size            |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | **Auth & Identity** (`01-auth-identity.md`)               | Identity + tenancy boundary — login, sessions, RBAC, **hotels (tenant)**, **tiers (catalog)**, users (per-hotel + cross-hotel admin), super_admin all-access. Backend-MVP starting point — see `MVP-AUTH-FIRST.md` for the implementation order.               | **L** ⬆ (was S) |
| 2   | **Hotel Core (CRM)** (`02-hotel-core.md`)                 | The CRM's operational surface: tickets, guests, visits, dashboard, settings (depts/menu/KB/agents/billing/integrations/voice), notifications, feature flags, WA templates. **Reads** hotels.tier via join; doesn't write. Still the largest by endpoint count. | **L** (was L)   |
| 3   | **AI / Conversation** (`03-ai-conversation.md`)           | Latency profile and scaling needs differ from CRUD. Claude API, agent prompts, conversation state, handover state machine, KB retrieval.                                                                                                                       | M               |
| 4   | **Integration / Channels** (`04-integration-channels.md`) | Webhook ingestion + third-party rate limits + retry queues are a different operational shape from CRUD. WA Cloud API, Telegram Bot, OTA email, QR.                                                                                                             | M               |

**Auth grew because** (per H11): the hotels table + tier catalog + tenant CRUD all live with identity now — one writer per table, cleaner RBAC boundary, easier to ship the MVP backend as a single coherent first slice. See `MVP-AUTH-FIRST.md` for the recommended implementation order (Auth-first).

**Hotel Core is still the heavy one by endpoint count.** Don't be surprised — it's the CRM. Splitting it further (e.g. "tickets service" vs "guests service") was rejected because they share the `hotel_id` tenant boundary, the same RBAC matrix, and the same socket gateway. Splitting now would create cross-service joins for no benefit. Re-evaluate post-MVP.

**What is NOT a separate service:**

- **Socket.io gateway** — runs in front of Hotel Core; every service emits to it via internal RPC. Catalog: `shared/socket-events.md`.
- **Background workers** — daily brief PDF, OTA email polling, escalation timers, usage metering. Live alongside the service that owns the data (e.g. escalation timer in Hotel Core, OTA poller in Integration).
- **Notifications** — persisted by Hotel Core, pushed by socket gateway. Not its own service.

---

## 2. Cross-service contracts (read before any service doc)

These bind all 4 services. If you change any of these, every service is affected.

### 2.1 Tenant model — `hotel_id` everywhere

This is a multi-tenant SaaS. Every row in every table (except auth's `users`, which carries `hotel_id` as a column) belongs to exactly one hotel.

- The authenticated session carries `{ user_id, role, hotel_id, dept_id }` (signed JWT in httpOnly cookie).
- **Every query in every service MUST filter by `hotel_id` from the session.** Treat this as middleware, not as per-handler discipline.
- `super_admin` has `hotel_id IS NULL` and bypasses the filter — explicit middleware branch, not a missing check. See `01-auth-identity.md` §RBAC.
- Backend NEVER trusts `hotel_id` from query params or request body. It comes from the session, full stop.

### 2.1a Service ownership at a glance (post H11 2026-06-27 PO ruling)

| Domain                                                                                                                                       | Service     | Endpoint group(s)                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| Login / sessions / profile                                                                                                                   | Auth        | `/api/auth/*`                                        |
| Per-hotel users (GM scope)                                                                                                                   | Auth        | `/api/users/*`                                       |
| Cross-hotel admin users (NEW H11)                                                                                                            | Auth        | `/api/admin/users/*`                                 |
| Tier catalog (NEW H11)                                                                                                                       | Auth        | `/api/admin/tiers/*`                                 |
| Hotel context (read)                                                                                                                         | Auth        | `/api/hotels/me`                                     |
| Hotel settings (GM write)                                                                                                                    | Auth        | `/api/settings/hotel`                                |
| Hotel admin CRUD (super_admin)                                                                                                               | Auth        | `/api/admin/hotels/*`                                |
| Departments / tickets / guests / visits / menu / KB / billing / notifications / feature-flags / WA-templates / voice / agents / analytics    | Hotel Core  | everything else under `/api/*` not in the rows above or below |
| Integrations (config CRUD + actions) — MOVED H12                                                                                             | Integration | `/api/integrations/*`                                |
| AI orchestration                                                                                                                             | AI          | `/api/ai/*` (TBD)                                    |
| Channel webhooks                                                                                                                             | Integration | `/webhook/*` (TBD)                                   |

### 2.2 Role matrix (FINAL — PO ruling 2026-06-24, follows ADD-12.0)

```
type Role = 'super_admin' | 'gm_admin' | 'dept_head' | 'staff'
```

| Role          | CRM access       | Scope                | Notes                                                                                                                                        |
| ------------- | ---------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `super_admin` | yes (all-access) | cross-hotel          | Platform-level. Bypasses every `gm_admin`-only guard. Appears in FE "Lihat sebagai" preview toggle.                                          |
| `gm_admin`    | yes              | one hotel            | Full access within their hotel. Approves config, billing, sees analytics, sees unmasked PII.                                                 |
| `dept_head`   | yes              | one hotel + one dept | = Supervisor (same role). Own-dept tickets + reports + dept content (menu/promo/KB).                                                         |
| `staff`       | **NO**           | one hotel + one dept | **Telegram-only.** Never receives a CRM session. Backend may issue staff records (for ticket assignment, escalation tree) but never a login. |

**`supervisor` is NOT a Role value.** The word "supervisor" survives only as: (a) the L2-escalation function a `dept_head` performs, and (b) the `departments.supervisor_telegram_id` notification field. **Reject any backend code that adds `supervisor` to the Role enum.**

### 2.3 Error envelope (canonical — every service, every endpoint)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Field 'priority' must be one of: low, normal, high, urgent.",
    "details": { "field": "priority", "received": "extreme" }
  }
}
```

Codes the frontend handles: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `BUSINESS_RULE` (422), `RATE_LIMIT` (429), `INTERNAL` (500). Full mapping in `docs/API-CONTRACT.md` §1.5.

### 2.4 Auth flow (httpOnly cookie + CSRF)

1. `POST /api/auth/login` → backend issues `Set-Cookie: token=<jwt>; HttpOnly; Secure; SameSite=Lax` + returns `{ user, csrfToken }` in body.
2. Every subsequent request from FE sends `credentials: 'include'`. JWT travels in cookie — FE never reads it.
3. Mutating verbs (POST/PUT/PATCH/DELETE) carry `X-CSRF-Token: <token>` header. Backend validates against session's csrfToken.
4. 401 from any endpoint → FE calls `POST /api/auth/refresh` once. Refresh failure → redirect `/login`.
5. After successful login → FE lands on `/dashboard` always (no deep-link restoration; explicit PO decision).

Auth is owned by service 1. Every other service trusts the session middleware Auth provides.

### 2.5 Socket.io gateway

Single connection per browser tab. Backend joins the socket to room `hotel:${hotelId}` based on the cookie. **FE never emits a `join` event — server-side authoritative.**

Every service that owns mutable data emits events via internal RPC to the gateway. Full event catalog: `shared/socket-events.md`.

### 2.6 IDs, timestamps, money

- IDs: UUID v4 strings.
- Timestamps: ISO-8601 UTC (`2026-06-11T07:32:14.123Z`). FE converts to hotel timezone on render.
- Money: `DECIMAL(12,2)` IDR whole rupiah (NOT cents).
- Enums: lowercase string literals (e.g. `status: 'in_progress'`).
- Booleans: real `true`/`false`.

### 2.7 Pagination (where lists exist)

Cursor-based, server-issued opaque cursor:

```http
GET /api/tickets?limit=20&cursor=eyJpZCI6Ii4uLiJ9
```

Response envelope:

```json
{ "data": [...], "pageInfo": { "nextCursor": "..." | null, "hasMore": true } }
```

If a list response has no `pageInfo`, FE treats it as a single page. **Pick one or the other per endpoint; do not mix offset+cursor.**

### 2.8 Multi-tenant rate limits + quotas

Tier-driven (`lite | professional | luxury | enterprise`). Hotel Core owns the tier source of truth via `GET /api/hotels/me`. Two enforcement points:

- **Outbound WhatsApp message quota** (per month, per tier): enforced by Integration service before dispatch. 80% threshold and 100% block emit `billing:threshold_reached` socket events.
- **Min-3-agents-active** rule: enforced by Hotel Core at the `PUT /api/settings/agents` boundary. Reject with `422 BUSINESS_RULE` if toggle would drop active count below 3.

Full tier matrix in CLAUDE.md §1 and `02-hotel-core.md` §Billing.

---

## 3. How to read these docs

Each service doc follows the same skeleton:

1. **Purpose** — what bounded context this service owns
2. **Endpoints** — table + per-endpoint detail, with section pointers back to `docs/API-CONTRACT.md`
3. **Data model** — owned tables (full ERD in `shared/data-model.md`)
4. **Socket events** — emitted + consumed
5. **External dependencies** — third-party APIs, env vars, secrets
6. **RBAC & tenancy** — per-endpoint role matrix + tenant guard notes
7. **Open questions** — pointer to `shared/open-questions.md`
8. **Phase 1 MSW reference** — file paths in this repo where FE mocks the contract; **diff your implementation against the mock to catch shape drift early**

---

## 4. Open questions inherited from frontend

The FE has frozen against 15 ASSUMED-shape contracts (`Q-CONTRACT-07..25`, skipping the resolved Q-14) because backend wasn't ready when FE shipped. **Backend must ratify or push back on each one BEFORE H17 (Gate G2)**, after which any divergence is a per-endpoint fix-up cost.

- **Q-CONTRACT-22** (Hotels Admin) — added Phase 2.7 H10 2026-06-26, **PO-ratified H11** (atomic GM-create + generated password + soft-delete only). See `01-auth-identity.md` §1.5 + `shared/open-questions.md` Q-22.
- **Q-CONTRACT-23** (Tiers lookup table — NEW) — added H11 2026-06-27 per PO "tier exists in DB" directive. Auth-owned. See `01-auth-identity.md` §1.4.
- **Q-CONTRACT-24** (Cross-hotel Admin Users — NEW) — added H11 2026-06-27 per PO "Add Admin" + service-split directive. Auth-owned, resolves Q-OPS-01. See `01-auth-identity.md` §1.3.
- **Q-CONTRACT-25** (Per-dept Telegram write-through — NEW) — added H12 2026-06-29 per PO Integration-service split. Integration-owned. Q-CONTRACT-07 reassigned to Integration. See `04-integration-channels.md` §2.

Q-OPS-01 (super_admin provisioning) is now **RESOLVED** — first super_admin via migration/CLI, subsequent via `POST /api/admin/users`.

Q-OPS-03 (outbound dispatch ownership) is now **RESOLVED H12** — Integration owns dispatch; HC RPCs Integration.

Full list with FE's ASSUMED shape: `shared/open-questions.md`. Pattern: FE built the MSW handler from the most reasonable interpretation of the techspec; backend implements the real shape; mismatch = backend wins, FE patches `services/<domain>.api.ts` at the H21 integration window.

---

## 5. Phase 1 source-of-truth files (FE side)

| What                                      | Where in this repo                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Human-readable API contract               | `docs/API-CONTRACT.md`                                                  |
| Machine-readable OpenAPI                  | `docs/openapi.yaml`                                                     |
| MSW mock handlers (one file per domain)   | `src/mocks/handlers/*.ts`                                               |
| MSW fixtures (canonical mock data)        | `src/mocks/fixtures/*.ts`                                               |
| FE service layer (axios + TanStack Query) | `src/services/*.api.ts`                                                 |
| Shared TS types (DTOs)                    | `src/types/api.ts`                                                      |
| Socket event consumers                    | grep `socket.on(` in `src/`                                             |
| RBAC matrix (FE guard)                    | `src/components/common/Authorized.tsx` + `src/lib/constants.ts` (ROLES) |
| Tier matrix                               | `src/lib/constants.ts` (TIERS)                                          |

**Recommended diff workflow when implementing an endpoint**:

1. Read the API-CONTRACT.md section for the endpoint.
2. Open `src/mocks/handlers/<domain>.handlers.ts` to see the exact response shape FE expects.
3. Open `src/mocks/fixtures/<domain>.ts` to see a realistic data sample.
4. Implement the endpoint to match.
5. Run the FE locally with `VITE_USE_MOCKS=false VITE_API_BASE_URL=<your-backend>` and click through the relevant page. If shapes match, you're done.

---

## 6. Repository layout for this folder

```
docs/backend-handover/
├── README.md                       ← this file
├── MVP-AUTH-FIRST.md               ← ⭐ Slice 1: Auth (H11 PO directive)
├── MVP-HOTEL-CORE-FIRST.md         ← ⭐ Slice 2: Hotel Core (H12 PO directive)
├── MVP-INTEGRATION-FIRST.md        ← ⭐ Slice 3: Integration (H12 PO directive)
├── 01-auth-identity.md             ← absorbed hotels + tiers + admin users per H11
├── 02-hotel-core.md                ← trimmed to per-hotel operational config; integrations CRUD moved out per H12
├── 03-ai-conversation.md
├── 04-integration-channels.md      ← absorbed integrations CRUD per H12
└── shared/
    ├── data-model.md               ← ERD + table-ownership matrix (H11: hotels+tiers in Auth; H12: integrations config in Integration)
    ├── socket-events.md            ← all real-time events
    └── open-questions.md           ← Q-CONTRACT-07..25 for backend to ratify (Q-22/23/24 PO-ratified H11; Q-7 reassigned + Q-25 new H12)
```

**Implementation order**: ship the three MVP-*-FIRST.md slices in order — Auth, then Hotel Core, then Integration. Each one is independently consumable by FE (flip `VITE_USE_MOCKS=false` partially and observe which pages light up). AI is wave 2 — keep mocks until it lands.

---

## 7. Out of scope for these docs

- **Deployment topology** — k8s vs serverless, cluster sizing, CDN strategy. Backend team decides.
- **Database engine** — Postgres assumed (techspec implies relational + JSONB) but not contractually locked. If you go non-Postgres, flag in `shared/open-questions.md`.
- **Internal RPC mechanism between services** — REST, gRPC, message bus all viable. Pick what suits your team. The only hard requirement: the socket gateway needs a way to receive emit-events from every service.
- **Observability stack** — logs/traces/metrics tooling. Backend team decides. FE side has its own Sentry config.
- **CI/CD pipeline** — backend team decides.

If backend decisions affect FE (e.g. CORS origin, cookie domain, websocket URL), raise in `shared/open-questions.md`.
