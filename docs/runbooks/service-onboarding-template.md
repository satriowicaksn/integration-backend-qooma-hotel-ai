# Service onboarding template (T31 / ADR-0011)

> Portable step-by-step for landing a new Qooma service (Auth, Hotel Core, AI, or future) on the existing K3s staging cluster. Distilled from the concrete Integration deploy — see [`deploy-integration-service.md`](./deploy-integration-service.md) for a filled-in worked example.

**Prerequisites**

- VPS + K3s cluster already bootstrapped per [`vps-k3s-bootstrap.md`](./vps-k3s-bootstrap.md). Traefik, cert-manager, Postgres, and Redis are healthy.
- You have `kubectl` on your workstation with the deploy user's kubeconfig loaded (`kubectl cluster-info` returns 200 OK).
- You have a GitHub Personal Access Token with `read:packages` scope (for the `ghcr-pull` secret) and `write:packages` scope in CI (already covered by `GITHUB_TOKEN` in the workflow template).
- DNS control at your provider (e.g. JagoanHosting) for the qooma domain.

**Inputs you will pick per service**

| Token | Example | Notes |
|---|---|---|
| `<SERVICE_NAME>` | `auth` | Short lower-case slug, no spaces. Used as resource prefix. |
| `<NAMESPACE>` | `auth-staging` | K8s namespace. Convention: `<service>-staging`. |
| `<SUBDOMAIN>` | `auth-staging.sharedisini.com` | Full FQDN routed by Traefik. |
| `<PORT>` | `3001` | Container port the API listens on. |
| `<IMAGE_API>` | `ghcr.io/satriowicaksn/auth-backend-api` | GHCR image ref (without tag). |
| `<IMAGE_WORKER>` | `ghcr.io/satriowicaksn/auth-backend-worker` | GHCR image ref (without tag). |
| `<TLS_SECRET_NAME>` | `auth-staging-tls` | K8s Secret cert-manager writes into. Defaults to `<namespace>-tls`. |

## 1. Scaffold the manifests + workflow

From the repo root:

```bash
scripts/scaffold-service.sh \
  --service auth \
  --namespace auth-staging \
  --subdomain auth-staging.sharedisini.com \
  --port 3001 \
  --image-api ghcr.io/satriowicaksn/auth-backend-api \
  --image-worker ghcr.io/satriowicaksn/auth-backend-worker
```

Interactive mode (no args → the script prompts for the required tokens):

```bash
scripts/scaffold-service.sh
```

Dry-run (prints rendered manifests + workflow to stdout, validates offline; no files written):

```bash
scripts/scaffold-service.sh --service auth --namespace auth-staging \
  --subdomain auth-staging.sharedisini.com --dry-run
```

The scaffolder writes:

- `deploy/k8s/<service>/{namespace,configmap,secret.template,deployment,service,ingress,job-migrate}.yaml`
- `.github/workflows/deploy-<service>.yml`

The scaffolder is idempotent: it refuses to overwrite a non-empty output directory unless you pass `--force`.

## 2. DNS A record

At your DNS provider, add:

- Type: **A**
- Host: `<service>-staging` (e.g. `auth-staging`)
- Target: VPS public IP (see `vps-k3s-bootstrap.md`)
- TTL: 300s

Verify propagation:

```bash
dig +short <SUBDOMAIN>
```

## 3. Fill in the namespace secret

The scaffolder emits `deploy/k8s/<service>/secret.template.yaml` with placeholder values. **Copy to a gitignored file, fill in real values, then apply.**

```bash
cp deploy/k8s/<service>/secret.template.yaml deploy/k8s/<service>/secret.staging.yaml

# Generate app secrets
openssl rand -base64 48    # JWT_ACCESS_SECRET
openssl rand -base64 48    # JWT_REFRESH_SECRET
openssl rand -hex 32       # ENCRYPTION_KEY
```

Fill the values, then verify the file will not be committed:

```bash
git check-ignore deploy/k8s/<service>/secret.staging.yaml
# Expected: path prints back (i.e. it IS ignored by .gitignore).
```

The repo `.gitignore` includes `deploy/k8s/**/secret.staging.yaml`, `deploy/k8s/**/secret.prod.yaml`, and `deploy/k8s/**/*.secret.yaml` — anything matching these patterns is safe.

## 4. Create the database (Postgres) and register the GHCR pull secret

```bash
# Postgres bootstrap: create the per-service database once.
kubectl -n data exec deploy/postgres-postgresql -- \
  createdb -U postgres <SERVICE_NAME>

# GHCR pull secret in the target namespace.
kubectl -n <NAMESPACE> create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username=<github-user> \
  --docker-password=<PAT with read:packages> \
  --docker-email=<email>
```

