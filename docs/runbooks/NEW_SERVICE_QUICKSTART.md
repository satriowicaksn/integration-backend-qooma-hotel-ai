# NEW SERVICE QUICKSTART

> Single-page guide untuk deploy service Qooma baru (Auth, HotelCore, AI, dst.) ke K3s cluster yang **sudah bootstrap**. Semua infra sharedisini (VPS, K3s, Traefik, cert-manager, Postgres, Redis, GHCR secret CI) sudah jalan — dokumen ini fokus 100% ke apa yang harus dilakukan **per service**.
>
> Untuk bootstrap infra dari nol, mulai dari [`FINAL_DEPLOYMENT_GUIDE.md`](./FINAL_DEPLOYMENT_GUIDE.md). Untuk detail per topik, ikuti link ke runbook masing-masing.
>
> Distilled dari deploy real Integration service (staging live di `https://integration-staging.sharedisini.com`) — semua pitfall di §6 pernah kena, jangan diulangi.

---

## 0. Pre-flight (sekali cek sebelum mulai)

```bash
# Cluster reachable?
kubectl cluster-info                    # → https://91.99.194.116:6443 200 OK
kubectl get nodes                       # → Ready
kubectl -n data get svc postgres-postgresql redis-master  # → both ClusterIP
kubectl get clusterissuer letsencrypt-prod                # → Ready True
```

Kalau salah satu ❌: infra bootstrap belum beres, kembali ke [`FINAL_DEPLOYMENT_GUIDE.md`](./FINAL_DEPLOYMENT_GUIDE.md).

---

## 1. Pilih inputs

| Token | Contoh (auth) | Aturan |
|---|---|---|
| `<SERVICE>` | `auth` | lowercase, no dash — dipakai untuk DB name + resource prefix |
| `<NAMESPACE>` | `auth-staging` | `<service>-staging` |
| `<SUBDOMAIN>` | `auth-staging.sharedisini.com` | `<service>-staging.sharedisini.com` |
| `<PORT>` | `3001` | port container listen (pastikan unik supaya inget) |
| `<IMAGE_API>` | `ghcr.io/satriowicaksn/auth-backend-api` | GHCR image ref tanpa tag |
| `<IMAGE_WORKER>` | `ghcr.io/satriowicaksn/auth-backend-worker` | GHCR image ref tanpa tag |

---

## 2. Scaffold manifests + workflow

```bash
scripts/scaffold-service.sh \
  --service <SERVICE> \
  --namespace <NAMESPACE> \
  --subdomain <SUBDOMAIN> \
  --port <PORT> \
  --image-api <IMAGE_API> \
  --image-worker <IMAGE_WORKER>
```

Output:
- `deploy/k8s/<SERVICE>/{namespace,configmap,secret.template,deployment,service,ingress,job-migrate}.yaml`
- `.github/workflows/deploy-<SERVICE>.yml`

`--dry-run` untuk preview dulu tanpa nulis file.

---

## 3. DNS A record

Di JagoanHosting → **DNS Management** → add record:

| Host Name | Type | Value | TTL |
|---|---|---|---|
| `<SERVICE>-staging` | A | `91.99.194.116` | 300 |

Verify:

```bash
dig +short <SUBDOMAIN> @8.8.8.8   # → 91.99.194.116
```

Kalau NXDOMAIN >10 menit: cek NS delegation di [`dns-resolution.md`](./dns-resolution.md) §2.3.

---

## 4. Provision database

```bash
# Postgres DB (once per service)
kubectl -n data exec deploy/postgres-postgresql -- \
  createdb -U postgres <SERVICE>

# Ambil password Postgres (kalau butuh untuk build DATABASE_URL)
kubectl -n data get secret postgres-postgresql \
  -o jsonpath='{.data.postgres-password}' | base64 -d

# Ambil password Redis (URL-encode kalau ada karakter spesial!)
kubectl -n data get secret redis \
  -o jsonpath='{.data.redis-password}' | base64 -d
```

Detail lengkap: [`deploy-shared-database.md`](./deploy-shared-database.md) Bagian B.

**⚠️ Redis password perlu URL-encode** — `/`, `+`, `=` harus jadi `%2F`, `%2B`, `%3D` untuk masuk ke connection string.

---

## 5. Fill secret

```bash
cp deploy/k8s/<SERVICE>/secret.template.yaml deploy/k8s/<SERVICE>/secret.staging.yaml

# Generate app secrets
openssl rand -base64 48    # JWT_ACCESS_SECRET (min 32 char)
openssl rand -base64 48    # JWT_REFRESH_SECRET (min 32 char)
openssl rand -hex 32       # ENCRYPTION_KEY (WAJIB tepat 64 hex char = 32 bytes)
openssl rand -base64 32    # INTERNAL_RPC_SECRET (kalau service butuh)

# Isi DATABASE_URL, REDIS_URL, semua secret di atas
vim deploy/k8s/<SERVICE>/secret.staging.yaml

# Confirm gitignored
git check-ignore deploy/k8s/<SERVICE>/secret.staging.yaml   # harus print path
```

