# CI/CD — GitHub Actions auto-deploy to VPS staging (T30 / ADR-0011)

## Workflow overview

Trigger: push to `main` (path-filtered — only rebuild when `src/`, `prisma/`, `Dockerfile`, or `deploy/` changes). Steps:

1. Checkout, set up pnpm + Node 20, install deps.
2. Build multi-stage Docker image, target `api` and `worker`.
3. Tag with `:latest`, `:main-<sha>`, and `:main-<yyyy-mm-dd>`.
4. Push to GHCR (`ghcr.io/satriowicaksn/integration-backend-*`).
5. SSH into VPS, write kubeconfig from GH secret.
6. Apply migration Job → wait completion.
7. `kubectl set image` on `deployment/integration-api` + `deployment/integration-worker`.
8. `kubectl rollout status` (fail workflow if rollout stalls).
9. Smoke test: `curl https://integration-staging.../healthz` — fail workflow if not `200`.

## Required GitHub secrets

Set via `gh secret set <NAME>` or via the repository settings UI:

| Secret | Content | How to get it |
|---|---|---|
| `VPS_SSH_HOST` | `91.99.194.116` | Static; can be repo variable instead if desired |
| `VPS_SSH_USER` | `deploy` | Static |
| `VPS_SSH_PRIVATE_KEY` | PEM key for `deploy@91.99.194.116` (the `qooma_gha_deploy` key created in `vps-k3s-bootstrap.md` §6) | `cat ~/.ssh/qooma_gha_deploy` |
| `VPS_KUBECONFIG_B64` | Base64 kubeconfig | Section 6 of the bootstrap runbook writes `kubeconfig.b64` |
| `GHCR_TOKEN` | Optional; not needed when workflow uses `GITHUB_TOKEN` with `packages: write` | — |

Verify:

```bash
gh secret list
```

## Manual trigger (for testing)

```bash
gh workflow run deploy-staging.yml
gh run watch
```

## Troubleshooting matrix

| Symptom | Likely cause | Fix |
|---|---|---|
| Image build fails on `pnpm install` | Cache miss on `pnpm-lock.yaml` | Re-run job; if persistent, purge `pnpm store` step |
| `docker push ghcr.io/...` denied | `GITHUB_TOKEN` scope missing `packages: write` | Add `permissions: { packages: write, contents: read }` on the job |
| SSH step fails with `Permission denied (publickey)` | `VPS_SSH_PRIVATE_KEY` secret formatting broken (Windows CRLF or missing final newline) | Re-generate PEM with `openssl` + `cat` (no trailing whitespace) and re-upload |
| `kubectl` command `The connection to the server localhost was refused` | `VPS_KUBECONFIG_B64` secret decoded to a config that references `localhost` — must reference the VPS IP | Re-run the base64 step in the bootstrap runbook after the `sed` replacement |
| Migration Job stuck `Pending` | PVC bind failure | `kubectl -n integration-staging describe job/integration-migrate` |
| Rollout stalls at `2 old replicas pending termination` | Readiness probe failing on new pods | `kubectl -n integration-staging logs pod/<new>` — likely env / migration mismatch |
| Cert not renewed after 89 days | cert-manager cronjob broken | `kubectl -n cert-manager get certificaterequests -A` |

## Post-deploy validation checklist

- [ ] `gh run list --workflow=deploy-staging.yml --limit=5` shows latest run `success`.
- [ ] `curl -s https://integration-staging.qooma.satrioputrowicaksono.my.id/healthz` returns `{"status":"ok"}`.
- [ ] `openssl s_client -connect ...:443 -showcerts </dev/null 2>/dev/null | openssl x509 -noout -dates` shows a Let's Encrypt cert within the 90-day window.
- [ ] Rollback path documented in `deploy-integration-service.md` §8 was tested at least once (screenshot / log excerpt in PR body).
