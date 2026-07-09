# VPS K3s bootstrap runbook (T30 / ADR-0011)

**Target**: Hetzner VPS `91.99.194.116` (Ubuntu 26.04, 8 GB, dedicated CX22-class).
**Outcome**: K3s single-node cluster with Traefik ingress + cert-manager + Postgres 15 + Redis 7, ready to accept service deployments.

**Run once, per VPS.** Subsequent service deploys use `deploy-integration-service.md`.

## Prerequisites (before SSH)

- SSH keypair generated locally (`ssh-keygen -t ed25519 -C "vps-bootstrap"`).
- Root access to the VPS (initial `root@91.99.194.116`).
- DNS control at JagoanHosting (needed later; not blocker for bootstrap).

## 1. SSH hardening

```bash
# Local
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@91.99.194.116

# On the VPS
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

apt update && apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Re-login as `deploy@91.99.194.116`; verify root SSH is refused.

## 2. Install Docker + K3s

```bash
# As deploy (with sudo)
sudo apt update && sudo apt install -y curl wget vim

# K3s (embedded containerd; we don't need standalone Docker)
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--write-kubeconfig-mode 644 --disable=traefik" sh -
# NOTE: we disable K3s's bundled Traefik so we can install a pinned Traefik version via Helm.

# Verify
sudo kubectl get nodes    # expect Ready
sudo kubectl get pods -A  # coredns + local-path-provisioner Running
```

Copy kubeconfig for the `deploy` user:

```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown deploy:deploy ~/.kube/config
sed -i "s/127.0.0.1/91.99.194.116/g" ~/.kube/config
```

## 3. Install Helm + Traefik + cert-manager

```bash
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

helm repo add traefik https://traefik.github.io/charts
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Traefik in its own namespace
kubectl create namespace traefik-system
helm install traefik traefik/traefik -n traefik-system \
  --set service.type=LoadBalancer \
  --set ports.web.port=80 \
  --set ports.websecure.port=443

# cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.15.0/cert-manager.crds.yaml
helm install cert-manager jetstack/cert-manager -n cert-manager --create-namespace --version v1.15.0
```

Create the Let's Encrypt production `ClusterIssuer`:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: satriowicaksono076@gmail.com
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
    - http01:
        ingress:
          class: traefik
EOF
```

## 4. Install Postgres 15 (Bitnami helm)

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

kubectl create namespace data

helm install postgres bitnami/postgresql -n data \
  --version 15.5.0 \
  --set auth.postgresPassword="$(openssl rand -base64 24)" \
  --set primary.persistence.storageClass=local-path \
  --set primary.persistence.size=10Gi \
  --set primary.resources.requests.memory=512Mi \
  --set primary.resources.limits.memory=1Gi

# Capture the generated password (save into a password manager immediately)
kubectl -n data get secret postgres-postgresql -o jsonpath="{.data.postgres-password}" | base64 -d
```

## 5. Install Redis 7 (Bitnami helm)

```bash
helm install redis bitnami/redis -n data \
  --version 19.5.0 \
  --set architecture=standalone \
  --set auth.password="$(openssl rand -base64 24)" \
  --set master.resources.requests.memory=256Mi \
  --set master.resources.limits.memory=512Mi

kubectl -n data get secret redis -o jsonpath="{.data.redis-password}" | base64 -d
```

## 6. GitHub Actions deploy user (for CI/CD)

Generate a dedicated SSH key for GH Actions on your workstation:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/qooma_gha_deploy -N "" -C "gh-actions@qooma-vps"
ssh-copy-id -i ~/.ssh/qooma_gha_deploy.pub deploy@91.99.194.116
```

Base64-encode the kubeconfig for a GH secret:

```bash
ssh deploy@91.99.194.116 "cat ~/.kube/config" | base64 -w 0 > kubeconfig.b64
```

Store `qooma_gha_deploy` (private) and `kubeconfig.b64` as GH secrets `VPS_SSH_PRIVATE_KEY` and `VPS_KUBECONFIG_B64` respectively (see `ci-cd-github-actions.md`).

## 7. Namespace + ResourceQuota for the service

```bash
kubectl apply -f deploy/k8s/integration/namespace.yaml
```

## 8. Verification checklist

- [ ] `kubectl get nodes` → 1 `Ready` node.
- [ ] `kubectl get pods -A` → coredns / metrics-server / traefik / cert-manager all `Running`.
- [ ] `kubectl get clusterissuer letsencrypt-prod -o jsonpath='{.status.conditions[0].type}'` → `Ready`.
- [ ] `kubectl -n data exec deploy/postgres-postgresql -- psql -U postgres -c 'SELECT 1'` → `1`.
- [ ] `kubectl -n data exec deploy/redis-master -- redis-cli -a "$REDIS_PASSWORD" PING` → `PONG`.
- [ ] `curl http://91.99.194.116` returns Traefik's default 404 (proves ingress reachable).

## Troubleshooting

- **Cert-manager not issuing**: `kubectl -n cert-manager logs deploy/cert-manager` and check for HTTP-01 challenge failures (usually DNS or port 80 blocked).
- **Traefik LoadBalancer stuck pending**: K3s's built-in `svclb` should assign the VPS IP. `kubectl -n traefik-system describe svc traefik`.
- **Postgres pod CrashLoopBackOff**: usually PVC size / storageClass mismatch. `kubectl -n data describe pod postgres-postgresql-0`.
