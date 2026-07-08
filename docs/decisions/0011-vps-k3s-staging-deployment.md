# ADR-0011: Staging deployment = single-VPS K3s (Hetzner 8GB Ubuntu 26.04)

- **Status**: accepted
- **Tanggal**: 2026-07-08
- **Pengambil keputusan**: PO + Planning agent
- **Konteks teknis**: PO ruling 2026-07-08; overrides ADR-0005 (AWS ECS Fargate default) untuk staging environment
- **Related**: T30 (runbook + manifest + CI/CD deliverable)

## Konteks

Backend Qooma ekosistem butuh staging environment untuk test end-to-end sebelum production. PO menyediakan VPS Hetzner (`91.99.194.116`, 8GB RAM, Ubuntu 26.04 LTS) + domain root `qooma.satrioputrowicaksono.my.id` (DNS di JagoanHosting).

Requirement PO:
1. VPS setup — Postgres + Redis + service runtime siap
2. Subdomain routing dgn TLS
3. CI/CD auto-deploy on push ke `main`
4. Dockerfile-based deployment

Repo mengadopsi ADR-0005 (AWS ECS Fargate) sebagai **prod default**. Staging boleh beda platform selama runtime shape (container, healthcheck, env-driven config) portable.

## Opsi yang dipertimbangkan

### Opsi A: Docker Compose single-VPS
- Pros: paling simple, 1 file, low overhead (~0 orchestration RAM), fast to bootstrap, familiar
- Cons: no self-healing, no rolling update built-in, sulit scale-out ke multi-VPS nanti, tidak match prod-shape (ECS Fargate = container orchestration)

### Opsi B: K3s single-node (pilihan)
- Pros: pondasi K8s untuk scale nanti (multi-node = tambah node saja), self-healing built-in, rolling update native, Ingress + cert-manager standard tools, exercise K8s ops muscle sebelum prod pindah ke managed K8s / kembali ke ECS, resource footprint ringan (~500–800 MB control-plane)
- Cons: more moving parts drpd Compose, learning curve K8s manifests, 500–800 MB overhead cost

### Opsi C: Nomad / Docker Swarm
- Pros: middle ground
- Cons: skill / ecosystem lebih tipis, staff unfamiliar, cert-manager ecosystem tidak ada

### Opsi D: Managed platform (Railway, Fly.io)
- Pros: zero VPS ops
- Cons: cost per-service, vendor lock-in, staging spec sudah decide VPS

## Keputusan

**Opsi B — K3s single-node** di VPS Hetzner.

**Component choices:**

| Layer | Pilihan | Alasan |
|---|---|---|
| K8s distro | K3s (Rancher lightweight) | Single-binary install, embedded etcd/sqlite, minimal overhead untuk single-node |
| Ingress controller | **Traefik** (K3s default) | Sudah bundled, tidak perlu disable + install ulang, IngressRoute native |
| TLS | `cert-manager` + Let's Encrypt (HTTP-01 challenge) | JagoanHosting DNS panel manual = no wildcard via DNS-01 API. HTTP-01 per-subdomain cukup untuk 4 service. |
| Database | Postgres 15 as StatefulSet (Bitnami helm) di dalam K3s | Simpler bootstrap, PV via K3s local-path provisioner. 1 cluster + 4 logical DB (per-service credentials) — respect ADR-0004 boundary (1 svc = 1 DB) even in shared cluster |
| Redis | Redis 7 as Deployment (Bitnami helm, standalone mode) di dalam K3s | Cache + queue; ephemeral acceptable untuk staging |
| Registry | GHCR (`ghcr.io/satriowicaksn/<repo>`) | Free, GH Actions `GITHUB_TOKEN` auto-auth push |
| CI/CD | GitHub Actions push→main | Build image → push GHCR → SSH ke VPS → `kubectl set image` + rollout status |
| Deploy user | dedicated `deploy` user di VPS (non-root, sudo K3s only) | Least privilege; GH Actions SSH key ≠ personal SSH key |
| DB migration | Kubernetes Job (`prisma migrate deploy`) — pre-rollout | Migration atomicity per deploy; separate from app image runtime |
| Secrets storage | `kubectl apply -f secret.staging.yaml` (gitignored) | MVP; prod pindah ke sealed-secrets / external vault |
| Subdomain scheme | `<service>-<env>.qooma.satrioputrowicaksono.my.id` (mis. `integration-staging.qooma...`) | Env-in-subdomain, clear at glance, per-service cert cheap |

