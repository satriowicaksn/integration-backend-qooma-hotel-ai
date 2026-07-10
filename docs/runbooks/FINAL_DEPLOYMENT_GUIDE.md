# FINAL DEPLOYMENT GUIDE

Master index — urutan runbook yang harus diikuti untuk deploy Integration service dari zero sampai live di `https://integration-staging.sharedisini.com`.

**Target VPS**: Hetzner `91.99.194.116` (Ubuntu 26.04, 8 GB).
**Prasyarat operator**: SSH access ke VPS (root via password atau key), `kubectl` + `helm` + `gh` CLI di workstation, akses DNS panel JagoanHosting.

---

## Urutan deployment

| # | Fase | Runbook | Section | Estimasi | One-time? |
|---|---|---|---|---|---|
| 1 | Bootstrap cluster K3s | [`vps-k3s-bootstrap.md`](./vps-k3s-bootstrap.md) | §1 firewall + SSH, §2 K3s install | 15 min | ✅ once per VPS |
| 2 | Install Traefik + cert-manager | [`vps-k3s-bootstrap.md`](./vps-k3s-bootstrap.md) | §3 | 10 min | ✅ once per VPS |
| 3 | Bootstrap shared Postgres + Redis | [`deploy-shared-database.md`](./deploy-shared-database.md) | Bagian A | 10 min | ✅ once per VPS |
| 4 | Simpan kubeconfig sebagai GitHub secret | [`vps-k3s-bootstrap.md`](./vps-k3s-bootstrap.md) | §6 (`VPS_KUBECONFIG_B64`) | 5 min | ✅ once per VPS |
| 5 | Apply namespace `integration-staging` | [`vps-k3s-bootstrap.md`](./vps-k3s-bootstrap.md) | §7 | 1 min | ✅ once per service |
| 6 | Verifikasi cluster health | [`vps-k3s-bootstrap.md`](./vps-k3s-bootstrap.md) | §8 checklist | 2 min | ✅ once per VPS |
| 7 | Provision DB `integration` + connection strings | [`deploy-shared-database.md`](./deploy-shared-database.md) | Bagian B (B.1–B.2) | 5 min | ✅ once per service |
| 8 | DNS A record `integration-staging` → VPS IP | [`deploy-integration-service.md`](./deploy-integration-service.md) | §1 (JagoanHosting) | 5 min + propagasi | ✅ once per service |
| 9 | Isi `secret.staging.yaml` + app secrets | [`deploy-integration-service.md`](./deploy-integration-service.md) | §2 | 10 min | ✅ once per service |
| 10 | Run Prisma migration Job | [`deploy-integration-service.md`](./deploy-integration-service.md) | §3 (atau `deploy-shared-database.md` B.4) | 3 min | ⚠️ re-run per schema change |
| 11 | Apply Deployment + Service + IngressRoute + TLS cert | [`deploy-integration-service.md`](./deploy-integration-service.md) | §4–§6 | 5 min | ⚠️ update on manifest change |
| 12 | Smoke test `https://.../healthz` | [`deploy-integration-service.md`](./deploy-integration-service.md) | §7 | 2 min | Setiap deploy |
| 13 | Enable CI/CD auto-deploy on push `main` | [`ci-cd-github-actions.md`](./ci-cd-github-actions.md) | Full guide | 5 min | ✅ once per repo |

**Total waktu perkiraan** (fresh deploy): **~1.5 jam**, plus waktu tunggu DNS propagation + cert-manager issue TLS (5-15 menit).

---

## Coverage check

| Concern | Covered? | Di runbook mana |
|---|---|---|
| VPS SSH access (root via password + key) | ✅ | `vps-k3s-bootstrap.md` §1 |
| K3s single-node install | ✅ | `vps-k3s-bootstrap.md` §2 |
| Ingress controller (Traefik) | ✅ | `vps-k3s-bootstrap.md` §3 |
| TLS certificate (Let's Encrypt via cert-manager) | ✅ | `vps-k3s-bootstrap.md` §3 (setup) + `deploy-integration-service.md` §6 (per-service) |
| Postgres 15 + Redis 7 helm install | ✅ | `deploy-shared-database.md` Bagian A |
| Per-service DB provisioning (createdb + connection strings) | ✅ | `deploy-shared-database.md` Bagian B |
| Database migration (Prisma Job) | ✅ | `deploy-shared-database.md` B.4 + `deploy-integration-service.md` §3 |
| DNS A record setup (JagoanHosting) | ✅ | `deploy-integration-service.md` §1 |
| Subdomain routing (IngressRoute) | ✅ | `deploy-integration-service.md` §4 |
| App secrets (JWT, ENCRYPTION_KEY, INTERNAL_RPC_SECRET) | ✅ | `deploy-integration-service.md` §2 |
| GitHub Actions CI/CD | ✅ | `ci-cd-github-actions.md` |
| Local development | ✅ | `local-dev.md` |
| Reusable template untuk service baru (Auth, HC, AI) | ✅ | `service-onboarding-template.md` + `deploy-shared-database.md` Bagian B |

---

## Ops harian (setelah deploy live)

| Task | Runbook | Section |
|---|---|---|
| Update deployed service (push code baru) | Auto via GitHub Actions | `ci-cd-github-actions.md` |
| Backup ad-hoc DB sebelum migration besar | [`deploy-shared-database.md`](./deploy-shared-database.md) | Bagian C.2 |
| Reset DB service (destructive, staging only) | [`deploy-shared-database.md`](./deploy-shared-database.md) | Bagian C.3 |
| Port-forward Postgres ke workstation (DBeaver/psql) | [`deploy-shared-database.md`](./deploy-shared-database.md) | Bagian C.1 |
| Rotasi password Postgres/Redis | [`deploy-shared-database.md`](./deploy-shared-database.md) | Bagian C.4 |
| Onboarding service baru (Auth, HC, AI) di cluster yang sama | [`service-onboarding-template.md`](./service-onboarding-template.md) | Full guide |

---

## Troubleshooting quick links

| Symptom | Cari di |
|---|---|
| Pod PG `CrashLoopBackOff` / `psql` auth failed | `deploy-shared-database.md` Troubleshooting |
| TLS cert tidak issue (`cert-manager` HTTP-01 fail) | `vps-k3s-bootstrap.md` Troubleshooting |
| SSH root ditolak / lockout | `vps-k3s-bootstrap.md` Troubleshooting + Appendix A.4 |
| Migration Job `BackoffLimitExceeded` | `deploy-shared-database.md` Troubleshooting |
| GitHub Actions deploy gagal | `ci-cd-github-actions.md` Troubleshooting matrix |

---

## Update guide ini

Kalau ada perubahan urutan/runbook baru:

1. Edit tabel "Urutan deployment" di atas (tambah/hapus baris).
2. Kalau ada concern baru yang perlu dicover, update tabel "Coverage check".
3. Commit dengan `docs: update final deployment guide`.

Guide ini adalah **source of truth** untuk urutan operasi. Detail teknis tetap di runbook masing-masing — jangan duplikat instruksi di sini.
