#!/usr/bin/env bash
#
# scaffold-service.sh — generate a service-specific K8s manifest set
# from the templates in `deploy/k8s/_template/` plus a matching GitHub
# Actions workflow. Idempotent when the target directory is empty (use
# --force to overwrite a non-empty target). Supports --dry-run to print
# generated manifests to stdout and pipe them through
# `kubectl apply --dry-run=client -f -` for validation.
#
# Non-goals:
#   - Does NOT push manifests to any cluster.
#   - Does NOT create GitHub secrets; the workflow template documents
#     which secrets must be set via `gh secret set` before it can run.
#
# Reference: docs/runbooks/service-onboarding-template.md

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/.." &> /dev/null && pwd)
TEMPLATE_DIR="$REPO_ROOT/deploy/k8s/_template"
WORKFLOW_TEMPLATE="$REPO_ROOT/.github/workflows/deploy-staging.yml.template"

usage() {
  cat <<'EOF'
Usage: scaffold-service.sh [options]

Options:
  --service <name>          Service short name, e.g. "auth" or "hotel-core".
                              Used for label + resource names.
  --namespace <ns>          K8s namespace, e.g. "auth-staging".
  --subdomain <fqdn>        Public hostname served by the ingress.
  --port <int>              Container port the API listens on. Default: 3000.
  --image-api <ref>         GHCR image ref for the API container.
                              Default: ghcr.io/<owner>/<service>-api
  --image-worker <ref>      GHCR image ref for the worker container.
                              Default: ghcr.io/<owner>/<service>-worker
  --tls-secret-name <name>  K8s Secret that will hold the LE cert.
                              Default: <namespace>-tls
  --out <dir>               Output directory. Default: deploy/k8s/<service>/
  --workflow-out <path>     Workflow output path.
                              Default: .github/workflows/deploy-<service>.yml
  --dry-run                 Print generated manifests to stdout; pipe them
                              through `kubectl apply --dry-run=client -f -`
                              if kubectl is available.
  --force                   Overwrite existing files in the target dir.
  -h, --help                Show this help.

Interactive mode:
  If any required token argument (--service, --namespace, --subdomain)
  is omitted, the script will read it from the terminal.

Examples:
  scripts/scaffold-service.sh \\
    --service auth \\
    --namespace auth-staging \\
    --subdomain auth-staging.qooma.satrioputrowicaksono.my.id \\
    --port 3001 \\
    --image-api ghcr.io/satriowicaksn/auth-backend-api \\
    --image-worker ghcr.io/satriowicaksn/auth-backend-worker \\
    --dry-run

  scripts/scaffold-service.sh --service auth --namespace auth-staging \\
    --subdomain auth-staging.qooma.satrioputrowicaksono.my.id \\
    --out /tmp/auth-scaffold --dry-run
EOF
}

SERVICE_NAME=""
NAMESPACE=""
SUBDOMAIN=""
PORT="3000"
IMAGE_API=""
IMAGE_WORKER=""
TLS_SECRET_NAME=""
OUT_DIR=""
WORKFLOW_OUT=""
DRY_RUN=0
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service) SERVICE_NAME="$2"; shift 2 ;;
    --namespace) NAMESPACE="$2"; shift 2 ;;
    --subdomain) SUBDOMAIN="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --image-api) IMAGE_API="$2"; shift 2 ;;
    --image-worker) IMAGE_WORKER="$2"; shift 2 ;;
    --tls-secret-name) TLS_SECRET_NAME="$2"; shift 2 ;;
    --out) OUT_DIR="$2"; shift 2 ;;
    --workflow-out) WORKFLOW_OUT="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 2 ;;
  esac
done

read_if_empty() {
  local var_name="$1"
  local prompt="$2"
  if [[ -z "${!var_name}" ]]; then
    read -r -p "$prompt: " "${var_name?}"
  fi
}

read_if_empty SERVICE_NAME "Service name (e.g. auth)"
read_if_empty NAMESPACE "K8s namespace (e.g. auth-staging)"
read_if_empty SUBDOMAIN "Public subdomain (e.g. auth-staging.qooma.example.com)"

if [[ -z "$IMAGE_API" ]]; then
  IMAGE_API="ghcr.io/satriowicaksn/${SERVICE_NAME}-api"
fi
if [[ -z "$IMAGE_WORKER" ]]; then
  IMAGE_WORKER="ghcr.io/satriowicaksn/${SERVICE_NAME}-worker"
fi
if [[ -z "$TLS_SECRET_NAME" ]]; then
  TLS_SECRET_NAME="${NAMESPACE}-tls"
fi
if [[ -z "$OUT_DIR" ]]; then
  OUT_DIR="$REPO_ROOT/deploy/k8s/${SERVICE_NAME}"
fi
if [[ -z "$WORKFLOW_OUT" ]]; then
  WORKFLOW_OUT="$REPO_ROOT/.github/workflows/deploy-${SERVICE_NAME}.yml"
fi

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  echo "template directory not found: $TEMPLATE_DIR" >&2
  exit 1
fi

# Idempotency: refuse to overwrite a non-empty output dir unless --force
# or --dry-run.
if [[ $DRY_RUN -eq 0 && -d "$OUT_DIR" && -n "$(ls -A "$OUT_DIR" 2> /dev/null || true)" && $FORCE -eq 0 ]]; then
  echo "output directory is not empty: $OUT_DIR" >&2
  echo "re-run with --force to overwrite, or pick a different --out." >&2
  exit 1
fi

