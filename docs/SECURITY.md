# Security & Data Privacy

> Aturan baseline untuk semua service Qooma. Service spesifik bisa tambah, tidak boleh kurangi.

## 1. Threat model (yang kami protect)

| Threat | Mitigasi utama |
|---|---|
| Spoofed webhook | HMAC signature validation di plugin |
| Stolen token | Encrypted at rest (AES-256-GCM) + key rotation |
| JWT theft | Short TTL (8h) + refresh rotation |
| Brute force login | Rate limit + account lockout |
| SQL injection | Prisma parametrized queries — no raw concat |
| XSS / CSRF (kalau service render HTML) | CORS strict, SameSite cookies, CSP header |
| PII leak di log | Redact wajib di winston format |
| Insecure dependencies | pnpm audit + Renovate + Snyk |
| Insider abuse | Audit log + super-user separation |

## 2. Authentication

### User auth (kalau service expose login)
- Login: email + password (bcrypt, cost 12)
- Output: JWT access (8h, signed `JWT_ACCESS_SECRET`) + refresh token (30d, hashed in DB)
- Refresh: rotate refresh token tiap pemakaian (invalidate old)
- Logout: tandai refresh token revoked
- Password policy: min 12 char, 1 angka, 1 simbol

### Service-to-service auth
- Internal service: shared JWT secret atau mTLS
- External: API key di header `Authorization: Bearer <key>` + rate limit per key

### Webhook auth
- HMAC SHA-256 timing-safe — wajib validate sebelum business logic

## 3. Encryption

### At rest (di database)

Field sensitif WAJIB enkripsi sebelum simpan:

| Field type | Algorithm | Helper |
|---|---|---|
| Token/secret (API key, OAuth token) | AES-256-GCM | `encrypt()` |
| Connection string | AES-256-GCM | `encryptDsn()` |
| Password | bcrypt cost 12 | `hashPassword()` |
| Refresh token | SHA-256 hash | `hashToken()` |

Envelope format: `v<version>:<iv_hex>:<ciphertext_hex>:<authTag_hex>` — versioning untuk key rotation.

### Key rotation strategy

1. Generate new `ENCRYPTION_KEY_V2`
2. Update env `ENCRYPTION_KEY_VERSION=v2`, simpan `v1` di `ENCRYPTION_KEY_RETIRED_V1`
3. Decrypt support multi-version (cek version prefix)
4. Background job: re-encrypt batch dari v1 → v2
5. Setelah 100% migrated: remove v1 key

### In transit

- HTTPS wajib production (TLS 1.2+)
- Internal (api ↔ DB, ↔ Redis): TLS jika cluster support
- External API call: HTTPS by default

## 4. HMAC webhook validation

```ts
// src/plugins/hmac-validator.plugin.ts
const signature = req.headers['x-signature'];
const body = req.rawBody;
const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
  throw new AuthError('Invalid webhook signature');
}
```

**WAJIB pakai `timingSafeEqual`** — bukan `===`. Mencegah timing attack.

## 5. PII masking

### Aturan masking di log

| Field | Display | Log |
|---|---|---|
| Nomor HP | `+628******1234` (4 digit terakhir) | mask |
| Email | `a***@example.com` (1 char depan) | mask |
| Token, API key, password | tidak ditampilkan | full redact (`***`) |

### Helper

```ts
// src/shared/utils/masking.ts
maskWaPhone(phone: string): string         // +6281234567890 → +628******7890
maskEmail(email: string): string           // john@x.com → j***@x.com
maskTokenForLog(token: string): string     // sk-abc123 → ***123 (last 3)
```

### Winston redaction

Konfigurasi winston format dengan `redactPaths`:
- `**/password`, `**/token`, `**/apiKey`, `**/api_key`
- `**/wa_phone`, `**/phone`, `**/email` → mask via helper
- `headers.authorization`, `headers.cookie`

## 6. Rate limiting

| Endpoint type | Default limit | Implementation |
|---|---|---|
| Public API | 100 req/menit per IP | `@fastify/rate-limit` + Redis |
| Webhook receiver | 300 req/menit per IP | Higher untuk burst |
| Authenticated user | 600 req/menit per user | Identifier: JWT sub |
| Login attempt | 5 fail/15 menit per IP+email | Account lock 15 menit |

Distributed: pakai Redis sebagai store (rate-limit `redis` option).

## 7. CORS & security headers

Fastify hooks:
- `@fastify/cors`: allow `CORS_ORIGIN` only, credentials true
- `@fastify/helmet`: default secure headers
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'self'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Content-Type-Options: nosniff`

## 8. Audit logging

Setiap service punya tabel `audit_logs` di DB-nya untuk action sensitif:
- User login/logout
- Admin actions (CRUD entity penting)
- Status change yang punya impact bisnis
- Permission change

Format: `{ id, actor_id, action, resource_type, resource_id, payload_diff, ip, user_agent, created_at }`.

## 9. PDPA / Data privacy

- **Right to access**: endpoint export data user dalam JSON
- **Right to deletion**: endpoint soft-delete, hard-delete after 30d grace
- **Data retention**: per service tentukan (default: 1 tahun untuk data operasional)
- **DPA**: tracking di tabel `data_processing_agreements` (kalau service deal dengan customer enterprise)
- **Audit**: setiap PII access oleh non-admin → log

## 10. Secrets management

| Env | Source |
|---|---|
| Local dev | `.env` (gitignored) |
| Staging | AWS Secrets Manager via ECS task definition |
| Production | AWS Secrets Manager + IAM role per task |

**TIDAK BOLEH**:
- Secrets di code, comment, atau Dockerfile
- Secrets di CI logs (mask di GitHub Actions)
- Secrets di GitHub repo
- Secrets sama antar env (staging ≠ prod)

## 11. Dependency security

- `pnpm audit` di CI (fail kalau ada High/Critical)
- Renovate (atau Dependabot) untuk auto-PR update patch/minor
- Major version update review manual
- Lockfile (`pnpm-lock.yaml`) di-commit, frozen di CI (`--frozen-lockfile`)

## 12. Sentry & sensitive data

- Sentry `beforeSend` hook untuk redact PII
- Tidak kirim request body ke Sentry by default
- User context Sentry: hash user id + role only, no PII

## 13. Checklist sebelum production deploy

- [ ] Semua secret di Secrets Manager (verify ECS task def)
- [ ] HTTPS enforced (no HTTP listener)
- [ ] CORS origin = expected origin only
- [ ] Rate limit aktif di semua public endpoint
- [ ] HMAC validation di semua webhook
- [ ] Token encryption verified (decrypt round trip)
- [ ] Logger redaction verified (smoke test dengan fake token)
- [ ] Backup tested (restore drill di staging)
- [ ] Sentry DSN set
- [ ] Better Stack monitor enabled
- [ ] `pnpm audit` clean
