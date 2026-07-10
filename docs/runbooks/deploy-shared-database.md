# Deploy shared database (Postgres 15 + Redis 7) on K3s VPS

> Reusable runbook untuk (a) bootstrap Postgres + Redis pertama kali di cluster K3s VPS, dan
> (b) menambahkan database baru per-service (Integration, Auth, Hotel Core, AI, dll).
>
> Prinsip Qooma: **1 service = 1 database logis** di dalam Postgres cluster yang shared. Redis
> shared juga, di-namespace lewat prefix key (`<service>:*`) per-service — bukan `SELECT n` DB
> index. Diselaraskan dengan `docs/decisions/ADR-0011-vps-topology.md`.

**Target VPS**: `91.99.194.116` (Hetzner CX22, Ubuntu 26.04, 8 GB).
**Prasyarat**: K3s + Helm sudah terinstall per [`vps-k3s-bootstrap.md`](./vps-k3s-bootstrap.md) §1–3.

---

## Bagian A — One-time cluster bootstrap (jalankan sekali per VPS)

Lewati bagian ini kalau Postgres + Redis sudah pernah di-install (cek dengan
`kubectl -n data get pods`).

### A.1 Namespace `data`

```bash
kubectl create namespace data
```

### A.2 Install Postgres 15 (Bitnami helm chart)

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Generate dan simpan password sekali — jangan hilang.
PG_PASSWORD="$(openssl rand -base64 24)"
echo "POSTGRES password (SIMPAN SEKARANG): $PG_PASSWORD"

helm install postgres bitnami/postgresql -n data \
  --version 15.5.0 \
  --set auth.postgresPassword="$PG_PASSWORD" \
  --set primary.persistence.storageClass=local-path \
  --set primary.persistence.size=10Gi \
  --set primary.resources.requests.memory=512Mi \
  --set primary.resources.limits.memory=1Gi

# Verifikasi
kubectl -n data rollout status statefulset/postgres-postgresql --timeout=180s
kubectl -n data exec deploy/postgres-postgresql -- \
  psql -U postgres -c 'SELECT version();'
```

Recovery password kalau hilang (helm masih generate-in-secret):

```bash
kubectl -n data get secret postgres-postgresql \
  -o jsonpath='{.data.postgres-password}' | base64 -d ; echo
```

### A.3 Install Redis 7 (Bitnami helm chart, standalone)

```bash
REDIS_PASSWORD="$(openssl rand -base64 24)"
echo "REDIS password (SIMPAN SEKARANG): $REDIS_PASSWORD"

helm install redis bitnami/redis -n data \
  --version 19.5.0 \
  --set architecture=standalone \
  --set auth.password="$REDIS_PASSWORD" \
  --set master.resources.requests.memory=256Mi \
  --set master.resources.limits.memory=512Mi

kubectl -n data rollout status statefulset/redis-master --timeout=180s
kubectl -n data exec deploy/redis-master -- \
  redis-cli -a "$REDIS_PASSWORD" PING
# Expect: PONG
```

Recovery password:

```bash
kubectl -n data get secret redis \
  -o jsonpath='{.data.redis-password}' | base64 -d ; echo
```

### A.4 Verifikasi cluster-internal DNS

Service DNS names yang akan dipakai semua service:

| Purpose | Cluster DNS | Port |
|---|---|---|
| Postgres primary | `postgres-postgresql.data.svc.cluster.local` | `5432` |
| Redis master | `redis-master.data.svc.cluster.local` | `6379` |

Test resolusi dari namespace lain:

```bash
kubectl run dns-test --rm -it --restart=Never --image=busybox:1.36 -- \
  nslookup postgres-postgresql.data.svc.cluster.local
```

---

## Bagian B — Per-service database provisioning (ulangi untuk tiap service baru)

Gunakan resep ini setiap kali onboarding service baru (`auth`, `hotel-core`, `ai`, dll).
Tokens yang perlu Anda pilih:

| Token | Contoh | Catatan |
|---|---|---|
| `<SERVICE_NAME>` | `integration` | Nama db + prefix Redis key. `kebab-case`. |
| `<NAMESPACE>` | `integration-staging` | K8s namespace app. |

### B.1 Buat database Postgres

```bash
kubectl -n data exec deploy/postgres-postgresql -- \
  createdb -U postgres <SERVICE_NAME>

# Verifikasi
kubectl -n data exec deploy/postgres-postgresql -- \
  psql -U postgres -lqt | cut -d '|' -f1 | grep -w <SERVICE_NAME>
```

Rerun aman — akan bilang `already exists`.

### B.2 Susun connection strings

```bash
PG_PASSWORD=$(kubectl -n data get secret postgres-postgresql \
  -o jsonpath='{.data.postgres-password}' | base64 -d)
REDIS_PASSWORD=$(kubectl -n data get secret redis \
  -o jsonpath='{.data.redis-password}' | base64 -d)

DATABASE_URL="postgresql://postgres:${PG_PASSWORD}@postgres-postgresql.data.svc.cluster.local:5432/<SERVICE_NAME>?schema=public"
REDIS_URL="redis://:${REDIS_PASSWORD}@redis-master.data.svc.cluster.local:6379"

