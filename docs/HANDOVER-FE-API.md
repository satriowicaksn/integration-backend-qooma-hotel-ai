# FE ↔ Integration Backend — API Handover

> Kontrak HTTP untuk integrasi frontend dengan `integration-backend-qooma-hotel-ai`.
> Semua endpoint di sini sudah landed di branch `staging` dan siap dipakai FE.
> Endpoint di bagian **Internal RPC** dan **Webhook** BUKAN untuk FE — dijelaskan supaya
> gambaran end-to-end jelas.

**Last verified**: 2026-07-09, terhadap kode di `main` / `staging`.

---

## 1. Base URL

| Environment | Base URL |
|---|---|
| Local dev | `http://localhost:3000` |
| Staging (VPS) | `https://integration-staging.sharedisini.com` |
| Production | belum di-deploy (menunggu keputusan namespace prod) |

Semua path di dokumen ini bersifat **absolute** (misal `/api/integrations/whatsapp`). Tempel di belakang base URL sesuai environment.

## 2. Authentication

Ada 3 skema auth berbeda. FE hanya berurusan dengan **JWT Bearer**.

### 2.1 JWT Bearer (semua endpoint `/api/*` untuk FE)

Header:
```
Authorization: Bearer <access_token>
```

- Algoritma: HS256, secret di server (`JWT_ACCESS_SECRET`).
- Payload minimal: `{ sub, hotel_id, role, iat, exp }`.
- `role` yang diterima untuk endpoint di dokumen ini: **`gm_admin`**. Role lain (`staff`, `dept_head`, dll) → 403.
- Access token lifetime: 8 jam (per CLAUDE.md §6).
- Refresh token flow: **BELUM ada di service ini** — nanti dihandle oleh Auth service terpisah. Untuk MVP, FE dapat access token dari Auth service dan tempel di sini.

Untuk local dev tanpa Auth service jalan: lihat `docs/runbooks/local-dev.md` — ada helper `pnpm dev:jwt` yang generate token demo.

### 2.2 Internal RPC Secret (Hotel Core → service ini)

Header:
```
X-Internal-Secret: <shared_secret>
```

Dipakai untuk endpoint `/internal/wa/*`. **Tidak untuk FE.** Kalau FE butuh data yang disajikan endpoint ini, minta Hotel Core expose proxy endpoint FE-facing.

### 2.3 Webhook signature (Meta / Telegram → service ini)

Header:
- WhatsApp: `X-Hub-Signature-256: sha256=<hmac>`
- Telegram: `X-Telegram-Bot-Api-Secret-Token: <secret>`

Dipakai untuk endpoint `/webhook/*`. **Tidak untuk FE.**

## 3. Standard headers & response envelope

### 3.1 Correlation ID (semua endpoint)

- **Request** (optional): `X-Correlation-Id: <uuid-v4>` — kalau tidak dikirim, server generate.
- **Response** (always): `X-Correlation-Id: <uuid-v4>` — sama dengan request kalau ada, atau yang di-generate.

FE **sangat disarankan** kirim correlation ID sendiri untuk request penting (dispatch, config update) supaya bisa cross-reference log kalau ada masalah.

### 3.2 Error envelope

Semua error 4xx / 5xx punya shape yang sama:

```json
{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable message",
    "details": { }
  }
}
```

| HTTP | `code` | Kapan terjadi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body/query/param gagal zod validation. `details.issues` = array field errors. |
| 401 | `AUTH_ERROR` | Token JWT tidak ada / expired / invalid. |
| 403 | `FORBIDDEN` | Token valid tapi role tidak cukup. |
| 404 | `NOT_FOUND` | Resource tidak ada (config, conversation, hotel slug). `details = { resource, id }`. |
| 409 | `CONFLICT` | Duplicate / constraint (jarang di endpoint ini). |
| 422 | `WA_CONFIG_INVALID` / `TELEGRAM_CONFIG_INVALID` | Business validation gagal setelah zod OK. |
| 429 | `RATE_LIMIT_EXCEEDED` | Terlalu banyak request (100/min per IP). |
| 500 | `INTERNAL` | Bug server. `details.correlationId` untuk support lookup. |
| 502/503 | `EXTERNAL_SERVICE_ERROR` | Upstream (BSP WhatsApp / Meta) gagal. |