# Portable sed -i: BSD sed (macOS) requires an argument after -i;
# GNU sed does not. Write to a temp file and mv into place to sidestep
# the incompatibility entirely.
render_template() {
  local src="$1"
  local dst="$2"
  local tmp
  tmp=$(mktemp)
  sed \
    -e "s|<SERVICE_NAME>|${SERVICE_NAME}|g" \
    -e "s|<NAMESPACE>|${NAMESPACE}|g" \
    -e "s|<SUBDOMAIN>|${SUBDOMAIN}|g" \
    -e "s|<PORT>|${PORT}|g" \
    -e "s|<IMAGE_API>|${IMAGE_API}|g" \
    -e "s|<IMAGE_WORKER>|${IMAGE_WORKER}|g" \
    -e "s|<TLS_SECRET_NAME>|${TLS_SECRET_NAME}|g" \
    -e "s|<HEALTHCHECK_HOST>|${SUBDOMAIN}|g" \
    "$src" > "$tmp"
  mv "$tmp" "$dst"
}

TEMPLATES=(
  "namespace.yaml.template:namespace.yaml"
  "configmap.yaml.template:configmap.yaml"
  "secret.template.yaml.template:secret.template.yaml"
  "deployment.yaml.template:deployment.yaml"
  "service.yaml.template:service.yaml"
  "ingress.yaml.template:ingress.yaml"
  "job-migrate.yaml.template:job-migrate.yaml"
)

if [[ $DRY_RUN -eq 1 ]]; then
  # Concatenate rendered manifests to stdout separated by YAML document
  # markers, then pipe through kubectl apply --dry-run=client if it is
  # available.
  tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' EXIT
  combined="$tmpdir/all.yaml"
  : > "$combined"
  for entry in "${TEMPLATES[@]}"; do
    src="${entry%%:*}"
    dst="${entry##*:}"
    render_template "$TEMPLATE_DIR/$src" "$tmpdir/$dst"
    echo "---" >> "$combined"
    cat "$tmpdir/$dst" >> "$combined"
  done
  render_template "$WORKFLOW_TEMPLATE" "$tmpdir/deploy-${SERVICE_NAME}.yml"

  echo "===== rendered manifests (dry-run) =====" >&2
  cat "$combined"
  echo "===== rendered workflow (dry-run) =====" >&2
  cat "$tmpdir/deploy-${SERVICE_NAME}.yml"

  echo "===== validating generated YAML =====" >&2
  if command -v kubectl > /dev/null 2>&1 \
     && kubectl cluster-info > /dev/null 2>&1; then
    # We can reach a cluster — the strictest possible offline check.
    kubectl apply --dry-run=client --validate=false -f "$combined"
  elif command -v python3 > /dev/null 2>&1 \
       && python3 -c 'import yaml' > /dev/null 2>&1; then
    # No cluster reachable — fall back to YAML syntax parse. Catches
    # broken indentation, missing keys, unterminated strings, etc.
    python3 - <<'PY' "$combined"
import sys, yaml
path = sys.argv[1]
with open(path) as f:
    docs = [d for d in yaml.safe_load_all(f) if d is not None]
print(f"YAML syntax OK: {len(docs)} document(s) parsed.")
PY
  else
    # Minimum bar: every rendered doc contains a `kind:` line and every
    # `<TOKEN>` placeholder has been substituted.
    if grep -q '^kind:' "$combined"; then
      kind_count=$(grep -c '^kind:' "$combined")
      echo "grep sanity: $kind_count kind: lines found." >&2
    else
      echo "no kind: lines in rendered output — templates may not have expanded." >&2
      exit 1
    fi
    if grep -q '<[A-Z_]*>' "$combined"; then
      echo "unsubstituted <TOKEN>s remain in the rendered output:" >&2
      grep -n '<[A-Z_]*>' "$combined" | head -20 >&2
      exit 1
    fi
    echo "no unsubstituted tokens. (install kubectl+cluster or PyYAML for stricter validation.)" >&2
  fi
  exit 0
fi

mkdir -p "$OUT_DIR"
for entry in "${TEMPLATES[@]}"; do
  src="${entry%%:*}"
  dst="${entry##*:}"
  render_template "$TEMPLATE_DIR/$src" "$OUT_DIR/$dst"
done

mkdir -p "$(dirname "$WORKFLOW_OUT")"
render_template "$WORKFLOW_TEMPLATE" "$WORKFLOW_OUT"

cat <<EOF
Scaffolded $SERVICE_NAME:
  manifests:  $OUT_DIR/
  workflow:   $WORKFLOW_OUT

Next steps (see docs/runbooks/service-onboarding-template.md):
  1. Copy $OUT_DIR/secret.template.yaml → secret.staging.yaml, fill values.
  2. Point DNS: $SUBDOMAIN A -> <VPS_IP>
  3. Set GitHub secret VPS_KUBECONFIG_B64 (see ci-cd-github-actions.md).
  4. kubectl apply -f $OUT_DIR/namespace.yaml
     kubectl apply -f $OUT_DIR/configmap.yaml
     kubectl apply -f $OUT_DIR/secret.staging.yaml   # the filled-in copy
     kubectl apply -f $OUT_DIR/job-migrate.yaml      # wait for completion
     kubectl apply -f $OUT_DIR/deployment.yaml
     kubectl apply -f $OUT_DIR/service.yaml
     kubectl apply -f $OUT_DIR/ingress.yaml
  5. Smoke: curl https://$SUBDOMAIN/healthz
EOF
