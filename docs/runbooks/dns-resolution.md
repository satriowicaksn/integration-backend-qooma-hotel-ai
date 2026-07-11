# DNS resolution + TLS bootstrap runbook

Cara verify subdomain (`integration-staging.sharedisini.com`, dll) sudah resolve publicly, force propagasi, dan pastikan cert-manager auto-issue TLS Let's Encrypt setelah DNS jalan.

Ditulis dari kejadian real: NS delegation di JagoanHosting di-set ke custom (`best/great/one.jagoanhosting.com`) tapi record DNS di-manage lewat default NS (`ns1/ns2.jagoanhosting.com`) — hasilnya semua subdomain NXDOMAIN meskipun A record kelihatan benar di DNS Manager.

---

## 1. Prasyarat

- Domain sudah di-register di registrar (contoh: JagoanHosting).
- Cluster K3s + Traefik + cert-manager sudah bootstrap per `vps-k3s-bootstrap.md` §3.
- Service sudah di-deploy dengan `IngressRoute` hostname yang benar (`deploy-integration-service.md` §6).

---

## 2. Diagnose: kenapa domain gak resolve

### 2.1 Cek NS delegation dari root

```bash
dig NS sharedisini.com +short
```

Output harus konsisten (semua NS 1 provider). Kalau muncul mixed set (misal 2 NS jagoanhosting + 1 NS provider lain), delegation broken — public resolver bisa jatuh ke NS yang salah.

### 2.2 Cek A record dari NS yang bertanggung jawab

```bash
# Query salah 1 NS langsung
dig @ns1.jagoanhosting.com integration-staging.sharedisini.com +short

# Query public resolver (Google + Cloudflare)
dig @8.8.8.8 integration-staging.sharedisini.com +short
dig @1.1.1.1 integration-staging.sharedisini.com +short
```

**Diagnosis matrix:**

| Result langsung dari NS | Result dari public resolver | Interpretasi |
|---|---|---|
| ✅ `91.99.194.116` | ✅ `91.99.194.116` | Sehat |
| ✅ `91.99.194.116` | ❌ NXDOMAIN | Delegation salah — NS registrar gak point ke NS yang punya record |
| ❌ empty | ✅ `91.99.194.116` | Cache lama — tunggu TTL habis |
| ❌ empty | ❌ NXDOMAIN | Record belum ada / salah host name |

### 2.3 Root cause paling sering di JagoanHosting

Domain di **My Domains → Manage → Nameservers** ke-set ke *custom* NS (`best.jagoanhosting.com`, `great.jagoanhosting.com`, `one.jagoanhosting.com`) — ini paket lama / hosting bundle. Tapi record kamu di-manage di **DNS Management** yang cuma di-serve oleh NS **default** (`ns1/ns2.jagoanhosting.com`).

**Fix**:
1. Buka **Manage → Nameservers**.
2. Pilih radio **"Use default nameservers"**.
3. Klik **Change Nameservers**.
4. Tunggu propagasi 5 menit – 4 jam (tergantung TTL SOA + cache upstream).

---

## 3. Verify propagasi

Poll setiap 2-3 menit:

```bash
dig +short integration-staging.sharedisini.com @8.8.8.8
```

Kosong / NXDOMAIN = masih propagasi. `91.99.194.116` = DONE.

Force flush cache lokal kalau terminal kamu terlalu lama pakai cache lama:

```bash
# macOS
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder

# Linux (systemd-resolved)
sudo resolvectl flush-caches

# Windows (PowerShell as admin)
ipconfig /flushdns
```

**Debug propagasi global**: https://dnschecker.org/#A/integration-staging.sharedisini.com — hijau di sebagian besar region berarti aman untuk share.

---

## 4. cert-manager auto-issue TLS setelah DNS resolve

