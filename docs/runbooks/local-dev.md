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

Verify di DB (via GUI atau `psql`):
```sql
SELECT hotel_id, bsp, phone_number, verified_at FROM wa_configs;
SELECT id, status, external_message_id, created_at FROM outbound_dispatch_queue ORDER BY created_at DESC LIMIT 5;
SELECT id, direction, status, body, created_at FROM messages ORDER BY created_at DESC LIMIT 5;
```

---

## 8. Troubleshooting

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

## 9. Common tasks

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

## 10. Next steps

- **Real Meta credentials**: setup [Meta Business](https://business.facebook.com/) → WhatsApp Business API → dapatkan permanent access_token + phone_number_id
- **Webhook tunneling** (kalau mau receive WA webhooks di local): `ngrok http 3000` → set URL di `webhookUrl` PUT payload + di Meta dashboard
- **Deploy ke staging**: lihat [`deploy-integration-service.md`](./deploy-integration-service.md) (T30 runbook)
- **Auth service** (JWT issuance): separate repo — untuk local dev, generate JWT manual pakai helper script di atas
