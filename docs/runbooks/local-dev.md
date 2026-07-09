# Runbook — Local Dev (macOS / Linux)

End-to-end setup untuk run repo di laptop dari nol sampai bisa hit 3 endpoint MVP:

- `PUT /api/integrations/whatsapp` — store access token
- `GET /api/integrations/whatsapp` — get connected integration
- `POST /internal/wa/dispatch` — send WA message (text + template)

---

## 1. Prerequisites

| Tool | Version | Verify |
|---|---|---|
| Node.js | 20 LTS (22 juga OK untuk local; prod pakai 20) | `node --version` |
| pnpm | 9.x | `pnpm --version` |
| Docker Desktop / Colima | daemon running | `docker ps` |
| openssl | preinstalled macOS/Linux | `openssl version` |

Optional (kalau mau browse DB via GUI): TablePlus / DBeaver / Postico / DataGrip.

---

## 2. Clone + install

```bash
cd ~/dev   # atau folder pilihan
git clone https://github.com/satriowicaksn/integration-backend-qooma-hotel-ai.git
cd integration-backend-qooma-hotel-ai

make install   # pnpm install + prisma generate
```

---

## 3. Env config

### 3a. Copy template

```bash
cp .env.example .env
```

### 3b. Generate real secrets (WAJIB untuk boot success)

`ENCRYPTION_KEY` **harus EXACTLY 64 chars** — boot akan fail-fast kalau tidak. Generate real values:

```bash
# Cetak semua nilai secret siap-paste
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 36)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 36)"
echo "INTERNAL_RPC_SECRET=$(openssl rand -base64 36)"
```

Copy 4 baris output di atas → paste ke `.env`, replace 4 baris placeholder yang bersangkutan.

### 3c. Set WA BSP env (supaya `POST /internal/wa/dispatch` route ke-register)

`.env` sudah punya default:
```env
WA_BSP_BASE_URL=https://graph.facebook.com
WA_BSP_API_VERSION=v22.0
```

Kalau **tidak set**, route dispatch **tidak akan di-register** — endpoint 404. Kalau mau smoke-test tanpa hit Meta, ganti ke `WA_BSP_BASE_URL=http://localhost:9999` (akan 503 karena connection refused, tapi flow persist → BSP call → mark-failed tetap ke-exercise).

---

## 4. Start deps (Postgres + Redis via Docker)

```bash
make start-fresh   # drop volume, start pg+redis, run prisma migrate deploy
```

**Kalau error di seed step** (`Cannot find module 'prisma/seeds/index.ts'`): abaikan, migrations sudah applied. Verify dengan:

```bash
make ps
# → qooma-postgres  Up (healthy)
# → qooma-redis     Up (healthy)
```

### Optional: bikin empty seed supaya `make start-fresh` bersih

```bash
mkdir -p prisma/seeds && cat > prisma/seeds/index.ts <<'EOF'
// Placeholder seed — extend per feature.
export async function seed(): Promise<void> {
  console.log('[seed] no-op (no fixtures registered)');
}
void seed().catch((e) => { console.error(e); process.exit(1); });
EOF
```

---

## 5. Connect ke DB dari GUI

Docker-compose expose Postgres di **host port 5433** (bukan 5432, biar tidak bentrok dengan Postgres.app / Homebrew Postgres lokal Anda).

| Field | Value |
|---|---|
| **Host** | `localhost` (atau `127.0.0.1`) |
| **Port** | `5433` |
| **User** | `app` |
| **Password** | `app_dev_pw` |
| **Database** | `app` |
| **Schema** | `public` |
| **SSL** | disabled / prefer |
| **Connection URL** | `postgresql://app:app_dev_pw@localhost:5433/app?schema=public` |

### GUI-specific quickstart

**TablePlus** (macOS): `File → New → PostgreSQL` → isi field di atas → Test → Connect.

**DBeaver**: `Database → New Database Connection → PostgreSQL` → Host `localhost`, Port `5433`, Database `app`, Username `app`, Password `app_dev_pw` → Test Connection.

**Postico**: `New Server` → Host `localhost`, Port `5433`, User `app`, Password `app_dev_pw`, Database `app`.

**psql (CLI)**:
```bash
docker exec -it qooma-postgres psql -U app -d app
# atau dari host (butuh psql client terinstall):
psql "postgresql://app:app_dev_pw@localhost:5433/app"
```

### Tables yang harus ada setelah `make start-fresh`

Setelah migrations applied:
- **Auth-adjacent**: (tidak ada; Auth punya service sendiri)
- **WhatsApp**: `wa_configs`, `conversations`, `messages`, `outbound_dispatch_queue`, `delivery_receipts`, `wa_templates`
- **Telegram**: `telegram_configs`, `webhook_events`
- **OTA**: `ota_mailbox_state`
- **QR**: `qr_state`
- **Health**: `channel_health_snapshots`