Kalau `IngressRoute` sudah punya annotation TLS + `Issuer` cert-manager, cert-manager otomatis coba issue lewat HTTP-01 challenge tiap ~1 menit. Sebelum DNS resolve, challenge fail terus (Let's Encrypt gak bisa hit `http://<host>/.well-known/acme-challenge/...`). Begitu DNS resolve, challenge lolos → cert issued dalam 30-60 detik.

Monitor:

```bash
kubectl -n <namespace> get certificate,challenge,order
```

Yang mau kamu lihat:

| Resource | Status yang benar |
|---|---|
| `certificate/<name>` | `READY True`, `AGE > 0` |
| `challenge/...` | Hilang (habis dipakai) |
| `order/...` | `STATE Valid` |

Kalau `READY False` >5 menit setelah DNS resolve:

```bash
kubectl -n <namespace> describe certificate <name> | tail -30
kubectl -n <namespace> describe challenge --all | tail -30
```

Cek pesan error. Yang paling umum:
- **"Waiting for HTTP-01 challenge propagation"** → cert-manager belum retry, tunggu 2 menit lagi.
- **"Failed to perform self check"** → firewall block port 80 dari luar. `ufw allow 80/tcp` di VPS.
- **"acme: Error 429 - Rate limit"** → sudah issue >5x per week untuk hostname yang sama. Tunggu / pindah subdomain.
- **"DNS problem: NXDOMAIN"** → propagasi belum sampai ke resolver Let's Encrypt. Tunggu.

Force cert-manager retry (delete challenge yang stuck):

```bash
kubectl -n <namespace> delete challenge --all
# cert-manager akan re-create otomatis dalam 30 detik
```

---

## 5. Smoke test tanpa `-k`

Setelah cert issued:

```bash
curl https://integration-staging.sharedisini.com/healthz
# → {"status":"ok"}
```

Tanpa warning. Kalau masih ada warning cert:
- Browser cache lama → hard refresh (Cmd+Shift+R).
- `/etc/hosts` masih override → hapus baris manual (lihat §6).

---

## 6. Cleanup `/etc/hosts` (kalau tadi pakai workaround)

```bash
# macOS
sudo sed -i '' '/integration-staging.sharedisini.com/d' /etc/hosts

# Linux
sudo sed -i '/integration-staging.sharedisini.com/d' /etc/hosts

# Windows: edit C:\Windows\System32\drivers\etc\hosts as admin, hapus baris manual
```

Windows perlu admin PowerShell:

```powershell
$hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
(Get-Content $hosts) -notmatch 'integration-staging\.sharedisini\.com' | Set-Content $hosts
```

---

## 7. Public wildcard fallback (nip.io) untuk emergency

Kalau DNS delegation lagi rusak lama dan butuh public URL ASAP (misal demo ke stakeholder):

1. Tambah host baru ke `IngressRoute` service:
   ```yaml
   spec:
     routes:
       - match: Host(`integration-staging.sharedisini.com`) || Host(`integration-staging.91-99-194-116.nip.io`)
         kind: Rule
         services:
           - name: integration-api
             port: 3000
   ```
2. Apply: `kubectl apply -f deploy/k8s/integration/ingress.yaml`.
3. URL langsung publicly resolvable: `https://integration-staging.91-99-194-116.nip.io/healthz`.
4. Cert Let's Encrypt tetap bisa issue karena nip.io publicly resolves.

Trade-off: URL jelek + jangan share ke customer. Cocok untuk debug tim internal.

---

## 8. Ops harian

### 8.1 Add subdomain baru untuk service Qooma lain (auth, ai, core)

Di JagoanHosting **DNS Management**:

| Host Name | Type | Value | TTL |
|---|---|---|---|
| `auth-staging` | A | `91.99.194.116` | 14400 |
| `ai-staging` | A | `91.99.194.116` | 14400 |
| `core-staging` | A | `91.99.194.116` | 14400 |

**Save Changes** → tunggu propagasi (biasanya <5 menit kalau NS delegation sudah benar).

Deploy service pakai `service-onboarding-template.md` dengan subdomain masing-masing.

### 8.2 Rotasi cert Let's Encrypt

Auto-renew jalan tiap 60 hari lewat cert-manager. Manual force renew:

```bash
kubectl -n <namespace> delete secret <name>-tls
# cert-manager re-issue dalam 1-2 menit
```

---

## Referensi

- `vps-k3s-bootstrap.md` §3 — install Traefik + cert-manager (prasyarat).
- `deploy-integration-service.md` §1, §6 — DNS setup + IngressRoute + TLS per service.
- Let's Encrypt rate limits: https://letsencrypt.org/docs/rate-limits/
- DNS propagation checker: https://dnschecker.org