FE cukup: kalau `response.status >= 400`, tampilkan `error.message` ke user (atau kustom UX per `error.code`).

### 3.3 Anti-enumeration

Untuk endpoint yang butuh `hotel_id` / `dept_id` / `conversation_id`, cross-tenant access akan return 404 (bukan 403), **shape sama** dengan resource yang benar-benar tidak ada. Jangan bedain UX antara "tidak ada" dan "bukan milik Anda".

---

## 4. Public endpoints (untuk FE)

### 4.1 `GET /healthz`

- **Auth**: none
- **Deskripsi**: Liveness probe. FE bisa pakai untuk cek konektivitas backend.
- **Request**: none
- **Response 200**:
  ```json
  { "status": "ok" }
  ```
- **Source**: `src/entrypoints/api-server.ts:108`

---

### 4.2 `GET /api/integrations` — aggregated status (rekomendasi endpoint UTAMA halaman integrasi)

- **Auth**: JWT `gm_admin`
- **Deskripsi**: Satu panggilan yang mengembalikan status semua channel + health pill. Ideal untuk halaman "Integrations" di dashboard.
- **Request headers**:
  ```
  Authorization: Bearer <jwt>
  X-Correlation-Id: <uuid>   (optional)
  ```
- **Request body**: none
- **Response 200**:
  ```json
  {
    "whatsapp": {
      "bsp": "1engage",
      "phone_number": "+6281234567890",
      "verified_at": "2026-01-15T10:30:00Z",
      "has_access_token": true,
      "webhook_url": "https://integration-staging.sharedisini.com/webhook/whatsapp/hotel-slug-123"
    },
    "telegram": {
      "bot_username": "qooma_demo_bot",
      "has_bot_token": true,
      "default_chat_id": "-100999",
      "webhook_url": "https://integration-staging.sharedisini.com/webhook/telegram/hotel-slug-123"
    },
    "qr": {
      "url": "https://wa.me/6281234567890",
      "png_url": "https://cdn.example.com/qr/hotel-uuid.png",
      "generated_at": "2026-01-15T10:30:00Z"
    },
    "health": {
      "whatsapp": { "status": "healthy", "last_message_at": "2026-01-15T10:29:00Z" },
      "telegram": { "status": "degraded" },
      "claude_api": { "status": "healthy", "last_check_at": "2026-01-15T10:30:00Z", "uptime_30d": 99.8, "avg_response_ms": 145 }
    }
  }
  ```
- **Notes penting untuk FE**:
  - `whatsapp` / `telegram` / `qr` **bisa null** kalau belum di-configure oleh hotel. Tangani null → tampilkan "Belum di-setup" + CTA.
  - `health` **selalu ada** (never null). Kalau reader gagal, `status: "down"` (bukan error).
  - `has_access_token` / `has_bot_token` = boolean saja. Plaintext token TIDAK PERNAH dikirim ke FE.
  - Enum `status`: `"healthy" | "degraded" | "down"`.
  - Panggil per-subsystem endpoint (§4.3, §4.5, §4.7) hanya kalau user drill-down untuk edit.
- **Errors**: 401, 403
- **Source**: `src/modules/integration-overview/integration-overview.routes.ts`

---

### 4.3 `GET /api/integrations/whatsapp` — get WA config