Verify quickly:
```bash
docker exec -it qooma-postgres psql -U app -d app -c "\dt"
```

### Redis (kalau butuh browse queue)

| Field | Value |
|---|---|
| **Host** | `localhost` |
| **Port** | `6380` |
| **Password** | (none / disabled di dev) |
| **URL** | `redis://localhost:6380` |

GUI: RedisInsight / Medis / TablePlus (Redis mode).

---

## 6. Run API + Worker

**Terminal 1 — API server:**
```bash
make dev-api
# → tsx watch src/entrypoints/api.ts
# → server listening on http://localhost:3000
```

**Terminal 2 — Worker (Bull processors, opsional untuk 3 endpoint MVP):**
```bash
make dev-worker
# → tsx watch src/entrypoints/worker.ts
```

Smoke test:
```bash
curl -s http://localhost:3000/healthz
# → {"status":"ok"}
```

---

## 7. Test 3 endpoint MVP dengan curl

Detail lengkap ada di [MVP endpoint quickstart section di README](../../README.md#mvp-endpoint-quickstart) atau ringkasnya:

```bash
# Setup: JWT + secret ke shell env
source .env
export HOTEL_ID="11111111-2222-3333-4444-555555555555"
export JWT=$(node -e "
const c=require('crypto');
const b64=(o)=>Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+\$/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const n=Math.floor(Date.now()/1000);
const h=b64({alg:'HS256',typ:'JWT'});
const p=b64({sub:'dev-1',hotel_id:'$HOTEL_ID',role:'gm_admin',iat:n,exp:n+3600});
const s=c.createHmac('sha256','$JWT_ACCESS_SECRET').update(h+'.'+p).digest('base64').replace(/=+\$/g,'').replace(/\+/g,'-').replace(/\//g,'_');
console.log(h+'.'+p+'.'+s);
")

# 1. Store token
curl -X PUT http://localhost:3000/api/integrations/whatsapp \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{
    "bsp":"1engage",
    "phoneNumberId":"123456789012345",
    "phoneNumber":"+6281234567890",
    "accessToken":"EAAG...real_meta_token...",
    "webhookUrl":"https://x.ngrok.app/webhook/whatsapp/demo",
    "webhookVerifyToken":"verify_12345"
  }' | jq

# 2. Get connected
curl -s http://localhost:3000/api/integrations/whatsapp \
  -H "Authorization: Bearer $JWT" | jq

# 3. Send text
curl -X POST http://localhost:3000/internal/wa/dispatch \
  -H "X-Internal-Secret: $INTERNAL_RPC_SECRET" -H "Content-Type: application/json" \
  -d '{
    "hotel_id":"'"$HOTEL_ID"'",
    "guest_id":"22222222-3333-4444-5555-666666666666",
    "to_wa_phone":"+6289876543210",
    "body":"Halo dari Qooma dev"
  }' | jq

# 3b. Send template
curl -X POST http://localhost:3000/internal/wa/dispatch \
  -H "X-Internal-Secret: $INTERNAL_RPC_SECRET" -H "Content-Type: application/json" \
  -d '{
    "hotel_id":"'"$HOTEL_ID"'",
    "guest_id":"22222222-3333-4444-5555-666666666666",
    "to_wa_phone":"+6289876543210",
    "template":{"name":"booking_confirmation","language_code":"id","variables":["Budi","12 Jul","Deluxe 201"]}
  }' | jq
```

---

## 8. Check data di DB local (setelah curl)

Tiap curl di §7 landing data ke tabel Postgres tertentu. Gunakan GUI (TablePlus / DBeaver / Postico) atau CLI (`docker exec -it qooma-postgres psql -U app -d app`) untuk verify.

### 8a. Setelah `PUT /api/integrations/whatsapp` (store token)

```sql
-- 1) Row masuk ke wa_configs (1 row per hotel; upsert-by-hotel_id)
SELECT
  hotel_id,
  bsp,
  phone_number_id,
  phone_number,
  webhook_url,
  verified_at,
  created_at,
  updated_at,
  length(access_token_enc)      AS access_token_enc_length,
  length(webhook_verify_token)  AS webhook_verify_token_length
FROM wa_configs
WHERE hotel_id = '11111111-2222-3333-4444-555555555555';

-- 2) SECURITY CHECK — access_token TIDAK BOLEH tersimpan sebagai plaintext.
--    Kolom access_token_enc adalah envelope AES-256-GCM (nonce + tag + ciphertext),
--    biasanya base64-encoded. Panjangnya > plaintext + selalu berbeda tiap encrypt
--    (nonce random). Query ini pastikan plaintext BUKAN masuk ke DB:
SELECT
  CASE WHEN access_token_enc LIKE 'EAAG%' THEN '❌ PLAINTEXT LEAK' ELSE '✅ encrypted' END AS security_check,
  substring(access_token_enc FROM 1 FOR 20) || '...' AS envelope_head
FROM wa_configs
WHERE hotel_id = '11111111-2222-3333-4444-555555555555';
```

### 8b. Setelah `POST /internal/wa/dispatch` (send message)

```sql
-- 1) Row masuk ke outbound_dispatch_queue (semua attempt persist di sini,
--    terlepas outcome sukses/failed)
SELECT
  id AS dispatch_id,
  hotel_id,
  provider,
  status,             -- pending | sent | delivered | read | failed
  external_message_id,  -- wamid.HBg... kalau Meta return sukses
  template_name,      -- filled kalau kirim template
  attempt_count,
  created_at,
  updated_at
FROM outbound_dispatch_queue
WHERE hotel_id = '11111111-2222-3333-4444-555555555555'
ORDER BY created_at DESC
LIMIT 10;

-- 2) Row masuk ke messages (per T29 conversations upsert, dipanggil oleh T28 dispatch)
--    Bakal ada 1 row per successful dispatch dengan direction='outbound', linked
--    via dispatch_id FK ke outbound_dispatch_queue.id
SELECT
  m.id            AS message_id,
  m.conversation_id,
  m.direction,    -- outbound (dari dispatch) | inbound (dari webhook)
  m.status,       -- pending | sent | delivered | read | failed
  m.external_message_id,
  m.dispatch_id,
  length(m.body)  AS body_length,       -- body sendiri tidak di-select untuk PII
  m.created_at
FROM messages m
WHERE m.conversation_id IN (
  SELECT id FROM conversations
  WHERE hotel_id = '11111111-2222-3333-4444-555555555555'
)
ORDER BY m.created_at DESC
LIMIT 10;

-- 3) Row masuk ke conversations (upsert-by-(hotel_id, guest_wa_phone))
--    Tiap kombinasi (hotel, WA phone) hanya 1 conversation row.
SELECT
  id AS conversation_id,
  hotel_id,
  guest_wa_phone,           -- E.164 phone number
  last_message_at,
  last_message_preview,     -- max 200 chars, snippet
  unread_count,             -- inbound-only increment (T29 binding #16)
  created_at,
  updated_at
FROM conversations
WHERE hotel_id = '11111111-2222-3333-4444-555555555555'
ORDER BY last_message_at DESC NULLS LAST
LIMIT 10;

-- 4) Kalau Meta return delivery status (via webhook), row masuk ke delivery_receipts
SELECT
  dispatch_id,
  status,
  received_at,
  external_message_id
FROM delivery_receipts
ORDER BY received_at DESC
LIMIT 10;
```

### 8c. Setelah inbound webhook (`POST /webhook/whatsapp/:hotel_slug`)

```sql
-- 1) Raw webhook payload persist ke webhook_events (audit floor per T19-fu binding #6)
SELECT
  id,
  hotel_id,
  provider,          -- 'whatsapp' | 'telegram'
  signature_valid,
  received_at,
  jsonb_pretty(payload) AS payload_preview
FROM webhook_events
WHERE provider = 'whatsapp'
ORDER BY received_at DESC
LIMIT 5;

-- 2) Inbound message ke-upsert ke messages (direction='inbound') + increment
--    conversations.unread_count
SELECT
  c.guest_wa_phone,
  c.unread_count,
  m.direction,
  m.external_message_id,  -- Meta wamid
  m.created_at
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE m.direction = 'inbound'
  AND c.hotel_id = '11111111-2222-3333-4444-555555555555'
ORDER BY m.created_at DESC
LIMIT 10;
```

### 8d. Cross-cutting checks

```sql
-- Semua config yang tersimpan (WA + Telegram)
SELECT
  'whatsapp' AS channel, hotel_id, verified_at, updated_at
FROM wa_configs
UNION ALL
SELECT
  'telegram' AS channel, hotel_id, NULL AS verified_at, updated_at
FROM telegram_configs
ORDER BY updated_at DESC;

-- Health snapshots per channel (kalau probe cron sudah jalan T24-fu-B)
SELECT
  hotel_id,
  provider,
  status,
  latency_ms,
  checked_at
FROM channel_health_snapshots
ORDER BY checked_at DESC
LIMIT 20;

-- Total row counts per table (health overview)
SELECT
  'wa_configs' AS tbl,               COUNT(*) FROM wa_configs
UNION ALL SELECT 'telegram_configs',           COUNT(*) FROM telegram_configs
UNION ALL SELECT 'conversations',              COUNT(*) FROM conversations
UNION ALL SELECT 'messages',                   COUNT(*) FROM messages
UNION ALL SELECT 'outbound_dispatch_queue',    COUNT(*) FROM outbound_dispatch_queue
UNION ALL SELECT 'delivery_receipts',          COUNT(*) FROM delivery_receipts
UNION ALL SELECT 'webhook_events',             COUNT(*) FROM webhook_events
UNION ALL SELECT 'channel_health_snapshots',   COUNT(*) FROM channel_health_snapshots
UNION ALL SELECT 'qr_state',                   COUNT(*) FROM qr_state
UNION ALL SELECT 'ota_mailbox_state',          COUNT(*) FROM ota_mailbox_state
ORDER BY tbl;
```

### 8e. Prisma Studio (GUI alternative — no SQL needed)

```bash
make db-studio
# → auto-opens Prisma Studio at http://localhost:5555
# → click any table di sidebar untuk browse row-by-row
```

Prisma Studio bagus untuk quick browse + basic filter, tapi tidak bisa run SQL JOIN kompleks — untuk itu pakai TablePlus/DBeaver/psql.

### 8f. Reset data 1 tabel (tanpa drop DB)

```sql
-- ⚠️ HAPUS data 1 tabel (misal reset semua conversations):
TRUNCATE conversations RESTART IDENTITY CASCADE;
-- CASCADE juga hapus messages, karena messages punya FK ke conversations.id

-- Atau hapus data per hotel (sasar row saja):
DELETE FROM outbound_dispatch_queue WHERE hotel_id = '<hotel-uuid>';
DELETE FROM wa_configs               WHERE hotel_id = '<hotel-uuid>';
```

Kalau mau reset **semua data** (drop volume + re-migrate):
```bash
make start-fresh
```

---

## 9. Troubleshooting

| Error | Fix |
|---|---|
| `Environment variable not found: DATABASE_URL` | `.env` tidak ke-load; verify file exists, atau `set -a; source .env; set +a` |
| `ENCRYPTION_KEY must be 64 chars` (boot fail) | Generate ulang: `openssl rand -hex 32` → replace di `.env` |
| `JWT_ACCESS_SECRET must be at least 32 chars` | Generate: `openssl rand -base64 36` |
| Seed error `Cannot find module 'prisma/seeds/index.ts'` | Migrations tetap applied — safe to ignore; atau bikin empty seed (lihat §4) |
| `curl: (7) Failed to connect ... 3000` | `make dev-api` belum jalan atau crash — cek log di terminal API |
| `POST /internal/wa/dispatch` → 404 | `WA_BSP_BASE_URL` belum di-set di `.env` — route conditional register; restart `make dev-api` after edit |
| `POST /internal/wa/dispatch` → 401 | `X-Internal-Secret` ≠ `INTERNAL_RPC_SECRET` di env |
| `PUT/GET /api/integrations/whatsapp` → 401 | JWT expired / `JWT_ACCESS_SECRET` mismatch; regenerate JWT |
| `PUT/GET /api/integrations/whatsapp` → 403 | JWT payload `role` bukan `gm_admin` — cek helper script |
| DB port 5433 already in use | Ganti port di `docker-compose.yml` + `DATABASE_URL` port di `.env` |
| Redis port 6380 already in use | Ganti port di `docker-compose.yml` + `REDIS_URL` port di `.env` |

---

## 10. Common tasks

```bash
make ps                # cek status containers
make stop              # stop containers (keep volume/data)
make start             # start containers (existing DB preserved)
make start-fresh       # drop volume + re-migrate (nuke data)
make db-studio         # buka Prisma Studio UI di http://localhost:5555
make dev-api           # run API in watch mode
make dev-worker        # run worker in watch mode
make lint              # eslint check
make typecheck         # tsc --noEmit
make test-unit         # jest unit tests
make check             # lint + format + typecheck + unit tests
make logs              # tail docker-compose logs
```

---

## 11. Next steps

- **Real Meta credentials**: setup [Meta Business](https://business.facebook.com/) → WhatsApp Business API → dapatkan permanent access_token + phone_number_id
- **Webhook tunneling** (kalau mau receive WA webhooks di local): `ngrok http 3000` → set URL di `webhookUrl` PUT payload + di Meta dashboard
- **Deploy ke staging**: lihat [`deploy-integration-service.md`](./deploy-integration-service.md) (T30 runbook)
- **Auth service** (JWT issuance): separate repo — untuk local dev, generate JWT manual pakai helper script di atas