## Resource envelope (VPS 8GB)

| Komponen | RAM baseline | RAM peak est. |
|---|---|---|
| Ubuntu overhead | 500 MB | 700 MB |
| K3s control plane + kubelet | 500 MB | 800 MB |
| Traefik + cert-manager | 150 MB | 250 MB |
| Postgres 15 StatefulSet | 800 MB | 1.5 GB |
| Redis 7 Deployment | 150 MB | 300 MB |
| Integration service (api + worker) | 500 MB | 900 MB |
| Auth service (api) — future | 300 MB | 500 MB |
| Hotel Core service (api + worker) — future | 500 MB | 900 MB |
| AI service (api + worker) — future | 500 MB | 1 GB |
| Buffer / kernel cache | 1 GB | 1 GB |
| **Total (4 svc scenario)** | **~5 GB** | **~7.9 GB** |

**Feasible untuk staging low-traffic**. Tight kalau semua 4 svc under load bersamaan — akan ada page-out / OOM risk. Trigger revisit di §Konsekuensi.

## Konsekuensi

### Positif
- Pondasi K8s siap: kalau prod nanti pindah ke managed K8s (EKS, GKE, LKE) atau tetap K3s multi-node, manifest kompatibel
- cert-manager auto-renew TLS — zero touch setelah setup
- Standardized deploy pipeline via `kubectl` — sama shape untuk Auth/HC/AI onboarding nanti
- Postgres per-service credential = ADR-0004 boundary intact meski cluster shared
- CI/CD full auto — commit ke `main` = deploy

### Negatif (yang kami terima)
- Overhead K3s ~800 MB drpd Compose ~0 MB — akseptable untuk pondasi
- Single-node = single point of failure (VPS mati = semua down). Staging acceptable; prod harus multi-node atau managed
- HTTP-01 challenge per-subdomain (bukan wildcard) = 4× cert renewal cycle. cert-manager handle automatic, negligible.
- Manual `kubectl apply` untuk secret staging — sebelum prod naik, harus pindah ke sealed-secrets/external vault
- Bootstrap runbook manual dry-run needed (tidak Terraform / Ansible) — MVP OK; prod perlu IaC

### Migrasi / rollout
1. T30 (Slot C) ship runbook + manifest + workflow.
2. PO dry-run runbook ke VPS `91.99.194.116`; verify Integration service accessible di `integration-staging.qooma.satrioputrowicaksono.my.id`.
3. Auth/HC/AI onboard nanti = duplicate `deploy/k8s/<service>/` folder pattern per service repo, subdomain `<svc>-staging.qooma...`, join K3s cluster yang sama.
4. Kalau resource pressure (>7 GB sustained atau OOM events), Parent PM eskalasi PO untuk upgrade VPS ke 16 GB atau split ke 2 VPS (per-svc pair).

## Trigger untuk revisit

- **>7 GB sustained RAM** atau **>2 OOM events per week** → upgrade VPS atau split
- **Staging traffic** melewati 100 req/s sustained → tinjau Compose→K3s trade-off masih valid
- **Prod deployment target**: staging tetap K3s. Prod default per ADR-0005 = ECS Fargate; kalau ternyata prod diputuskan tetap K3s (managed atau multi-VPS), amend ADR-0005 atau supersede via ADR baru
- **Multi-service onboarding lengkap** (Auth+HC+AI joined K3s cluster): extract shared bootstrap ke repo `qooma-infra`
- **GitOps adoption** (ArgoCD/Flux): pindah manifest dari per-service repo ke central `qooma-kubernetes` repo dengan Kustomize overlay per env