Format `DATABASE_URL`:
```
postgresql://postgres:<PG_PASSWORD>@postgres-postgresql.data.svc.cluster.local:5432/<SERVICE>?schema=public
```

Format `REDIS_URL`:
```
redis://:<REDIS_PASSWORD_URL_ENCODED>@redis-master.data.svc.cluster.local:6379
```

---

## 6. Dockerfile pitfalls (WAJIB cek sebelum first build)

Semua ini ketemu waktu deploy Integration — jangan diulangi:

| # | Pitfall | Fix di Dockerfile / package.json |
|---|---|---|
| 6.1 | Alpine node image gak punya `openssl` → Prisma engine crash `libssl not found` | `RUN apk add --no-cache tini openssl && ...` di api + worker stage |
| 6.2 | `prisma` di devDeps → `prod-deps` stage strip → migration Job crash `Cannot find module 'prisma/build/index.js'` | Pindahin `prisma` ke `dependencies` di `package.json` (bukan devDependencies) |
| 6.3 | `prod-deps` stage gak generate Prisma client → pod crash `@prisma/client did not initialize yet` | Di `prod-deps` stage tambah: `COPY prisma ./prisma` + `RUN pnpm prisma:generate` |
| 6.4 | `NODE_ENV=test` gak ada di zod enum → integration test CI fail | Di `src/core/config/env.ts`: `z.enum(['development', 'test', 'staging', 'production'])` |
| 6.5 | `LOG_LEVEL=silent` di test file tapi schema cuma `debug\|info\|warn\|error` | Pakai `LOG_LEVEL=error` di test setup |

Reference implementation ada di `Dockerfile` root repo Integration ini — copy pattern-nya.

---

## 7. Apply base manifests

```bash
kubectl apply -f deploy/k8s/<SERVICE>/namespace.yaml
kubectl apply -f deploy/k8s/<SERVICE>/configmap.yaml
kubectl apply -f deploy/k8s/<SERVICE>/secret.staging.yaml
kubectl apply -f deploy/k8s/<SERVICE>/service.yaml
kubectl apply -f deploy/k8s/<SERVICE>/ingress.yaml

# GHCR pull secret (once per namespace)
kubectl -n <NAMESPACE> create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username=<github-user> \
  --docker-password=<PAT_with_read_packages> \
  --docker-email=<email>
```

---

## 8. Build image + first deploy (manual bootstrap)

CI/CD auto-build hanya jalan setelah push ke `main` (§10). Untuk pertama kali, trigger workflow manual biar image ada di GHCR sebelum apply Deployment:

```bash
# Set kubeconfig secret di repo (once)
gh secret set VPS_KUBECONFIG_B64 --body "$(base64 -i ~/.kube/config)"

# Push branch → PR → merge ke main, atau:
gh workflow run deploy-<SERVICE>.yml
gh run watch
```

**⚠️ Rollout ordering di workflow** — pastikan urutan:
1. `kubectl apply -f deployment.yaml` (bikin Deployment kalau belum ada)
2. `kubectl set image deployment/<name> ...` (baru update tag)

Kalau `set image` duluan, first-run gagal `deployments.apps "<name>" not found`. Reference: `.github/workflows/deploy-staging.yml` di repo Integration.

---

## 9. Migration Job

Di workflow generated udah include, tapi kalau mau manual:

```bash
kubectl -n <NAMESPACE> delete job <SERVICE>-migrate --ignore-not-found=true
kubectl apply -f deploy/k8s/<SERVICE>/job-migrate.yaml
kubectl -n <NAMESPACE> wait --for=condition=complete job/<SERVICE>-migrate --timeout=240s
kubectl -n <NAMESPACE> logs job/<SERVICE>-migrate
```

Non-Prisma service (Django, Alembic, Flyway, plain SQL): edit `command`/`args` di `job-migrate.yaml` sebelum apply.

---

## 10. Verifikasi cert-manager + HTTPS

```bash
kubectl -n <NAMESPACE> get certificate,challenge,order
```

Expected setelah 1-3 menit:
- `certificate/<name>-tls` → `READY True`
- `challenge/...` → hilang (habis dipakai)
- `order/...` → `Valid`

**Kalau stuck >5 menit** dengan reason `Waiting for HTTP-01 challenge propagation: ... no such host` → CoreDNS di dalam cluster masih cache NXDOMAIN. Fix:

```bash
kubectl -n kube-system rollout restart deployment coredns
kubectl -n <NAMESPACE> delete challenge --all
kubectl -n <NAMESPACE> delete order --all
# cert-manager auto-retry ~30 detik
```

