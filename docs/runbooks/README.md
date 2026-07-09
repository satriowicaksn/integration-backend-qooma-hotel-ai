# Runbooks

Operational documentation for the Integration service and, via the onboarding template, any future Qooma service on the shared K3s cluster.

## Bootstrap (one-time per VPS)

- [**`vps-k3s-bootstrap.md`**](./vps-k3s-bootstrap.md) — SSH hardening, K3s install, Traefik + cert-manager, Postgres 15 + Redis 7 helm charts, `deploy` user + kubeconfig.

## Deploy

- [**`service-onboarding-template.md`**](./service-onboarding-template.md) — generic step-by-step for landing any new service (Auth, HC, AI, …) on the existing cluster. Uses `scripts/scaffold-service.sh` + `deploy/k8s/_template/*.yaml.template`.
- [**`deploy-integration-service.md`**](./deploy-integration-service.md) — worked example of the template for the Integration service (namespace `integration-staging`, subdomain `integration-staging.qooma.satrioputrowicaksono.my.id`).

## CI/CD

- [**`ci-cd-github-actions.md`**](./ci-cd-github-actions.md) — GitHub Actions auto-deploy workflow, required GH secrets checklist, troubleshooting matrix.

## Quick start (new service)

```bash
scripts/scaffold-service.sh \
  --service <name> \
  --namespace <name>-staging \
  --subdomain <name>-staging.qooma.satrioputrowicaksono.my.id \
  --port 3000 \
  --dry-run     # inspect first
```

Then follow [`service-onboarding-template.md`](./service-onboarding-template.md) sections 2–11.
