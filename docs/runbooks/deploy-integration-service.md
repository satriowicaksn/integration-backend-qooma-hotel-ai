# Deploy Integration service to staging (T30 / ADR-0011)

**Prerequisites**: `vps-k3s-bootstrap.md` completed. Postgres + Redis + Traefik + cert-manager healthy.

**Outcome**: Integration service reachable at `https://integration-staging.qooma.satrioputrowicaksono.my.id/healthz` with valid Let's Encrypt TLS.

## 1. DNS A record (JagoanHosting panel)

At JagoanHosting DNS management for `qooma.satrioputrowicaksono.my.id`:

- Record type: **A**
- Host: `integration-staging`
- Target: `91.99.194.116`
- TTL: 300s

Verify propagation:

```bash
dig +short integration-staging.qooma.satrioputrowicaksono.my.id
# Expect: 91.99.194.116
```

## 2. Create the namespace secrets

Copy the template:

```bash
cp deploy/k8s/integration/secret.template.yaml deploy/k8s/integration/secret.staging.yaml
```

Populate the values (Postgres + Redis passwords captured during bootstrap; app secrets rolled fresh):

```bash
# Generate app secrets
JWT_ACCESS_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)
ENCRYPTION_KEY=$(openssl rand -hex 32)
INTERNAL_RPC_SECRET=$(openssl rand -base64 48)

# Fill deploy/k8s/integration/secret.staging.yaml with:
#   DATABASE_URL = postgresql://postgres:<postgres-pw>@postgres-postgresql.data.svc.cluster.local:5432/integration?schema=public
#   REDIS_URL    = redis://:<redis-pw>@redis-master.data.svc.cluster.local:6379
#   JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / ENCRYPTION_KEY / INTERNAL_RPC_SECRET
#   CORS_ORIGIN  = https://crm-staging.qooma.satrioputrowicaksono.my.id (or wherever the FE lands)
#   API_BASE_URL = https://integration-staging.qooma.satrioputrowicaksono.my.id
```

Create the database (one-time):

```bash
kubectl -n data exec deploy/postgres-postgresql -- createdb -U postgres integration
```

Apply the secret (kubeconfig points at the VPS cluster):

```bash
kubectl apply -f deploy/k8s/integration/secret.staging.yaml
```

**Verify secret.staging.yaml is gitignored**:

```bash
git check-ignore deploy/k8s/integration/secret.staging.yaml
# Expected output: deploy/k8s/integration/secret.staging.yaml
```

## 3. GHCR pull secret

```bash
kubectl -n integration-staging create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username=<github-user> \
  --docker-password=<PAT with read:packages> \
  --docker-email=<email>
```

## 4. Apply the base manifests

```bash
kubectl apply -f deploy/k8s/integration/namespace.yaml
kubectl apply -f deploy/k8s/integration/configmap.yaml
# secret.staging.yaml applied in step 2
kubectl apply -f deploy/k8s/integration/service.yaml
kubectl apply -f deploy/k8s/integration/ingress.yaml
```

## 5. Run the Prisma migration Job

```bash
kubectl apply -f deploy/k8s/integration/job-migrate.yaml

kubectl -n integration-staging wait --for=condition=complete job/integration-migrate --timeout=180s
kubectl -n integration-staging logs job/integration-migrate
```

Re-runs of the Job are idempotent (Prisma's migration state is tracked in `_prisma_migrations`).

## 6. Apply the Deployment

```bash
kubectl apply -f deploy/k8s/integration/deployment.yaml

kubectl -n integration-staging rollout status deployment/integration-api --timeout=180s
kubectl -n integration-staging rollout status deployment/integration-worker --timeout=180s
```

## 7. Smoke test

```bash
# Wait ~1 minute for cert-manager to issue the cert.
kubectl -n integration-staging get certificate

curl -v https://integration-staging.qooma.satrioputrowicaksono.my.id/healthz
# Expect: 200 {"status":"ok"} with valid Let's Encrypt cert.

openssl s_client -connect integration-staging.qooma.satrioputrowicaksono.my.id:443 -servername integration-staging.qooma.satrioputrowicaksono.my.id -showcerts </dev/null 2>/dev/null | openssl x509 -noout -issuer -dates
# Expect: issuer=C = US, O = Let's Encrypt, CN = R11 (or similar) + notAfter within 90 days
```

## 8. Rollback

```bash
kubectl -n integration-staging rollout undo deployment/integration-api
kubectl -n integration-staging rollout undo deployment/integration-worker
kubectl -n integration-staging rollout status deployment/integration-api --timeout=120s
```

Verify the previous image tag is restored:

```bash
kubectl -n integration-staging get deployment integration-api -o jsonpath='{.spec.template.spec.containers[0].image}'
```

## 9. Verification checklist

- [ ] `/healthz` returns 200 via HTTPS with valid Let's Encrypt cert.
- [ ] Migration Job completed (`_prisma_migrations` has all rows).
- [ ] `kubectl top node` shows < 6 GB RAM used after everything is up.
- [ ] `kubectl -n integration-staging logs deploy/integration-api` shows all 5 loud startup warns (`telegram_inbound.startup`, `telegram_dept_routing.startup`, `qr_provisioning.startup`, plus T22-fu + T25-fu wired).
- [ ] Rollback tested (`kubectl rollout undo` returns to previous image).

## Troubleshooting

- **Certificate stuck in `Order Pending`**: cert-manager can't reach the ACME server or the HTTP-01 challenge is blocked. Check `kubectl -n cert-manager logs deploy/cert-manager` + verify Traefik is routing `/.well-known/acme-challenge/`.
- **`ImagePullBackOff`**: GHCR PAT expired or `ghcr-pull` secret missing. Check `kubectl -n integration-staging describe pod`.
- **Deployment CrashLoopBackOff**: `kubectl -n integration-staging logs deploy/integration-api --previous` for the error before the current restart. Common causes: missing env, DB unreachable, migration not run.
- **`X-Forwarded-For` empty**: Traefik must forward the real client IP; `IngressRoute` has `preserveClientIP: true` set. Otherwise rate-limit will see Traefik's IP.