Full troubleshoot: [`dns-resolution.md`](./dns-resolution.md) §4.

---

## 11. Smoke test

```bash
curl -v https://<SUBDOMAIN>/healthz
# Expect: 200 OK + valid Let's Encrypt cert (no -k)

openssl s_client -connect <SUBDOMAIN>:443 -servername <SUBDOMAIN> \
  -showcerts </dev/null 2>/dev/null | openssl x509 -noout -issuer -dates
# Expect: issuer=CN=R3, notAfter within 90 days
```

---

## 12. Enable CI/CD auto-deploy

Workflow generated (`deploy-<SERVICE>.yml`) trigger di `push: branches: [main]` dengan path filter default `src/**`, `prisma/**`, `Dockerfile`, `deploy/k8s/<SERVICE>/**`.

Checklist:
- [ ] Secret `VPS_KUBECONFIG_B64` sudah di-set (`gh secret list`).
- [ ] Repo GHCR image path (`IMAGE_API`, `IMAGE_WORKER` env di workflow) match `<IMAGE_API>` / `<IMAGE_WORKER>` di scaffold.
- [ ] Test workflow_dispatch dulu (`gh workflow run deploy-<SERVICE>.yml`) sebelum rely full ke push trigger.

Detail: [`ci-cd-github-actions.md`](./ci-cd-github-actions.md).

---

## 13. Verification checklist (WAJIB centang semua sebelum handover)

- [ ] `dig +short <SUBDOMAIN>` return VPS IP dari 3 resolver (8.8.8.8, 1.1.1.1, ISP)
- [ ] `curl https://<SUBDOMAIN>/healthz` return 200 tanpa `-k`
- [ ] Cert issuer = Let's Encrypt (R3), expiry >60 hari
- [ ] `kubectl -n <NAMESPACE> get pods` semua `Running`
- [ ] Migration Job `Completed`
- [ ] `kubectl top node` masih ada headroom (target: <70% RAM, <70% CPU dengan semua service jalan)
- [ ] Rollback tested: `kubectl -n <NAMESPACE> rollout undo deployment/<SERVICE>-api` sukses
- [ ] CI workflow bisa auto-deploy dari push `main` (test dengan dummy commit)
- [ ] `secret.staging.yaml` **tidak** ke-commit (`git check-ignore` return path)

---

## 14. Kalau jebol — quick reference

| Symptom | Kemungkinan | Runbook |
|---|---|---|
| `ImagePullBackOff` | `ghcr-pull` PAT expired / secret missing | §7 GHCR secret |
| Pod `CrashLoopBackOff` — env error | secret salah / DATABASE_URL/REDIS_URL invalid | §5 + `kubectl logs deploy/<name>-api --previous` |
| Pod `CrashLoopBackOff` — Prisma engine | Dockerfile pitfall 6.1/6.2/6.3 | §6 |
| Migration Job fail `Cannot find prisma` | Pitfall 6.2 | §6 |
| DNS NXDOMAIN | NS delegation salah / propagasi belum sampai | [`dns-resolution.md`](./dns-resolution.md) §2 |
| Cert `READY False` >5 menit | CoreDNS cache NXDOMAIN atau firewall block :80 | §10 + [`dns-resolution.md`](./dns-resolution.md) §4 |
| CI `set image` fail `deployment not found` | Ordering salah di workflow | §8 rollout ordering |
| Integration test CI fail `INTERNAL_RPC_SECRET required` | Env vars belum di-set di CI job | Copy env block dari `.github/workflows/ci.yml` Integration |

---

## Rollback (dari image sebelumnya)

```bash
kubectl -n <NAMESPACE> rollout undo deployment/<SERVICE>-api
kubectl -n <NAMESPACE> rollout undo deployment/<SERVICE>-worker

kubectl -n <NAMESPACE> rollout status deployment/<SERVICE>-api
kubectl -n <NAMESPACE> get deployment <SERVICE>-api \
  -o jsonpath='{.spec.template.spec.containers[0].image}'
```

---

## Referensi runbook (dokumen ini index; detail di file terpisah)

| Topik | File |
|---|---|
| Bootstrap infra dari nol | [`FINAL_DEPLOYMENT_GUIDE.md`](./FINAL_DEPLOYMENT_GUIDE.md) |
| Shared DB (Postgres + Redis) provisioning | [`deploy-shared-database.md`](./deploy-shared-database.md) |
| Worked example lengkap (Integration service) | [`deploy-integration-service.md`](./deploy-integration-service.md) |
| DNS + TLS troubleshoot | [`dns-resolution.md`](./dns-resolution.md) |
| CI/CD detail | [`ci-cd-github-actions.md`](./ci-cd-github-actions.md) |
| Onboarding template (generic) | [`service-onboarding-template.md`](./service-onboarding-template.md) |
| Local dev | [`local-dev.md`](./local-dev.md) |