## 5. Apply base manifests

```bash
kubectl apply -f deploy/k8s/<service>/namespace.yaml
kubectl apply -f deploy/k8s/<service>/configmap.yaml
kubectl apply -f deploy/k8s/<service>/secret.staging.yaml
kubectl apply -f deploy/k8s/<service>/service.yaml
kubectl apply -f deploy/k8s/<service>/ingress.yaml
```

## 6. Run the migration Job

If your service uses Prisma, the template `job-migrate.yaml` runs `prisma migrate deploy`. For non-Prisma services (Django `manage.py migrate`, Alembic, Flyway, plain SQL), adjust `command` / `args` in the generated `job-migrate.yaml` before applying.

```bash
kubectl apply -f deploy/k8s/<service>/job-migrate.yaml
kubectl -n <NAMESPACE> wait --for=condition=complete \
  job/<SERVICE_NAME>-migrate --timeout=180s
kubectl -n <NAMESPACE> logs job/<SERVICE_NAME>-migrate
```

## 7. Roll the Deployment

```bash
kubectl apply -f deploy/k8s/<service>/deployment.yaml

kubectl -n <NAMESPACE> rollout status \
  deployment/<SERVICE_NAME>-api --timeout=180s
kubectl -n <NAMESPACE> rollout status \
  deployment/<SERVICE_NAME>-worker --timeout=180s
```

## 8. Wire up CI

The scaffolder emits `.github/workflows/deploy-<service>.yml`. Before the first successful run:

- Set the `VPS_KUBECONFIG_B64` GitHub secret (`gh secret set VPS_KUBECONFIG_B64 < ~/.kube/config.b64`) — same as [`ci-cd-github-actions.md`](./ci-cd-github-actions.md).
- Confirm the workflow path filter matches your source layout (default: `src/**`, `prisma/**`, `Dockerfile`).
- Push to `main` — the workflow builds api + worker images, pushes to GHCR, runs the migration Job, and rolls the Deployments.

## 9. Smoke test

```bash
curl -v https://<SUBDOMAIN>/healthz
# Expect: 200 with a service-specific payload.

openssl s_client -connect <SUBDOMAIN>:443 -servername <SUBDOMAIN> \
  -showcerts </dev/null 2>/dev/null | openssl x509 -noout -issuer -dates
# Expect: Let's Encrypt issuer, notAfter within 90 days.
```

## 10. Rollback

```bash
kubectl -n <NAMESPACE> rollout undo deployment/<SERVICE_NAME>-api
kubectl -n <NAMESPACE> rollout undo deployment/<SERVICE_NAME>-worker

kubectl -n <NAMESPACE> get deployment <SERVICE_NAME>-api \
  -o jsonpath='{.spec.template.spec.containers[0].image}'
```

## 11. Verification checklist

- [ ] `/healthz` returns 200 via HTTPS with valid Let's Encrypt cert.
- [ ] Migration Job completed.
- [ ] `kubectl -n <NAMESPACE> get pods` shows all pods `Running`.
- [ ] `kubectl top node` still shows headroom (Traefik + cert-manager + data services + all namespaces < VPS RAM).
- [ ] Rollback tested (`kubectl rollout undo` returns to previous image).

## Troubleshooting

Same failure modes as [`deploy-integration-service.md`](./deploy-integration-service.md#troubleshooting). Common ones:

- **Cert stuck**: cert-manager can't reach ACME, or Traefik isn't routing `/.well-known/acme-challenge/`.
- **`ImagePullBackOff`**: `ghcr-pull` secret missing or PAT expired.
- **Deployment `CrashLoopBackOff`**: env misconfig or DB unreachable — `kubectl logs deploy/<SERVICE_NAME>-api --previous`.

## What the template does NOT cover

- **Cross-service DNS** (e.g. Auth reachable from Integration): the template gives you public HTTPS; internal cluster DNS is `<SERVICE_NAME>-api.<NAMESPACE>.svc.cluster.local:80`.
- **Sealed-Secrets / SOPS**: ADR-0011 explicitly picks plaintext gitignore for MVP. A follow-up ADR will introduce sealed-secrets when the team scales beyond one service.
- **Kustomize / Helm**: this template stays on plain YAML per ADR-0011. Kustomize is a possible future ADR.
- **Prod environment**: template targets staging. Prod will land in a separate namespace + secrets set, tracked in a future runbook.