echo "DATABASE_URL=$DATABASE_URL"
echo "REDIS_URL=$REDIS_URL"
```

### B.3 Isi `deploy/k8s/<service>/secret.staging.yaml`

Copy template lalu isi `DATABASE_URL` + `REDIS_URL` dari langkah B.2:

```bash
cp deploy/k8s/<service>/secret.template.yaml deploy/k8s/<service>/secret.staging.yaml
# Edit: isi DATABASE_URL, REDIS_URL, dan app secrets (JWT_*, ENCRYPTION_KEY, dll)
git check-ignore deploy/k8s/<service>/secret.staging.yaml   # WAJIB print path (artinya ignored)

kubectl apply -f deploy/k8s/<service>/secret.staging.yaml
```

### B.4 Jalankan migration Job (Prisma)

```bash
kubectl apply -f deploy/k8s/<service>/job-migrate.yaml
kubectl -n <NAMESPACE> wait --for=condition=complete \
  job/<SERVICE_NAME>-migrate --timeout=240s
kubectl -n <NAMESPACE> logs job/<SERVICE_NAME>-migrate
```

Non-Prisma (Django/Alembic/Flyway): sesuaikan `command` di `job-migrate.yaml` sebelum apply.

### B.5 Smoke-test dari pod app

Setelah Deployment jalan:

```bash
kubectl -n <NAMESPACE> exec deploy/<SERVICE_NAME>-api -- \
  node -e 'process.env.DATABASE_URL && console.log("DB URL loaded")'
kubectl -n <NAMESPACE> logs deploy/<SERVICE_NAME>-api | grep -i 'prisma\|redis'
```

---

## Bagian C — Ops harian

### C.1 Konek dari workstation (via port-forward)

```bash
kubectl -n data port-forward svc/postgres-postgresql 5432:5432
# Di terminal lain: psql, DBeaver, TablePlus → localhost:5432, user postgres, pw dari A.2.
```

### C.2 Manual backup (ad-hoc, sebelum migration besar)

```bash
kubectl -n data exec deploy/postgres-postgresql -- \
  pg_dump -U postgres <SERVICE_NAME> | gzip > <SERVICE_NAME>-$(date +%F).sql.gz
```

Restore:

```bash
gunzip -c <SERVICE_NAME>-YYYY-MM-DD.sql.gz | \
  kubectl -n data exec -i deploy/postgres-postgresql -- \
  psql -U postgres -d <SERVICE_NAME>
```

Automated backup (cronjob → object storage) belum di-scope untuk MVP — buka ADR baru
saat traffic sudah production-grade.

### C.3 Reset database service (destruktif — hanya staging)

```bash
kubectl -n data exec deploy/postgres-postgresql -- \
  psql -U postgres -c 'DROP DATABASE IF EXISTS <SERVICE_NAME>;'
kubectl -n data exec deploy/postgres-postgresql -- \
  createdb -U postgres <SERVICE_NAME>
# Lalu re-run migration Job (B.4).
```

### C.4 Rotasi password

Rotasi PG/Redis password wajib update secret di **semua namespace service** yang pakai.
Belum otomatis — koordinasi lintas service dulu sebelum eksekusi.

---

## Bagian D — Verifikasi checklist

- [ ] `kubectl -n data get pods` — `postgres-postgresql-0` + `redis-master-0` `Running`.
- [ ] `kubectl -n data exec deploy/postgres-postgresql -- psql -U postgres -c 'SELECT 1'` → `1`.
- [ ] `kubectl -n data exec deploy/redis-master -- redis-cli -a "$REDIS_PASSWORD" PING` → `PONG`.
- [ ] Per service: `\l` di psql menampilkan database `<SERVICE_NAME>`.
- [ ] `secret.staging.yaml` tidak ter-commit (`git check-ignore` print path).
- [ ] Migration Job `Complete`.

---

## Troubleshooting

| Symptom | Kemungkinan | Fix |
|---|---|---|
| Pod PG `CrashLoopBackOff` | PVC bind gagal / storageClass salah | `kubectl -n data describe pod postgres-postgresql-0` — pastikan `local-path` provisioner ready. |
| `psql: FATAL: password authentication failed` | Password rotate tapi secret app belum di-update | Ambil ulang password (§A.2 recovery), update `secret.staging.yaml`, apply, restart deployment. |
| Migration Job `BackoffLimitExceeded` | DATABASE_URL salah / DB belum di-createdb | `kubectl -n <NAMESPACE> logs job/<SERVICE_NAME>-migrate` — periksa host + db name. |
| Redis `NOAUTH Authentication required` | `REDIS_URL` tidak include password | Pastikan format `redis://:<pw>@host:6379` (kolon sebelum pw, user kosong). |
| App connect timeout ke PG | NetworkPolicy / namespace tidak resolusi cluster DNS | Test dengan `kubectl run dns-test` (§A.4). Pastikan namespace di allowlist kalau ada NetPol. |

---

## Referensi

- [`vps-k3s-bootstrap.md`](./vps-k3s-bootstrap.md) — bootstrap cluster & Helm (prasyarat).
- [`deploy-integration-service.md`](./deploy-integration-service.md) — contoh terisi untuk Integration.
- [`service-onboarding-template.md`](./service-onboarding-template.md) — resep umum onboarding service baru.
- `docs/decisions/ADR-0011-vps-topology.md` — kenapa 1-cluster / shared PG+Redis / namespace-per-service.