- **Auth**: JWT `gm_admin`
- **Response 200**:
  ```json
  {
    "hotelId": "11111111-2222-3333-4444-555555555555",
    "bsp": "1engage",
    "phoneNumberId": "1234567890",
    "phoneNumber": "+6281234567890",
    "accessToken": "***masked***",
    "webhookUrl": "https://integration-staging.sharedisini.com/webhook/whatsapp/hotel-slug",
    "webhookVerifyToken": "***masked***",
    "verifiedAt": "2026-01-15T10:30:00Z",
    "createdAt": "2026-01-15T10:30:00Z",
    "updatedAt": "2026-01-15T10:30:00Z"
  }
  ```
- **Errors**: 401, 403, 404 (`resource: "WaConfig"`)
- **Source**: `src/modules/whatsapp/whatsapp-config.routes.ts`

### 4.4 `PUT /api/integrations/whatsapp` — upsert WA config

- **Auth**: JWT `gm_admin`
- **Request body**:
  ```json
  {
    "bsp": "1engage",
    "phoneNumberId": "1234567890",
    "phoneNumber": "+6281234567890",
    "accessToken": "plaintext-token-abcdef123",
    "webhookUrl": "https://example.com/webhook",
    "webhookVerifyToken": "plaintext-verify-token"
  }
  ```
  | Field | Rule |
  |---|---|
  | `bsp` | enum `["1engage"]`, default `"1engage"` (optional) |
  | `phoneNumberId` | string 1–80 chars (required) |
  | `phoneNumber` | E.164, regex `^\+[1-9]\d{1,14}$`, max 20 chars (required) |
  | `accessToken` | string min 1 char (required) — plaintext, di-enkripsi at-rest |
  | `webhookUrl` | valid URL, max 500 chars (required) |
  | `webhookVerifyToken` | string 1–80 chars (required) — plaintext, di-enkripsi at-rest |
- **Response 200**: sama shape dengan §4.3 (token masked).
- **Errors**: 400 `VALIDATION_ERROR`, 401, 403

---

### 4.5 `GET /api/integrations/telegram` — get Telegram config

- **Auth**: JWT `gm_admin`
- **Response 200**:
  ```json
  {
    "hotelId": "uuid",
    "botToken": "***masked***",
    "botUsername": "qooma_demo_bot",
    "defaultChatId": "-100999",
    "gmTelegramId": "123456789",
    "webhookUrl": "https://example.com/webhook",
    "createdAt": "2026-01-15T10:30:00Z",
    "updatedAt": "2026-01-15T10:30:00Z"
  }
  ```
- **Errors**: 401, 403, 404 (`resource: "telegram_config"`)
- **Source**: `src/modules/telegram/telegram.routes.ts:25`

### 4.6 `PUT /api/integrations/telegram` — upsert Telegram config

- **Auth**: JWT `gm_admin`
- **Request body**:
  ```json
  {
    "botToken": "123456789:AAABBBcccDDDEeeFFFgggHHHiiiJJJkkk",
    "botUsername": "qooma_demo_bot",
    "defaultChatId": "-100999",
    "gmTelegramId": "123456789",
    "webhookUrl": "https://example.com/webhook"
  }
  ```
  | Field | Rule |
  |---|---|
  | `botToken` | string 20–200 chars (required) — plaintext, di-enkripsi at-rest |
  | `botUsername` | string 1–40 chars, `[A-Za-z0-9_]` only (required) |
  | `defaultChatId` | string 1–64 chars, nullable (optional) |
  | `gmTelegramId` | string 1–64 chars, nullable (optional) |
  | `webhookUrl` | valid URL, max 500 chars, nullable (optional) |
- **Response 200**: sama shape dengan §4.5 (token masked).
- **Errors**: 400, 401, 403
- **Source**: `src/modules/telegram/telegram.routes.ts:30`

### 4.7 `PUT /api/integrations/telegram/departments/:dept_id` — per-dept routing

- **Auth**: JWT `gm_admin`
- **URL param**: `dept_id` (string 1–64 chars) — ID departemen yang di-scope.
- **Request body** (minimal salah satu field harus terisi):
  ```json
  {
    "telegram_chat_id": "-100999",
    "supervisor_telegram_id": "123456789"
  }
  ```
