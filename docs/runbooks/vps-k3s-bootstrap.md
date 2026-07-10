# VPS K3s bootstrap runbook (T30 / ADR-0011)

**Target**: Hetzner VPS `91.99.194.116` (Ubuntu 26.04, 8 GB, dedicated CX22-class).
**Outcome**: K3s single-node cluster with Traefik ingress + cert-manager + Postgres 15 + Redis 7, ready to accept service deployments.

**Run once, per VPS.** Subsequent service deploys use `deploy-integration-service.md`.

> **Semua step di runbook ini dijalankan sebagai `root` via SSH** (`ssh root@91.99.194.116`). Tidak
> ada user OS terpisah — pola ini paling aman untuk single-operator MVP dan menghindari trap
> "user tanpa password + sudo gagal". Kalau nanti tim mengharuskan pemisahan user, lihat
> [Appendix — Optional SSH user hardening](#appendix--optional-ssh-user-hardening) di bawah dan
> jalankan **setelah** cluster stabil.

## Prerequisites (before SSH)

- SSH keypair di workstation Anda. Kalau belum ada: `ssh-keygen -t ed25519 -C "vps-bootstrap" -f ~/.ssh/id_ed25519` (tekan Enter untuk passphrase kosong / isi passphrase kalau mau).
- Password root VPS (dari email Hetzner saat provisioning, atau reset via Hetzner Cloud Console → Rescue → Reset root password).
- DNS control di provider (JagoanHosting) — dibutuhkan Langkah subdomain nanti, bukan blocker bootstrap.

## 1. Firewall + SSH access (as root)

**Default (team-friendly)**: biarkan SSH root pakai password + key sekaligus. Ini yang dipakai untuk
MVP karena multi-operator: cukup share password root ke tim (via password manager), atau tim yang
punya SSH key bisa append public-key-nya ke `/root/.ssh/authorized_keys` sendiri. Password auth
tetap ON supaya teammate tanpa key tidak locked out.

Push public key Anda supaya SSH tanpa password (opsional, tapi disarankan biar operator utama
tidak type password terus):

```bash
# Di workstation lokal
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@91.99.194.116
# Masukkan password root (dari Hetzner) sekali.

# Verifikasi login pakai key jalan
ssh root@91.99.194.116 "hostname && whoami"
# Expect: hostname VPS + 'root'
```

Kalau nanti mau tambah teammate: dapatkan `~/.ssh/id_ed25519.pub`-nya, lalu append ke
`~/.ssh/authorized_keys` di VPS (`echo "<pubkey>" >> ~/.ssh/authorized_keys`).

> ⚠️ **JANGAN** set `PasswordAuthentication no` atau `PermitRootLogin no` di `/etc/ssh/sshd_config`
> sebelum verifikasi **semua teammate** sudah bisa login via key. Salah urutan = lockout, harus
> di-fix lewat Hetzner Cloud Console. Kalau mau go key-only nanti (setelah tim stabil),
> lihat [Appendix — Optional SSH user hardening](#appendix--optional-ssh-user-hardening).
> Ubuntu 26.04 juga punya folder `/etc/ssh/sshd_config.d/` — kalau ada file di sana yang set
> `PasswordAuthentication no`, itu override setting utama. Cek dulu: `ls /etc/ssh/sshd_config.d/`.

Firewall UFW:

```bash
apt update && apt install -y curl wget vim ufw

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

ufw status verbose   # verifikasi 22/80/443 ALLOW
```

## 2. Install K3s

```bash
# As root di VPS
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--write-kubeconfig-mode 644 --disable=traefik" sh -
# NOTE: K3s bundled Traefik di-disable — kita install versi pinned via Helm di §3.

# Verify
kubectl get nodes    # expect Ready
kubectl get pods -A  # coredns + local-path-provisioner Running
```

Kubeconfig sudah otomatis di `/etc/rancher/k3s/k3s.yaml` dan readable (`mode 644` dari `--write-kubeconfig-mode`). Untuk pakai dari workstation Anda:

```bash
# Di workstation lokal
mkdir -p ~/.kube
ssh root@91.99.194.116 "cat /etc/rancher/k3s/k3s.yaml" | \
  sed "s/127.0.0.1/91.99.194.116/g" > ~/.kube/config
chmod 600 ~/.kube/config

kubectl cluster-info   # verifikasi dari workstation
```

## 3. Install Helm + Traefik + cert-manager

> ⚠️ **PENTING kalau jalan di VPS (as root)**: `kubectl` bawaan K3s otomatis point ke
> `/etc/rancher/k3s/k3s.yaml`, tapi `helm` **tidak** — helm cari `~/.kube/config` atau env
> `KUBECONFIG`. Kalau tidak di-set, semua `helm install` gagal dengan
> `Kubernetes cluster unreachable: Get "http://localhost:8080/version"`.
> Set dulu (permanen di `.bashrc`):
>
> ```bash
> export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
> echo 'export KUBECONFIG=/etc/rancher/k3s/k3s.yaml' >> ~/.bashrc
> helm list -A   # verifikasi helm bisa reach cluster
> ```

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

## 6. GitHub Actions kubeconfig secret (for CI/CD)

CI/CD tidak butuh SSH (workflow pakai `kubectl` via kubeconfig — lihat `.github/workflows/deploy-staging.yml`). Yang perlu di-set: kubeconfig VPS sebagai GitHub secret.

```bash
# Di workstation (kubeconfig sudah di-download di §2)
base64 -w 0 ~/.kube/config > kubeconfig.b64   # macOS: `base64 -i ~/.kube/config -o kubeconfig.b64`

# Store sebagai GH secret
gh secret set VPS_KUBECONFIG_B64 < kubeconfig.b64

# Bersihkan file lokal — kubeconfig ini mengandung cluster credential
rm kubeconfig.b64
```

Detail secret lain (kalau nanti workflow butuh SSH juga) ada di [`ci-cd-github-actions.md`](./ci-cd-github-actions.md).

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
- **SSH root ditolak setelah salah setting `sshd_config`**: masuk lewat Hetzner Cloud Console (browser serial console) sebagai root → perbaiki `/etc/ssh/sshd_config` → `systemctl restart ssh`. Jangan set `PermitRootLogin no` sampai user OS terpisah + NOPASSWD sudo sudah terverifikasi jalan.

---

## Appendix — Optional SSH user hardening

Jalankan **hanya setelah** cluster stabil dan verifikasi §8 semua hijau. Tujuannya: pisah user
OS supaya tidak semua orang SSH sebagai root, dan disable root SSH sepenuhnya.

**Pitfall yang menyebabkan lockout sebelumnya**: `adduser --disabled-password` bikin user
TANPA password sama sekali — `sudo` tidak akan pernah bisa authenticate. Wajib pakai
`NOPASSWD` sudoers (rekomendasi untuk user deployment/CI) atau set password eksplisit.

### A.1 Bikin user `deploy` + passwordless sudo

```bash
# As root di VPS
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy

# Passwordless sudo (WAJIB — kalau tidak, sudo akan selalu gagal karena user tidak punya password)
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy
visudo -c   # verifikasi syntax → "parsed OK"

# Copy SSH key dari root ke deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Copy kubeconfig ke deploy
mkdir -p /home/deploy/.kube
cp /etc/rancher/k3s/k3s.yaml /home/deploy/.kube/config
chown -R deploy:deploy /home/deploy/.kube
```

### A.2 Verifikasi deploy SSH + sudo bekerja SEBELUM disable root

**JANGAN** disable root SSH sebelum step ini hijau. Kalau salah urutan → lockout.

```bash
# Dari workstation — buka terminal BARU, JANGAN tutup session root yang aktif
ssh deploy@91.99.194.116 "sudo whoami && kubectl get nodes"
# Expect: 'root' + list node K3s
```

### A.3 Disable root SSH

Kalau A.2 sudah hijau:

```bash
# Di VPS (bisa sebagai root atau deploy sudo)
sudo sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

Verifikasi dari workstation:
```bash
ssh root@91.99.194.116 "hostname" 2>&1 | grep -q "Permission denied" && echo "root diblok — OK"
ssh deploy@91.99.194.116 "hostname"   # deploy tetap jalan
```

### A.4 Emergency recovery kalau ter-lockout

Semua opsi lockout bisa di-fix via Hetzner Cloud Console (browser serial console):
1. Console → login root pakai password (reset di tab Rescue kalau lupa).
2. `sed -i 's/^PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config`
3. `systemctl restart ssh`
4. Kalau `deploy` user yang broken: `userdel -r deploy` lalu ulangi A.1.