- **Response 200**:
  ```json
  { "updated": true, "updated_at": "2026-01-15T10:30:00Z" }
  ```
- **Errors**: 400 (kedua field kosong), 401, 403, 404 (`resource: "department"` — anti-enumeration)
- **Source**: `src/modules/telegram-dept-routing/telegram-dept-routing.routes.ts:42`

---

### 4.8 `POST /api/integrations/qr/regenerate` — generate QR baru

- **Auth**: JWT `gm_admin`
- **Deskripsi**: Regenerate QR code WhatsApp untuk hotel. Ambil nomor WA dari `waConfig`, generate wa.me URL + PNG.
- **Request body**:
  ```json
  { "greetingText": "Welcome! How can we help?" }
  ```
  | Field | Rule |
  |---|---|
  | `greetingText` | string max 400 chars (optional). Kalau ada → di-append ke wa.me URL sebagai `?text=`. |
- **Response 200**:
  ```json
  {
    "url": "https://wa.me/6281234567890?text=Welcome%21%20How%20can%20we%20help%3F",
    "png_url": "https://cdn.example.com/qr/hotel-uuid.png",
    "generated_at": "2026-01-15T10:30:00Z"
  }
  ```
- **Errors**: 400, 401, 403, 404 (`resource: "wa_config"` — hotel harus setup WA dulu)
- **Notes**: `png_url` bisa CDN URL, pre-signed S3 URL, atau proxied path — jangan asumsi format.
- **Source**: `src/modules/qr-provisioning/qr-provisioning.routes.ts:40`

### 4.9 `GET /api/integrations/qr/download` — download PNG QR

- **Auth**: JWT `gm_admin`
- **Response 200**:
  - `Content-Type: image/png`
  - Body: binary PNG bytes stream
- **Errors**: 401, 403, 404 (`resource: "qr_png_bytes"` — belum pernah generate)
- **Notes untuk FE**: gunakan `<img src="/api/integrations/qr/download">` dengan header Authorization via fetch → blob → object URL. Atau proxy download via server FE kalau perlu.
- **Source**: `src/modules/qr-provisioning/qr-provisioning.routes.ts:64`

---

## 5. Internal RPC endpoints (Hotel Core only — BUKAN untuk FE)

Endpoint di bawah ini tidak boleh dipanggil dari FE karena:
1. Auth-nya `X-Internal-Secret` (shared secret backend-to-backend, tidak boleh bocor ke browser).
2. Semantic-nya mengekspos internal state (raw `hotel_id`, cursor, dll) yang di CRM harus difilter oleh Hotel Core dulu.

**FE pattern**: minta Hotel Core expose endpoint FE-facing yang wrap ini + apply RBAC/tenant filter.

### 5.1 `POST /internal/wa/conversations.list` — daftar WA conversation

- **Auth**: `X-Internal-Secret`
- **Request body**:
  ```json
  {
    "hotel_id": "uuid",
    "cursor": "base64opaquecursor",
    "limit": 50
  }
  ```
  - `hotel_id` UUID (required), `cursor` opaque base64 (optional), `limit` 1..200 (optional, default 50)
- **Response 200**:
  ```json
  {
    "items": [
      {
        "id": "uuid",
        "hotel_id": "uuid",
        "wa_config_id": "uuid",
        "guest_wa_phone": "+6281234567890",
        "guest_id": "uuid",
        "last_message_at": "2026-01-15T10:30:00Z",
        "last_message_preview": "Thanks for the help!",
        "unread_count": 0,
        "created_at": "2026-01-15T10:30:00Z",
        "updated_at": "2026-01-15T10:30:00Z"
      }
    ],
    "next_cursor": "nextbase64cursor"
  }
  ```
- **Errors**: 400 (`Invalid cursor` untuk malformed cursor), 401
- **Source**: `src/modules/whatsapp/whatsapp-conversations.routes.ts`

### 5.2 `POST /internal/wa/messages.list` — daftar message dalam conversation

- **Auth**: `X-Internal-Secret`
- **Request body**:
  ```json
  {
    "hotel_id": "uuid",
    "conversation_id": "uuid",
    "cursor": "base64opaquecursor",
    "limit": 50
  }
  ```
- **Response 200**:
  ```json
  {
    "items": [
      {
        "id": "uuid",
        "conversation_id": "uuid",
        "direction": "inbound",
        "body": "Hello!",
        "template_ref": null,
        "template_variables": null,
        "external_message_id": "wamid.xxx=",
        "status": "received",
        "received_at": "2026-01-15T10:30:00Z",
        "sent_at": null,
        "dispatch_id": null,
        "webhook_event_id": "uuid",
        "created_at": "2026-01-15T10:30:00Z"
      }
    ],
    "next_cursor": "nextcursor"
  }
  ```
  - `direction` enum: `"inbound" | "outbound"`
  - `status`: `"received" | "sent" | "failed"` (dan varian delivery)
- **Errors**: 400, 401, 404 (conversation not found / cross-tenant → anti-enumeration)

### 5.3 `POST /internal/wa/dispatch` — kirim WA message

- **Auth**: `X-Internal-Secret`
- **Deskripsi**: Kirim message text ATAU template. Discriminated union.
- **Request body — text variant**:
  ```json
  {
    "hotel_id": "uuid",
    "guest_id": "uuid",
    "wa_config_id": "uuid",
    "to_wa_phone": "+6281234567890",
    "body": "Your booking XYZ is confirmed.",
    "correlation_id": "booking-123"
  }
  ```
- **Request body — template variant**:
  ```json
  {
    "hotel_id": "uuid",
    "guest_id": "uuid",
    "wa_config_id": "uuid",
    "to_wa_phone": "+6281234567890",
    "template": {
      "name": "booking_confirmation",
      "language_code": "en",
      "variables": ["Booking123", "2026-01-16"]
    },
    "correlation_id": "booking-123"
  }
  ```
- **Response 200** — discriminated union `kind`:
  - Success: `{ "kind": "dispatched", "dispatch_id": "uuid", "external_message_id": "wamid.xxx=" }`
  - DND: `{ "kind": "rejected_dnd", "reason": "..." }`
  - Quota: `{ "kind": "quota_exhausted", "reason": "..." }`
  - Meta gagal: `{ "kind": "meta_failed", "dispatch_id": "uuid", "status": 400, "body": { ... } }`
- **Errors**: 400 (invalid phone, text+template dua-duanya kosong / dua-duanya isi), 401, 404 (`wa_config`)
- **Notes**: 
  - Endpoint ini **conditionally registered** — kalau `WA_BSP_BASE_URL` env belum diset, route tidak ter-register (404). Cek startup log: `whatsapp_dispatch.startup`.
  - Conversation upsert dilakukan async — kalau gagal, dispatch tetap sukses (log warn saja).
- **Source**: `src/modules/whatsapp/whatsapp-dispatch.routes.ts:47`

---

## 6. Webhook endpoints (provider callback — BUKAN untuk FE)

Endpoint ini di-hit oleh Meta / Telegram, bukan FE. Documented supaya jelas ownership.

### 6.1 `POST /webhook/whatsapp/:hotel_slug`

- **Auth**: `X-Hub-Signature-256` HMAC-SHA256(rawBody, webhookVerifyToken)
- **URL param**: `hotel_slug` — resolved ke `hotel_id`.
- **Response 200**: `{ "ok": true }` (selalu 200 asal signature valid — error dispatch tidak surface ke Meta per spec §4.7)
- **Source**: `src/modules/whatsapp/whatsapp-webhook.routes.ts`

### 6.2 `POST /webhook/telegram/:hotel_slug`

- **Auth**: `X-Telegram-Bot-Api-Secret-Token` = bot secret token
- **URL param**: `hotel_slug`
- **Response 200**: `{ "ok": true }`
- **Source**: `src/modules/telegram/telegram-inbound.routes.ts:54`

---

## 7. Contoh full round-trip

### 7.1 Ambil status semua integrasi (halaman utama)

```bash
curl -X GET https://integration-staging.sharedisini.com/api/integrations \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "X-Correlation-Id: c1a2b3d4-e5f6-7890-a1b2-c3d4e5f6a7b8"
```

Response:
```json
{
  "whatsapp": { ... },
  "telegram": null,
  "qr": null,
  "health": { "whatsapp": {"status":"healthy"}, "telegram": {"status":"down"}, "claude_api": {"status":"healthy"} }
}
```

FE render: WA card = configured (klik "Edit"). Telegram card = "Belum di-setup" + CTA "Setup Telegram". QR card = "Generate QR" button.

### 7.2 Setup WhatsApp

```bash
curl -X PUT https://integration-staging.sharedisini.com/api/integrations/whatsapp \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "bsp": "1engage",
    "phoneNumberId": "1234567890",
    "phoneNumber": "+6281234567890",
    "accessToken": "EAAG...",
    "webhookUrl": "https://integration-staging.sharedisini.com/webhook/whatsapp/hotel-slug-123",
    "webhookVerifyToken": "randomstring32chars"
  }'
```

Response 200 = sukses. Access token & webhook verify token di-mask di response — jangan expect plaintext balik.

### 7.3 Generate QR

```bash
curl -X POST https://integration-staging.sharedisini.com/api/integrations/qr/regenerate \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{ "greetingText": "Halo, ada yang bisa kami bantu?" }'
```

Response:
```json
{
  "url": "https://wa.me/6281234567890?text=Halo%2C%20ada%20yang%20bisa%20kami%20bantu%3F",
  "png_url": "...",
  "generated_at": "2026-07-09T11:30:00Z"
}
```

FE tampilkan QR image dari `png_url` + tombol "Copy WA Link" dari `url`.

---

## 8. Enum reference

Enum yang dipakai di response:

| Field | Values |
|---|---|
| `whatsapp.bsp` | `"1engage"` |
| `messages[].direction` | `"inbound" \| "outbound"` |
| `messages[].status` | `"received" \| "sent" \| "delivered" \| "read" \| "failed"` (tergantung stage) |
| `health.*.status` | `"healthy" \| "degraded" \| "down"` |
| `dispatch.kind` | `"dispatched" \| "rejected_dnd" \| "quota_exhausted" \| "meta_failed"` |

---

## 9. Rate limit & timeout

- Public rate limit: **100 request/menit per IP** (CLAUDE.md §6). Error 429 `RATE_LIMIT_EXCEEDED` kalau melebihi.
- Response envelope 429:
  ```json
  { "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "..." } }
  ```
- FE timeout rekomendasi: 30s untuk GET, 60s untuk `PUT /whatsapp` & `POST /qr/regenerate` (ada I/O eksternal ke BSP).

---

## 10. Known gaps / roadmap

Hal berikut TIDAK ada di service ini dan tidak akan datang MVP — FE minta ke service lain:

- **Login / logout / refresh token** → Auth service (belum landed).
- **CRUD hotel / user / department** → Hotel Core.
- **Conversation UI data untuk CRM** → Hotel Core (proxy dari `/internal/wa/conversations.*`).
- **Analytics / laporan** → belum ada.

---

## 11. Support & debugging

Kalau FE dapat response aneh:

1. Catat `response.headers['x-correlation-id']`.
2. Screenshot payload request + response.
3. Ping backend team dengan correlation ID — kita bisa tarik log spesifik dari Loki (setelah observability landed) / `kubectl logs` (sementara).

Jangan retry request yang balikin 4xx tanpa fix — server sudah reject dengan valid reason. Retry hanya untuk 5xx / network error, max 3x dengan exponential backoff (1s, 2s, 4s).
