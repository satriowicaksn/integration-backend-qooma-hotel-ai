# PM-STATUS-A — Qooma Integration · Dev A (Nathan)

> **Per-dev tracker untuk slot A (Nathan).** PM A + Executor A komunikasi **hanya** via file ini. Roll-up short summary ke `PM-STATUS-PARENT.md §2` setelah tiap VERDICT atau end-of-session.
>
> **PM B, PM C, Executor B, Executor C — JANGAN edit file ini.** File ini private ke slot A.
>
> **Identity check**: di response pertama session WAJIB confirm `Role: PM | Executor`, `Slot: A (Nathan)`. Bila user belum sebut slot — STOP, tanya dulu (lihat `KICKOFF.md §4`).
>
> Format block di §2 Active assignments **append-only** (lihat `EXECUTOR-PROTOCOL.md §0.5` & `PM-AGENT.md §0.4`).
>
> **Domain slot A (Integration)**: Foundation — Prisma + migrations, encryption-at-rest helper, signature-verify middleware, tenant-slug resolver + LRU, BSP adapter ABI + 1engage impl, BullMQ + scheduler harness, error catalog, internal RPC server. Spec routing: F1–F8 (`docs/spec/MVP-INTEGRATION-FIRST.md §1`).

---

## 0. Current focus (slot A)

- **Day**: H12+ (task tracker activated 2026-06-30)
- **Active task**: T01-T08 MERGED · **T09 PLAN ACK'd, coding** (internal-RPC shared-secret auth guard, Opsi A×4; auth-guard scope confirmed vs MVP §4.11). **Closes foundation on merge.** Open Qs: Q-A-01/02/04/07/09 (PO/PM B/HC/AI), Q-A-03/05/08 (shared-config/boilerplate → Parent PM), Q-A-06 (WA module → B align).
- **Branch**: `feat/internal-rpc-auth` (T09, in progress)
- **Next gate (global)**: G1 — lihat `PM-STATUS-PARENT.md §5`
- **My queue (preview)**: T01–T09 (foundation) — lihat §8 di bawah (mirror dari PARENT §1 filter Slot=A)
- **Critical path**: T02 (Prisma migration) blokir implementasi Nanak (T10+) dan Satrio (T17+). Prioritaskan T01 → T02 → T03 sequence.

---

## 1. Task tracker (slot A — PM A authority)

> Mirror dari `PM-STATUS-PARENT.md §1` di mana Slot=A. PM A update status row di sini + push status update ke PARENT §1 setelah verdict.

| T## | Title                                                                            | Status   | Verified by PM | Notes                                                              |
| --- | -------------------------------------------------------------------------------- | -------- | -------------- | ------------------------------------------------------------------ |
| T01 | `make check` green dari boilerplate                                              | merged   | PM A (H12) ✓   | Opsi B (jest.config.cjs, zero-dep). Merged to main PR #1 `7b40e11`. attempt 1 |
| T02 | Prisma schema initial migration (8 Integration tables + indexes)                 | merged   | PM A (H12) ✓   | Clean-DB validated by PM (8 tbl, 6 chk, 2 partial idx, 0 auth). Opsi A. Merged PR #2 `53a4925`. Unblocks B+C. |
| T03 | Encryption-at-rest helper (AES-256-GCM / KMS)                                    | merged   | PM A (H12) ✓   | Opsi A current-version. 100% cov, tamper+fail-fast verified. Merged PR #3 `ca9685b`. Consumed by T10+T17. |
| T04 | Webhook signature-verification middleware (Meta `X-Hub-Signature-256` + Telegram)| merged   | PM A (H12) ✓   | plugin-level preHandler, timingSafeEqual, raw-byte HMAC, 401 native, no-insert invariant proven. 100% line cov. Merged PR #4 `ad46125`. |
| T05 | Tenant resolution from `:hotel_slug` (LRU 5-min, hotels.code lookup)             | merged   | PM A (H12) ✓   | factory TTL-LRU (no-class per PO), injected lookup port, 404 native, never-trust-body proven, 100% resolver cov. Merged PR #5 `59e8218`. Consumed by T12+T19. |
| T06 | BSP adapter interface + `1engage` impl                                           | merged   | PM A (H12) ✓   | module `whatsapp`, vendor-agnostic port + factory 1engage adapter, ExternalServiceError, injected HttpPoster, 100% adapter cov. Merged PR #6 `3c1274a`. Consumed by T13. Q-A-06 (B align). |
| T07 | Queue + scheduler infra (BullMQ + retry + DLQ)                                   | merged   | PM A (H12) ✓   | Bull 4.x, backoff [1s/5s/30s] attempts=3 configurable, DLQ-forwarder (exhaustion-gated), Redis-injected. logic 100% cov. Merged PR #7 `6654d46`. Consumed by T14/T21/T24. Q-A-07. |
| T08 | Common error handlers (Integration-specific codes per spec §9)                   | merged   | PM A (H12) ✓   | 7 §9 classes + canonical `{error:{…}}` handler (README §2.3), non-AppError→500 INTERNAL no-leak, correlationId log. 100% new-code cov. Merged PR #8 `b503041`. Q-A-08 (generic-code drift). |
| T09 | Internal RPC server (HTTP/mTLS; spec §10 catalog)                                | wip      | —              | PLAN ACK'd (Opsi A×4). shared-secret guard (`X-Internal-Secret`), timingSafeEqual, 401 native, injected secret. Scope=auth-guard (§4.11). Q-A-09 (cross-svc contract). |

---

## 2. Active assignments (append-only)

> **Executor A** append `ASSIGNMENT` block saat claim task. **PM A** append `ACK` / `VERDICT` sub-block di bawah block executor — JANGAN edit block lama.

### ASSIGNMENT T01 — claimed by exec-A (Nathan) at H12 (2026-07-03)
- Branch: chore/ci-make-check-green
- Routed from: PM-STATUS-A.md §1/§8 T01 (assigned — self-claim per EXECUTOR-PROTOCOL §3B)

#### PLAN T01 — exec-A (Nathan) at H12 (2026-07-03)

**Scope recap**
- T01 = `make check` hijau dari boilerplate. `make check` = `lint` + `format-check` + `typecheck` + `test-unit`. Prasyarat critical path sebelum T02/T03.

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot A (Nathan) ✓
- CLAUDE.md loaded ✓
- Task spec read: Makefile (target `check`, `test-unit`), package.json (scripts), jest.config.ts, docs/TESTING.md (pola test)
- Parent docs spot-read: EXECUTOR-PROTOCOL.md (full), KICKOFF.md, PM-STATUS-A.md §1/§2/§8
- Dependencies: none (T01 adalah root task)
- `make typecheck` clean ✓ ; `make lint` clean ✓ ; `make format-check` clean ✓
- Scaffolder risk: none

**Diagnosis (sudah dijalankan — read-only)**
- `lint` PASS, `format-check` PASS, `typecheck` PASS.
- `test-unit` FAIL, root cause tunggal: Jest gagal parse `jest.config.ts` — `ts-node` diperlukan untuk config TypeScript, TAPI `ts-node` **tidak** ada di `package.json` (hanya muncul sebagai optional-peer yang di-*exclude* di `pnpm-lock.yaml`, tidak ter-install). Ini gap boilerplate: ship config `.ts` tanpa tool untuk membacanya.
- Semua test template pakai `.skip`/`describe.skip` (di `src/modules/_template/` — frozen, TIDAK saya sentuh). Setelah config bisa di-load, hasil = 2 suites skipped, 0 fail, exit 0.

**GAP / decision — butuh ACK PM A sebelum coding**
- **GAP T01-#1** — cara memperbaiki parsing `jest.config.ts`. Dua opsi mutually-exclusive:
  - **Opsi A** — `pnpm add -D ts-node`. Pertahankan `jest.config.ts` apa adanya (typed). **Konsekuensi**: tambah package baru + ubah `pnpm-lock.yaml` → butuh approval PO (EXECUTOR-PROTOCOL §10, CLAUDE.md §11).
  - **Opsi B (default saya)** — konversi `jest.config.ts` → `jest.config.cjs` (opsi verbatim, tambah JSDoc `/** @type {import('jest').Config} */` untuk type-hint editor). **Zero package baru**, dalam wewenang executor (config file, bukan planning doc). Sudah saya **validasi** via probe `.cjs` sementara (langsung dihapus, working tree bersih): `jest --testPathPattern='__tests__/.*\.test\.ts'` → `Test Suites: 2 skipped`, exit 0, TANPA `NODE_OPTIONS`/dep baru.
  - **My intent**: Opsi B — memenuhi "green from boilerplate" tanpa lintasi gate package-baru dan tanpa nunggu PO. Bila PM/PO prefer pertahankan config TS, saya switch ke Opsi A (route ke PO).
- **Observasi (bukan bagian T01, tidak saya ubah)**: glob `test:unit` (`__tests__/.*\.test\.ts`) juga match file `*.integration.test.ts`. Sekarang aman karena integration test `describe.skip`. Kandidat GAP terpisah bila nanti mengganggu — flag saja, tidak act di T01.

**Files to modify (bila Opsi B di-ACK)**
- `jest.config.ts` → hapus, ganti `jest.config.cjs` (isi opsi identik, `module.exports`).
- (tidak ada perubahan `package.json`/scripts/lockfile di Opsi B.)

**Files to create**
```
jest.config.cjs   (pengganti jest.config.ts — Opsi B)
```

**Approach**
Tidak menulis kode aplikasi. Perbaikan tooling murni: ganti format Jest config agar Node bisa load tanpa `ts-node`, lalu buktikan `make check` hijau end-to-end (lint+format+typecheck+test-unit) + jalankan drift scans EXECUTOR-PROTOCOL §4.4. Tidak sentuh `src/`, `prisma/`, `_template/`.

**GAPs / questions**
- GAP T01-#1 di atas — tunggu ACK PM A untuk pilih Opsi A vs B.

Awaiting PM A ACK.

##### PM A ACK — T01 PLAN APPROVED, proceed to coding (H12, 2026-07-03)

**GAP T01-#1 — decision: Opsi B (jest.config.ts → jest.config.cjs). APPROVED.**

Root cause diagnosis diverifikasi independen oleh PM A (trust-but-verify, read-only):
- `node_modules/ts-node` = tidak ada; `ts-node` tidak di `package.json`.
- `pnpm test:unit` reproduksi error persis: `Jest: 'ts-node' is required for the TypeScript configuration files`.
Diagnosis executor akurat.

Rasional pilih Opsi B:
- **Zero package baru** → tidak lintasi gate CLAUDE.md §11 / PM-AGENT §4 (tambah dep = otoritas PO, bukan PM). Opsi A benar kamu identifikasi sebagai PO-gated — kita hindari, tidak perlu eskalasi untuk masalah yang punya fix zero-dep.
- **Preseden repo**: `.eslintrc.cjs` sudah pakai `.cjs` justru karena `package.json` = `"type": "module"`. `.cjs` = pilihan konsisten (jangan `.js` — akan diperlakukan ESM dan `module.exports` gagal). Kamu sudah pilih `.cjs`, benar.
- Config-file change = dalam wewenang executor (bukan planning doc, bukan `src/`, bukan deps).

**Binding conditions untuk SUBMIT (verifikasi di VERDICT):**
1. Semantik config `.cjs` WAJIB identik verbatim dengan `.ts` — semua field (preset ts-jest ESM, moduleNameMapper, transform, coverageThreshold 70/75/80/80, setupFilesAfterEnv, testTimeout) tidak boleh berubah. Ganti `import type { Config }` + `export default` → `/** @type {import('jest').Config} */` + `module.exports`. Hapus `jest.config.ts`.
2. `make check` WAJIB hijau end-to-end — termasuk `lint` (eslint `.`) + `format:check` (prettier `.`) atas file `.cjs` baru. Kalau lint/prettier trip di `.cjs`, resolve sebelum SUBMIT (jangan tambah override tanpa flag).
3. Branch `chore/ci-make-check-green` — sesuai konvensi CLAUDE.md §12 (`chore/<short>`). OK.

**Watch-items (BUKAN blocker T01, jangan act di T01):**
- Glob `test:unit` (`__tests__/.*\.test\.ts`) memang juga match `*.integration.test.ts`. Sekarang aman (integration test `describe.skip` → exit 0). Observasi kamu benar — di luar scope T01, jangan sentuh. Kandidat GAP terpisah bila nanti mengganggu.
- `.skip` di `src/modules/_template/` = kondisi baseline boilerplate (frozen, `_template/` JANGAN diedit). Ini **bukan** drift yang kamu introduce → PM A **tidak** akan flag `.skip` template sebagai reject item T01. Jangan hapus/ubah.

Proceed to coding. Post SUBMIT (attempt 1) saat `make check` hijau + drift scan bersih.

#### SUBMIT T01 — exec-A (Nathan) at H12 (2026-07-03) (attempt 1)

Task: `make check` green dari boilerplate (Opsi B — jest.config.ts → jest.config.cjs)
Branch: `chore/ci-make-check-green` (pushed, commit `8277b7a`)
Files changed: 3
  - `jest.config.ts` → `jest.config.cjs` (rename, opsi verbatim; `import type {Config}`+`export default` → `/** @type {import('jest').Config} */`+`module.exports`; git detect 91% rename)
  - `tsconfig.eslint.json` (modified — include `"jest.config.ts"` → `"jest.config.cjs"`)
  - (`jest.config.cjs` juga berisi 1 baris `/* eslint-env node */` — lihat Notes #2)

DoD self-check
- [x] `make check` hijau end-to-end — lint + format:check + typecheck + test-unit semua PASS, exit 0.
- [x] `test-unit` sekarang jalan tanpa `ts-node` → `Test Suites: 2 skipped, 0 fail`, exit 0.
- [x] Zero package baru (no `package.json` / `pnpm-lock.yaml` change).

Binding conditions (dari ACK)
- **#1 semantik verbatim** ✓ — semua field identik: preset `ts-jest/presets/default-esm`, testEnvironment, rootDir, roots, testMatch, moduleFileExtensions, extensionsToTreatAsEsm, moduleNameMapper (5 entri), transform (useESM + tsconfig), collectCoverageFrom, coverageDirectory, coverageReporters, **coverageThreshold 70/75/80/80**, clearMocks, restoreMocks, setupFilesAfterEnv, testTimeout=10000. `jest.config.ts` dihapus.
- **#2 make check hijau incl. lint+format:check atas `.cjs`** ✓ — lihat Notes #1/#2 untuk 2 langkah minimal yang diperlukan agar `.cjs` lolos typed-lint (aku flag, tidak silent).
- **#3 branch `chore/ci-make-check-green`** ✓ — sesuai CLAUDE.md §12.

Quality gate
- `make lint` (eslint . --max-warnings 0): PASS (0 error, 0 warning)
- `make format-check` (prettier --check .): PASS
- `make typecheck` (tsc --noEmit): PASS
- `make test-unit`: PASS (2 suites skipped, 0 fail)

Drift scans (§4.4 — semua hit di bawah = **baseline boilerplate**, di file yang TIDAK aku sentuh; diff-ku 0 file `src/`)
- `any`: 2 hits — `_template/_template.repository.ts:12`, `_template/adapters/example-vendor.adapter.ts:9` (stub `_db: any`/`_httpClient: any`, frozen `_template/`).
- console.log: 0 hits.
- `throw new Error(`: 4 hits — `_template/_template.repository.ts:23`, `core/config/env.ts:75`, `core/http/http-client.ts:19,27` (stub/bootstrap boilerplate; bukan file-ku).
- forbidden imports (express/typeorm/sequelize/moment/node-fetch): 0 hits.
- default export di luar entry/config: 0 hits.
- `.skip`: 2 hits — `_template/__tests__/*` (baseline per ACK watch-item #2; frozen).
- **Confirmed**: `git diff --name-only` = `jest.config.ts`, `jest.config.cjs`, `tsconfig.eslint.json` only. **0 file `src/` berubah** → tidak ada drift baru yang aku introduce.

Security check
- N/A (task tooling murni; tidak sentuh auth/webhook/crypto/secret).

Test evidence
- Unit: 0 aktif (2 skipped di `_template/`, baseline). `test-unit` command exit 0.
- Integration: N/A (T01 tidak sentuh DB/queue/IO).
- Bukti runtime `make test-unit`:
  ```
  > jest --testPathPattern=__tests__/.*\.test\.ts
  Test Suites: 2 skipped, 0 of 2 total
  Tests:       2 skipped, 2 total
  ```

Notes / questions (transparansi 2 langkah di luar rename murni — mohon verifikasi PM A)
- **#1 — `tsconfig.eslint.json` include rename**: ESLint typed-lint (`parserOptions.project`) mewajibkan file yang di-lint ada di include. Boilerplate sudah include `jest.config.ts`; aku hanya rename referensinya ke `jest.config.cjs`. Konsekuensi mekanis langsung dari rename yang di-ACK, bukan keputusan baru. **Tidak** menambah/menghapus rule eslint.
- **#2 — `/* eslint-env node */` di baris atas `jest.config.cjs`**: file `.cjs` di-lint sebagai CommonJS (bukan TS), jadi `no-undef` protes `module`/`module.exports`. Aku pilih directive file-local (blast radius = 1 file) **alih-alih** menambah override di `.eslintrc.cjs` — sesuai kondisi ACK #2 "jangan tambah override tanpa flag". Ini aku flag eksplisit; tidak silent. `.eslintrc.cjs` **tidak diubah**.
- Watch-item glob `test:unit` match `*.integration.test.ts`: tidak aku act (di luar scope T01), sesuai arahan ACK.

Requesting PM A VERDICT.

##### VERDICT T01 — APPROVED (H12, attempt 1) by PM A

✅ **APPROVE.** All 8 PM-AGENT §3 steps pass. Verified independently on `chore/ci-make-check-green` (commit `8277b7a`), not trust-only.

**Step-by-step verification (PM rerun):**
1. **DoD match** — T01 = `make check` green from boilerplate. Met.
2. **Drift scan** — clean. All `any`/`throw new Error`/`.skip` hits are pre-existing boilerplate in files with **0 diff** (`_template/` frozen, `core/config`, `core/http`). `git diff --name-only dae46f1..HEAD` (code) = `jest.config.cjs` + `tsconfig.eslint.json` only → **no new drift introduced**. Confirmed by PM, not just self-report.
3. **File inventory** — matches PLAN + 2 flagged side-effects. No unexpected/silent files.
4. **Quality gate** — `make check` **green on PM rerun**: lint (0 warn) + format:check + typecheck + test-unit (2 skipped, exit 0). Reproduced before-state fail (ts-node missing) → after-state pass.
5. **Semantics verbatim** (ACK cond #1) — `.cjs` field-by-field identical to `.ts` incl. coverageThreshold 70/75/80/80, ts-jest ESM preset, moduleNameMapper, setupFilesAfterEnv, testTimeout. Old `.ts` deleted. Only wrapper (`import type`+`export default` → JSDoc+`module.exports`) changed.
6. **Security floor** — N/A (pure tooling; no auth/webhook/crypto/token touched). Correct.
7. **Test coverage** — N/A; T01 adds no business logic (tooling fix). No new tests required — correct call.
8. **Zero new deps** (ACK cond) — `package.json` + `pnpm-lock.yaml` unchanged; no npm/yarn lockfile. Confirmed.

**On the 2 flagged side-effects — both accepted:**
- **#1 `tsconfig.eslint.json` include rename** — mechanically required (typed-lint `parserOptions.project` needs the linted file in `include`); boilerplate already listed `jest.config.ts`, only the reference was retargeted. No eslint rule added/removed. In-scope consequence of the ACK'd rename.
- **#2 `/* eslint-env node */` file-local in `.cjs`** — honors ACK cond #2 ("no override without flag"): blast radius = 1 file, `.eslintrc.cjs` untouched. Correct least-privilege choice over a global override. Explicitly flagged, not silent.

**Notes:** Executor discipline exemplary — root-cause isolated, options presented with the PO-gate correctly identified, side-effects surfaced rather than hidden. Model behavior for the foundation sequence.

→ §1 task tracker: T01 `approved`, Verified by PM A.
→ Code stays on `chore/ci-make-check-green` awaiting **PO merge to main + CI green** (per service workflow rule #2 — PM does not merge).
→ Roll-up posted to PARENT §1 (status) + §2 (short line).

**Executor A: proceed to claim T02** (Prisma migration, 8 tables) — critical path, blocks slot B+C. Post PLAN; note the mandatory forward-only migration order + `hotels` FK dependency on Auth in your session-start gate.

### ASSIGNMENT T02 — claimed by exec-A (Nathan) at H12 (2026-07-03)
- Branch: `feat/prisma-init-migration` (proposal — foundation prisma; `feat/<short>` per CLAUDE.md §12. Koreksi bila PM mau nama lain)
- Routed from: PM-STATUS-A.md §1 T02 + VERDICT T01 hand-off (PM A). Spec: `docs/spec/04-integration-channels.md §4` (DDL) + `MVP-INTEGRATION-FIRST.md §3` (migration order) + `data-model.md §1/§2` (DB split + ownership).

#### PLAN T02 — exec-A (Nathan) at H12 (2026-07-03)

**Scope recap**
- T02 = initial Prisma migration untuk 8 tabel Integration + indexes, forward-only order. Blokir slot B (T10+) & C (T17+). `prisma/schema.prisma` **sudah ada** (F1 artifact, ratified) dengan 8 model + comment-block post-migration SQL. Deliverable = generate migration pertama dari schema itu, lengkapi fitur non-PSL (CHECK + partial index) via raw SQL di file migration yang sama, apply + verify.

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot A (Nathan) ✓
- CLAUDE.md loaded ✓
- Task spec read: `04-integration-channels.md §4` (DDL 8 tabel + index + CHECK), `MVP-INTEGRATION-FIRST.md §3` (urutan forward-only) + §4.1 (encryption-at-rest note), `data-model.md §1/§2` (Integration = own DB, `hotels` owned by Auth), `prisma/schema.prisma` (full).
- Parent docs spot-read: docker-compose.yml (postgres @ `localhost:5433`, user `app` superuser), `.env.example` (DATABASE_URL), Makefile (`db-migrate`/`prisma:*`).
- Dependencies: T01 ✓ merged (`make check` green baseline).
- `hotels` FK dependency (per VERDICT T01 note): **RESOLVED** → lihat GAP T02-#1. Auth's `hotels` table **tidak** ada di schema repo ini (Integration = own DB, `data-model.md §1/§2`), jadi FK lintas-service tidak bisa & tidak boleh di-generate Prisma. `hotel_id` = opaque UUID NOT NULL (sesuai spec §3). Schema saat ini memang **tidak** deklarasi relasi ke `hotels` → migrate = kolom UUID polos. Konsisten.
- Forward-only order: relasi intra-schema satu-satunya = `delivery_receipts.dispatch_id → outbound_dispatch_queue.id`. Prisma auto-order `CREATE TABLE outbound_dispatch_queue` sebelum `delivery_receipts`. 6 tabel lain independen. Aman.
- `make typecheck`/`make lint`/`make format-check` clean ✓ (T01 baseline, belum sentuh apa pun).
- Scaffolder risk: **YES — perlu PM flag**. Perintah CLI yang akan dijalankan (di bawah).

**CLI commands (guardrail — mohon PM flag risiko overwrite sebelum saya run)**
```
cp .env.example .env                 # LOKAL saja, gitignored — hanya untuk DATABASE_URL saat generate. TIDAK di-commit.
docker compose up -d postgres        # HANYA postgres (BUKAN `make start` — hindari auto db-migrate prompt)
pnpm prisma migrate dev --name init_integration_channels --create-only   # generate migration.sql TANPA apply
#   → lalu saya APPEND raw SQL (5 CHECK + 2 partial index) ke migration.sql (manual edit)
pnpm prisma migrate dev              # apply + validate (shadow DB) migration yang sudah dilengkapi
pnpm prisma generate                 # regen client, pastikan types OK
```
- Risiko yang saya sadari: (a) `.env` — gitignored, tidak akan ke-push (EXECUTOR-PROTOCOL §0.7). (b) `prisma migrate dev` butuh shadow DB — user `app` = superuser (image default) → auto-create shadow DB OK. (c) Tidak ada migrasi existing → ini genuinely "init", tidak overwrite.

**Files to create**
```
prisma/migrations/<timestamp>_init_integration_channels/migration.sql
prisma/migrations/migration_lock.toml        (provider = postgresql)
```

**Files to modify**
- `prisma/schema.prisma` — **HANYA bila PM pilih Opsi B di GAP T02-#2** (reconcile ke spec). Default Opsi A = schema TIDAK disentuh.

**Approach**
Generate migration dari `schema.prisma` yang sudah ratified (`--create-only`), lalu append raw SQL untuk fitur yang PSL tidak bisa ekspresikan — persis seperti yang di-list schema di comment-block §148-169: 5 CHECK constraint (webhook provider, outbound status+provider, delivery status, health status+provider) + 2 partial index (`idx_webhook_events_unprocessed`, `idx_outbound_pending`). Apply ke DB lokal untuk validasi shadow-DB + `prisma generate` untuk pastikan client OK. Tidak menulis kode aplikasi/service. Tidak sentuh `src/`.

**GAPs / questions — butuh ACK PM A sebelum coding**

- **GAP T02-#1 — `hotel_id` topology / FK (per VERDICT T01 note).**
  - **Gap**: schema.prisma header (baris 19-22) sebut "Q-OPS-06 H12 ratification: shared Postgres, `hotel_id` → `hotels(id)` real FK". TAPI `data-model.md §1/§2` + spec §3 = Integration **own DB**, `hotel_id` **opaque, no FK**. Model Prisma juga tidak deklarasi relasi `hotels`.
  - **Doc reference**: `04-integration-channels.md §3`, `data-model.md §1/§2`, `schema.prisma:19-22`.
  - **Options**: A) opaque UUID, no cross-service FK (migrate schema apa adanya). B) tambah raw-SQL FK `hotel_id → hotels(id)` (butuh `hotels` ada di DB → shadow-DB migrate GAGAL, langgar CLAUDE.md §1 "1 service=1 DB=1 schema").
  - **My intent**: **A** — opaque UUID, no FK. Satu-satunya opsi yang feasible untuk single-schema migration + selaras spec §3/data-model. Header comment shared-DB = topologi alternatif, tak dapat diekspresikan di schema isolated ini. (Ini konfirmasi, bukan blocker.)

- **GAP T02-#2 — `schema.prisma` (F1 ratified) menyimpang dari spec §4 DDL di 2 titik non-fungsional.**
  - **Gap**: (i) `outbound_dispatch_queue.external_id` — schema = **full** `@@index([externalId])`; spec §4.5 = **partial** `WHERE external_id IS NOT NULL`. (ii) PK id auto — schema = client-side `@default(uuid())`; spec §4.4-4.8 = DB-side `DEFAULT gen_random_uuid()`. Comment-block schema TIDAK meng-list `idx_outbound_external` partial (konsisten dgn pilihan full-index si author).
  - **Doc reference**: `schema.prisma:98,104` + comment-block:148-169 vs `04-integration-channels.md §4.4-4.8`.
  - **Options**:
    - **A (default saya)** — hormati `schema.prisma` sebagai source-of-truth (artifact F1 sudah ter-review). Migrate as-is + append **hanya** SQL yang di-list comment-block schema (5 CHECK + 2 partial index). Deviasi (i)/(ii) dibiarkan; keduanya non-fungsional (full-index tetap melayani lookup `external_id=?`; `uuid()` di-supply Prisma Client). Schema TIDAK disentuh. **Zero dampak ke types B/C** (index & DB-default tidak muncul di Prisma Client types).
    - **B** — reconcile penuh ke spec §4: edit schema (`external_id` → hapus `@@index`, tambah raw partial; `@default(uuid())` → `@default(dbgenerated("gen_random_uuid()"))`). Lebih spec-faithful tapi meng-edit foundation schema.
  - **My intent**: **A**. Sebagai executor saya tidak sepatutnya override foundation schema yang sudah ratified berdasarkan bacaan spec saya sendiri — saya flag saja. Bila PM/PO mau spec-exact (B), saya kerjakan. Deviasi 0 dampak ke slot B/C.

Awaiting PM A ACK (khususnya keputusan GAP T02-#2 A vs B).

##### PM A ACK — T02 PLAN APPROVED, proceed to coding (H12, 2026-07-03)

Both GAP claims **verified independently** by PM A against `prisma/schema.prisma` (full read) + spec §4 (`04-integration-channels.md`). Confirmed: schema models have **no `@relation` to hotels** (already isolated-shaped); spec §4.1 L177 = "FK opaque if separate DB"; spec L169 = `gen_random_uuid()`; schema is **internally self-contradictory** (header L19-22 shared-FK vs models no-FK; comment L26 `gen_random_uuid` vs model `@default(uuid())`).

**GAP T02-#1 (hotel_id topology) → DECISION: Opsi A (opaque UUID, no FK). APPROVED.**
- Rationale: ADR-0004 + CLAUDE.md §1 (1 svc = 1 DB, **BUKAN shared DB**) + data-model §1/§2 + spec §4.1 ("opaque if separate DB") all mandate/permit isolated. These **outrank** the schema-header comment. Models already declare no FK → migrate as-written = opaque UUID column. Only feasible single-schema migration; forward-compatible (additive FK later if topology ever flips). This is the most-restrictive default per CLAUDE.md §14 — not me deciding architecture, but enforcing higher-authority planning.
- **BUT** the header's "Q-OPS-06 H12 shared-DB ratification" claim is escalated (see §3 Q-A-01) — PO must confirm isolated is authoritative + fix the stale header comment. Non-blocking; migration proceeds on A.

**GAP T02-#2 (schema vs spec §4 drift, 2 non-functional points) → DECISION: Opsi A (migrate schema as-written). APPROVED, with escalation.**
- I am **not** directing you to edit the ratified F1 schema on my spec-reading — your humility instinct is correct. Migrate schema as-is: full `@@index([externalId])`, client-side `@default(uuid())`.
- Both deviations (full-vs-partial index; client-vs-DB-side uuid) are **non-functional, zero-impact on B/C generated types, and additively fixable** (a follow-up migration can swap index / `ALTER COLUMN SET DEFAULT` with no data loss and no redo of this init migration). So Opsi A now costs ~0 even if PO later rules spec-exact.
- Escalated to PO for ratification (see §3 Q-A-02) with my recommendation = spec-faithful (partial index for the high-volume dispatch table; DB-side `gen_random_uuid()` is more robust for the RPC/multi-path insert surface of T09/T13). Non-blocking.

**Binding conditions — verify at SUBMIT:**
1. **CREATE TABLE order** in `migration.sql` must follow the mandated forward-only sequence: `wa_configs → telegram_configs → qr_state → webhook_events → outbound_dispatch_queue → delivery_receipts → channel_health_snapshots → ota_mailbox_state`. Minimum hard requirement: `outbound_dispatch_queue` before `delivery_receipts` (FK validity). If Prisma auto-order differs, reorder statements in the single init file.
2. **6 CHECK constraints — NOT 5.** Your PLAN says "5 CHECK" but enumerates 6 (webhook provider · outbound status · outbound provider · delivery status · health status · health provider incl. `claude_api`). All **6** from the comment-block L152-163 must land. Recount before SUBMIT.
3. **2 partial indexes** from comment-block: `idx_webhook_events_unprocessed`, `idx_outbound_pending`. Both present.
4. `prisma migrate dev` shadow-DB validation green + `prisma generate` types OK + `make check` green.
5. `.env` must NOT be committed (gitignored — confirm working tree clean of it at SUBMIT).
6. `migration_lock.toml` provider = `postgresql`; migration name `init_integration_channels` (descriptive ✓). No `src/` touched; `schema.prisma` untouched (Opsi A).

**CLI / scaffolder risk — approved.** Commands target LOCAL dockerized PG only (`localhost:5433`), fresh DB = genuine init (no overwrite), `--create-only` first is the right cautious flow. `.env` copy stays uncommitted. Branch `feat/prisma-init-migration` OK (CLAUDE.md §12 `feat/<short>`).

Proceed to coding. Post SUBMIT when the 6 conditions are green.

#### SUBMIT T02 — exec-A (Nathan) at H12 (2026-07-03) (attempt 1)

Task: Prisma initial migration — 8 Integration tables + indexes (forward-only)
Branch: `feat/prisma-init-migration` (pushed, commit `23a7e0f`)
Files changed: 2 (both new; `schema.prisma` UNTOUCHED per Opsi A)
  - `prisma/migrations/20260703064249_init_integration_channels/migration.sql` (new)
  - `prisma/migrations/migration_lock.toml` (new, `provider = "postgresql"`)

**⚠ Flagged deviation from PLAN's exact CLI (transparansi):** `prisma migrate dev --create-only` **menolak jalan** di environment non-interaktif (`Error: environment is non-interactive, not supported`). Saya pakai jalur non-interaktif yang setara & lebih auditable:
- `prisma migrate diff --from-empty --to-schema-datamodel` → generate base SQL (verified CREATE TABLE order = forward-only), lalu append raw SQL manual, lalu
- `prisma migrate deploy` → apply. Plus validasi shadow-DB-equivalent (di bawah). Tidak ada `migrate dev` interaktif dijalankan. Migration folder + `migration_lock.toml` di-assemble manual (identik format Prisma).

DoD self-check (6 binding conditions dari ACK)
- [x] **#1 CREATE TABLE forward-only order** — persis urutan mandated MVP §3: wa_configs → telegram_configs → qr_state → webhook_events → outbound_dispatch_queue → delivery_receipts → channel_health_snapshots → ota_mailbox_state. FK `delivery_receipts.dispatch_id → outbound_dispatch_queue(id)` di-emit SETELAH parent table. Prisma auto-order dari relasi.
- [x] **#2 semua 6 CHECK constraints** — verified di DB (`pg_constraint` count=6): webhook_events_provider, outbound_status, outbound_provider, delivery_receipts_status, channel_health_status, channel_health_provider (incl. `claude_api` di provider check). Terima koreksi PM: 6 bukan 5.
- [x] **#3 kedua partial index** — `idx_webhook_events_unprocessed` (WHERE processed_at IS NULL) + `idx_outbound_pending` (WHERE status='pending'). Verified `pg_indexes` WHERE-clause count=2. (Full `external_id` index tetap dari schema — Opsi A, tidak ditambah partial versi spec.)
- [x] **#4 shadow-DB-equivalent validation + generate + make check** — lihat Test evidence. `migrate deploy` sukses; **clean throwaway DB** `app_migval` (dibuat dari kosong, di-drop setelah) → tepat 8 tabel Integration + `_prisma_migrations`, 0 tabel Auth, 6 checks, 2 partial idx; drift check `migrate diff --from-schema-datamodel --to-url <clean> --exit-code` = **"No difference detected" exit 0**; `prisma generate` OK; `make check` hijau.
- [x] **#5 `.env` NOT committed** — `git status` bersih dari `.env` (gitignored, `git check-ignore .env` ✓). Working tree diff = hanya `prisma/migrations/`.
- [x] **#6 lock provider + name + schema untouched** — `migration_lock.toml` provider=postgresql; nama `init_integration_channels` deskriptif; `git diff --stat prisma/schema.prisma` = kosong (untouched); 0 file `src/` disentuh.

Quality gate
- `make lint`: PASS · `make format-check`: PASS · `make typecheck`: PASS · `make test-unit`: PASS (2 skipped, exit 0). `make check` exit 0.

Drift scans (§4.4)
- Diff = 2 file `prisma/migrations/` saja, **0 file `src/`** → tidak ada drift baru. (`any`/`console.log`/`throw new Error`/forbidden-import/default-export/`.skip` semuanya baseline di file yang tidak saya sentuh.)

Security check
- Tidak ada secret di migration/lock (hanya DDL). `.env` (berisi placeholder dev ENCRYPTION_KEY dll.) tidak di-commit. Kolom sensitif (`access_token_enc`, `bot_token_enc`, `imap_password_enc`) = TEXT ciphertext-holder per spec (enkripsi di app-layer = T03, bukan T02). N/A auth/webhook/crypto code.

Test evidence (validation transcript, ringkas)
```
# clean-DB validation (from empty)
CREATE DATABASE app_migval; prisma migrate deploy → "All migrations successfully applied"
tables(public) = _prisma_migrations, channel_health_snapshots, delivery_receipts,
  ota_mailbox_state, outbound_dispatch_queue, qr_state, telegram_configs,
  wa_configs, webhook_events   (9 rows = 8 Integration + _prisma_migrations, NO auth)
checks=6 · partial_idx=2
# drift
migrate diff --from-schema-datamodel schema.prisma --to-url <app_migval> --exit-code
  → "No difference detected."  (exit 0)
DROP DATABASE app_migval
```
- Integration test: N/A untuk T02 (migration DDL; no service logic). Repository/service integration tests land dengan modul B/C.

Notes / questions (untuk PM A)
- **Env kontaminasi (heads-up, bukan blocker):** DB dev lokal `app` di volume `postgres_data` ternyata sudah berisi tabel Auth (`hotels`, `users`, `sessions`, `tiers`, `password_reset_tokens`) dari run sebelumnya — DI LUAR `_prisma_migrations` (yang hanya berisi migrasi saya). Migration saya self-contained (no FK ke tabel itu), makanya saya validasi ulang di clean DB untuk bukti bebas-kontaminasi. Relevan untuk Q-A-01: kehadiran `hotels` di volume ini justru menunjukkan seseorang pernah co-locate Auth di sini, tapi arsitektur own-DB tetap yang saya ikuti. Slot B/C yang pakai volume sama sebaiknya `make start-fresh` (drop volume) agar DB Integration bersih.
- Opsi A dijalankan penuh: `schema.prisma` tidak diedit; deviasi non-fungsional (external_id full-index, client-side uuid) dibiarkan apa adanya, additively fixable bila Q-A-02 diputus spec-exact — tanpa redo init migration.

Requesting PM A VERDICT.

##### VERDICT T02 — APPROVED (H12, attempt 1) by PM A

✅ **APPROVE.** All 6 binding conditions verified — including an **independent clean-DB apply** by PM A (not trust-only), because T02 blocks slot B+C.

**Independent verification (PM reran on `feat/prisma-init-migration` `23a7e0f`):**
- **#1 CREATE TABLE order** — dumped from migration.sql: `wa_configs → telegram_configs → qr_state → webhook_events → outbound_dispatch_queue → delivery_receipts → channel_health_snapshots → ota_mailbox_state`. Exact mandated forward-only sequence ✓. FK added via trailing `ALTER TABLE` after all tables → order-safe ✓.
- **#2 CHECK ×6** — applied migration to a **fresh throwaway DB** (`pm_migval`, created empty, dropped after): all 6 user checks present (webhook provider · outbound status · outbound provider · delivery status · health status · health provider incl. `claude_api`) ✓. Executor corrected the "5→6" miscount.
- **#3 partial ×2** — `idx_webhook_events_unprocessed` + `idx_outbound_pending` present with WHERE clauses ✓.
- **#4 clean-DB validation** — my apply = exit 0; result = **8 Integration tables, ZERO auth tables**, 1 FK (`delivery_receipts→outbound_dispatch_queue`, no hotels FK), 6 checks, 2 partial idx. `make check` **green on PM rerun** (exit 0, 2 skipped). Migration self-contained + isolated-DB-clean ✓.
- **#5 `.env`** — `git ls-files .env` empty (untracked/gitignored) ✓.
- **#6 lock + name + schema** — `migration_lock.toml` provider=postgresql; name `init_integration_channels` descriptive; `schema.prisma` UNTOUCHED (Opsi A); diff = 2 files in `prisma/migrations/` only, **0 `src/`** ✓.
- **Opsi A integrity** — no `gen_random_uuid` / no hotels FK / full `external_id` index, exactly as decided. Deviations remain additively fixable pending Q-A-02.

**On the flagged CLI deviation (accepted):** `prisma migrate dev --create-only` refuses non-interactive envs — executor substituted `migrate diff --from-empty` + manual raw-SQL append + `migrate deploy`, then validated via clean-DB + `migrate diff ... --exit-code` = "No difference detected". My own independent clean-DB apply confirms the SQL is correct **regardless of generation path** — substitution is sound. Good transparency, not silent.

**Env-contamination heads-up (noted, not a T02 defect):** shared local `postgres_data` volume already holds Auth tables (`hotels`, `users`, …) from a prior run, outside `_prisma_migrations`. T02 migration is self-contained and validated clean, so no correctness impact. It **reinforces Q-A-01** (someone co-located Auth here) and is an operational note for B/C: start from a fresh volume (`make start-fresh`). Rolling to Parent PM §2 for cross-dev coordination.

→ §1 tracker: T02 `approved`, Verified by PM A.
→ Code on `feat/prisma-init-migration` awaiting **PO merge + CI** (PM does not merge).
→ Q-A-01 / Q-A-02 remain open for PO — neither blocks; both additively fixable.

**Executor A: T02 done — slot B (T10+) & C (T17+) are now schema-unblocked.** Next in your queue: **T03** (AES-256-GCM encryption helper — extend existing `src/shared/utils/crypto.ts`, fail-fast on missing key env, token masking on GET). Post PLAN when ready.

### ASSIGNMENT T03 — claimed by exec-A (Nathan) at H12 (2026-07-03)
- Branch: `feat/crypto-at-rest` (proposal — `feat/<short>` per CLAUDE.md §12)
- Routed from: PM-STATUS-A.md §1 T03 + VERDICT T02 hand-off. Spec: `MVP-INTEGRATION-FIRST.md §4.1` (fail-fast), `docs/SECURITY.md §3` (algo + envelope + rotation), guardrail (crypto → `src/shared/utils/crypto.ts`, JANGAN `src/common/`).

#### PLAN T03 — exec-A (Nathan) at H12 (2026-07-03)

**Scope recap**
- T03 = implement encryption-at-rest helper AES-256-GCM di `src/shared/utils/crypto.ts` (SUDAH ADA, isinya stub `throw new Error('...not implemented')`). Dikonsumsi T10 (`wa_configs.access_token_enc`) + T17 (`telegram_configs.bot_token_enc`, `ota_mailbox_state.imap_password_enc`). Envelope `v<version>:<iv_hex>:<ct_hex>:<tag_hex>` per SECURITY §3.

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot A (Nathan) ✓
- CLAUDE.md loaded ✓
- Task spec read: `SECURITY.md §3` (AES-256-GCM, envelope, rotation strategy), `MVP-INTEGRATION-FIRST.md §4.1` (encrypt-before-persist, fail-fast on missing key), `docs/TESTING.md` (unit pattern).
- Parent docs spot-read: `crypto.ts` (stub + documented envelope), `masking.ts` (`maskTokenForLog` sudah ada), `core/config/env.ts` (`ENCRYPTION_KEY` = `.length(64)` hex = 32 bytes; `ENCRYPTION_KEY_VERSION` default `v1`; lazy `loadConfig()`), `core/errors/app-errors.ts` (AppError hierarchy — tidak ada kelas 500 generic selain TenantError).
- Dependencies: T01 ✓ (make check baseline), T02 ✓ (schema — kolom `*_enc` TEXT sudah ada). Config `ENCRYPTION_KEY` sudah divalidasi env loader (fail-fast di boot).
- **Probe (throwaway, sudah dihapus, working tree bersih)**: T03 = unit test **eksekusi nyata** pertama (T01/T02 test semua skipped). Saya probe `make test:unit` dengan test riil (import `node:crypto` + ESM local import) → **PASS tanpa** `--experimental-vm-modules`. → **`test:unit` script TIDAK perlu diubah**. (Jawab kekhawatiran ESM yang saya flag di T01.)
- `make check` clean baseline ✓ (belum sentuh apa pun). Scaffolder risk: none.

**Files to modify**
- `src/shared/utils/crypto.ts` — implement `encrypt`/`decrypt`/`encryptDsn`/`decryptDsn` (signature EXISTING, tidak diubah). Tambah `CryptoError` (kelas lokal `extends Error`) + `resolveKeyForVersion` internal.

**Files to create**
```
src/shared/utils/__tests__/crypto.test.ts   (unit test — roundtrip, tamper-detection, malformed, fail-fast)
```

**Approach**
- `encrypt(plaintext)`: `key = Buffer.from(config.ENCRYPTION_KEY,'hex')` (assert 32 byte, else `CryptoError`), `iv = randomBytes(12)`, `aes-256-gcm`, envelope `${config.ENCRYPTION_KEY_VERSION}:${ivHex}:${ctHex}:${tagHex}`. Random IV per-call → ciphertext non-deterministik.
- `decrypt(envelope)`: split ':' → wajib 4 part (`CryptoError` bila tidak), `resolveKeyForVersion(version)`, `setAuthTag(tag)`, `final()` auto-verify GCM (tamper → throw, saya bungkus jadi `CryptoError` pesan aman tanpa leak key/plaintext).
- `resolveKeyForVersion`: version === `config.ENCRYPTION_KEY_VERSION` → current key; selain itu → `CryptoError('no key configured for version …')` (lihat GAP T03-#1 soal rotation).
- `encryptDsn`/`decryptDsn`: tetap delegasi ke `encrypt`/`decrypt` (per SECURITY §3 tabel).
- **Fail-fast**: `loadConfig()` sudah throw kalau `ENCRYPTION_KEY` hilang/≠64 char (env `.length(64)`). encrypt/decrypt panggil `loadConfig()` (cached) → otomatis fail-fast. Plus guard 32-byte decode.
- **Error class**: `CryptoError extends Error` (BUKAN AppError) — crypto util context-agnostic (dipakai worker/CLI juga, bukan cuma HTTP), jadi tak coupling ke `statusCode`. `throw new Error` drift-scan hanya target `modules/`+`core/`, `shared/` aman — tapi saya tetap pakai kelas bernama, bukan raw Error.
- **Masking di GET**: sudah tercakup `masking.ts` (`maskTokenForLog`) — dipakai B/C di layer CRUD response. T03 tidak perlu tambah masking. (Konfirmasi, bukan kerjaan baru.)
- Test: roundtrip (ascii/unicode/empty), IV-random (2× encrypt beda ct), tamper ct/tag → throw, malformed envelope → throw, unknown version → throw, encryptDsn roundtrip, invalid key (set `ENCRYPTION_KEY` pendek + `resetConfigCache()`) → throw. Set `process.env.ENCRYPTION_KEY` valid di test + `resetConfigCache()`.

**GAPs / questions — butuh ACK PM A**
- **GAP T03-#1 — cakupan key rotation (multi-version decrypt).**
  - **Gap**: SECURITY §3 "Key rotation strategy" + doc-comment `crypto.ts` mendeskripsikan decrypt multi-version (retired key di `ENCRYPTION_KEY_RETIRED_<Vn>`). TAPI `env.ts` tidak model retired-key, dan MVP §4.1 hanya wajib encrypt/decrypt + fail-fast (rotation = prosedur ops, bukan AC MVP §5).
  - **Doc reference**: `SECURITY.md §3`, `crypto.ts:5-8`, `env.ts:40-41`, `MVP-INTEGRATION-FIRST.md §4.1/§5`.
  - **Options**:
    - **A (default saya)** — implement **current-version saja**, envelope tetap versioned, `resolveKeyForVersion` throw `CryptoError` untuk versi non-current. Struktur siap-extend (nambah retired-key nanti = ~3 baris). Zero perubahan `env.ts`, zero baca `process.env` langsung. YAGNI-correct untuk MVP.
    - **B** — full multi-version decrypt sekarang: `resolveKeyForVersion` baca `ENCRYPTION_KEY_RETIRED_<VERSION>` (dari `process.env` langsung atau tambah field `env.ts`). Honor SECURITY §3 penuh, tapi nambah surface untethered + (bila via process.env) menyimpang prinsip "config lewat @core/config".
  - **My intent**: **A**. Envelope versioned sejak awal → forward-compatible; rotation machinery ditambah saat benar-benar dibutuhkan (ops rotation, pasca-MVP) tanpa re-encrypt data lama. Bila PM/PO mau rotation penuh di MVP, saya kerjakan B (dan route env-schema question ke PO).

Awaiting PM A ACK (khususnya GAP T03-#1 A vs B).

##### PM A ACK — T03 PLAN APPROVED, proceed to coding (H12, 2026-07-03)

All PLAN claims **verified** by PM A: `crypto.ts` stub + envelope doc ✓; `env.ts` `ENCRYPTION_KEY .length(64)` + `ENCRYPTION_KEY_VERSION` default `v1` + `loadConfig()` fail-fast + `resetConfigCache()` ✓ (no `ENCRYPTION_KEY_RETIRED_*` field — confirms the gap); SECURITY §3 rotation = ops *strategy* not MVP AC; `maskTokenForLog` exists in `masking.ts` ✓.

**GAP T03-#1 (key rotation scope) → DECISION: Opsi A (current-version only, versioned envelope, extensible). APPROVED.**
- Rationale: MVP §4.1 mandates only encrypt/decrypt + fail-fast; SECURITY §3 multi-version decrypt is step 3 of a *rotation procedure* (with background re-encrypt job) = post-MVP ops, not an MVP §5 AC. Opsi A keeps the envelope versioned from day 1 → **forward-compatible** (old ciphertext still decrypts once retired-key resolution is added later, ~3 lines + env field). Opsi B would either read `process.env` directly (violates CLAUDE.md §4 "config lewat @core/config") or add an `env.ts` field for a feature not needed now (larger core/config surface). Opsi A is YAGNI-correct + most-restrictive (throws on unknown version rather than reaching into env). Zero `env.ts` change.

**Binding conditions — verify at SUBMIT (security floor, CLAUDE.md §6 + my scope constraints):**
1. **Algo/envelope**: AES-256-GCM, **12-byte random IV per call**, envelope exactly `v<version>:<iv_hex>:<ct_hex>:<tag_hex>` per SECURITY §3. IV randomness proven by test (2× encrypt of same plaintext → different ciphertext).
2. **Fail-fast**: missing/invalid `ENCRYPTION_KEY` → throw (via `loadConfig()`), plus explicit 32-byte key-length assertion. Test must prove fail-fast on missing/short key (using `resetConfigCache()`).
3. **Tamper detection**: decrypt verifies GCM auth-tag → mutated ciphertext AND mutated tag each throw. Both cases tested. Malformed envelope (≠4 parts) + unknown version → throw.
4. **No secret leakage**: `CryptoError` messages must NOT contain key material or plaintext. Confirm message strings.
5. **Named error, no raw `throw new Error(`**: replace ALL stub `throw new Error(...)` in crypto.ts with `CryptoError`. `CryptoError extends Error` accepted for now (crypto util is context-agnostic — HTTP + worker/CLI — so coupling to AppError's `statusCode` is wrong; error-handler plugin's non-AppError fallback → 500, no leak). When T08 error catalog lands we may reconcile — note only, not a blocker.
6. **Scope/no `any`**: files = modify `src/shared/utils/crypto.ts` + create `src/shared/utils/__tests__/crypto.test.ts` only. **No `env.ts` / core/config change** (Opsi A). Strictly typed, 0 `any`. Coverage ≥ 80% for crypto.ts.
7. **`make check` green** — this is the **first real executing unit test** (T01/T02 were skipped), so it also validates the harness end-to-end. If `test:unit` needs no `--experimental-vm-modules` (your probe says so), the script stays unchanged — confirm at SUBMIT.

**Out of T03 scope (noted so it isn't dropped later):** token **masking-on-GET** is enforced at the B/C config-CRUD response layer (T10/T17) via `maskTokenForLog` — I'll gate it there, not here. Correct to exclude from T03.

Branch `feat/crypto-at-rest` OK (CLAUDE.md §12). Proceed to coding.

#### SUBMIT T03 — exec-A (Nathan) at H12 (2026-07-03) (attempt 1)

Task: AES-256-GCM encryption-at-rest helper (Opsi A — current-version)
Branch: `feat/crypto-at-rest` (pushed, commit `f2b9fcf`)
Files changed: 3
  - `src/shared/utils/crypto.ts` (modified — implement encrypt/decrypt/encryptDsn/decryptDsn + `CryptoError`)
  - `src/shared/utils/__tests__/crypto.test.ts` (new — 13 unit tests)
  - `jest.config.cjs` (modified — **flagged test-infra side-effect**, lihat Notes #1)

**⚠ 2 hal di luar "2 file only" (kondisi #6) — transparansi, mohon verifikasi:**
- **#1 `jest.config.cjs` moduleNameMapper** — test pertama yang import alias `@core/*` dengan ekstensi `.js` (`@core/config/env.js`, wajib untuk NodeNext typecheck) GAGAL resolve: mapper alias lama `^@core/(.*)$` tidak strip `.js` → cari `src/core/config/env.js` (padahal `.ts`). Fix: `^@core/(.*?)(?:\\.js)?$` (+ modules/plugins/shared) agar strip `.js` seperti mapper relative sudah lakukan. Ini **bukan** perubahan `env.ts`/core-config (kondisi #6 melarang itu — tidak saya sentuh); ini test-config gap latent boilerplate, analog side-effect `tsconfig.eslint.json` di T01. General fix → semua test masa depan yang import alias bisa jalan.
- **#2 `NODE_ENV` di test env** — Jest set `NODE_ENV=test`, tapi `env.ts` enum hanya `development|staging|production` → `loadConfig()` throw sebelum sampai crypto. Saya set `NODE_ENV:'development'` di `BASE_ENV` test (localized, dalam file test saja — TIDAK edit `env.ts`). **Observasi/GAP-kandidat** (bukan act T03): tiap test masa depan yang panggil `loadConfig()` kena ini; fix global sebaiknya di `test-setup.ts` (baseline env) atau tambah `'test'` ke enum — keputusan infra terpisah, saya flag saja.

DoD self-check (7 binding conditions)
- [x] **#1 Algo/envelope** — `aes-256-gcm`, IV `randomBytes(12)` per call, envelope `${version}:${ivHex}:${ctHex}:${tagHex}`. Test `should produce a versioned 4-part envelope` (parts=4, `parts[0]==='v1'`) + `different ciphertext each call` (IV random) PASS.
- [x] **#2 Fail-fast** — encrypt/decrypt panggil `loadConfig()` (throw kalau `ENCRYPTION_KEY` hilang/≠64) + `decodeKey` regex-guard 64-hex/32-byte. Test `missing ENCRYPTION_KEY → throw` + `64 non-hex → CryptoError` PASS.
- [x] **#3 Tamper detection** — GCM `final()` auth check; mutated ciphertext, mutated tag, malformed (≠4 parts), wrong iv-length, unknown version → semua throw `CryptoError`. 5 test PASS.
- [x] **#4 No secret leakage** — `CryptoError` messages statis (`'Malformed ciphertext envelope'`, `'Decryption failed: authentication tag mismatch or corrupt ciphertext'`, `'No encryption key configured for version "…"'`, key-format msg). Tidak ada key/plaintext di pesan. Verified by reading.
- [x] **#5 Named error** — semua stub `throw new Error(...)` diganti `CryptoError extends Error`. 0 raw `throw new Error(` di crypto.ts. (Reconcile ke AppError saat T08 = noted, non-blocker.)
- [x] **#6 Scope/no any/coverage** — `env.ts`/core-config TIDAK disentuh (Opsi A). 0 `any` di crypto.ts + test (`as string` cast di test bukan `as any`). **Coverage crypto.ts = 100%** stmts/branch/funcs/lines (jauh > 80% floor). (Deviasi: +1 file `jest.config.cjs`, lihat Notes #1.)
- [x] **#7 make check green** — first real executing unit test; `test:unit` jalan **tanpa** `--experimental-vm-modules` → script package.json TIDAK diubah. `make check` exit 0.

Quality gate
- `make lint`: PASS · `make format-check`: PASS · `make typecheck`: PASS · `make test-unit`: PASS (13 crypto + 2 skipped template). `make check` exit 0.

Drift scans (§4.4)
- `any`: 2 hits — **baseline** `_template/` (file tak disentuh). My files: 0.
- console: 0 · forbidden imports: 0 · default export di luar entry/config: 0.
- `throw new Error(` di modules/core: 4 — **baseline** (`_template`, `core/config`, `core/http`); crypto.ts di `shared/` pakai `CryptoError`, 0 raw.
- `.skip`: 2 — baseline `_template/`.
- My diff = `crypto.ts` + `crypto.test.ts` + `jest.config.cjs` only. 0 perubahan `src/` lain, 0 `env.ts`.

Security check (task touch crypto)
- Token encryption via `shared/utils/crypto` (AES-256-GCM): yes. HMAC: N/A (T04). PII masking: N/A (masking-on-GET = B/C layer). No secret hardcoded: confirmed (`VALID_KEY='a'*64` di test = dummy, bukan real key; `.env` tidak disentuh/commit).

Test evidence
- Unit: 13 tests, `src/shared/utils/__tests__/crypto.test.ts` — roundtrip (ascii/unicode/empty), envelope shape, IV-random, tamper ct, tamper tag, malformed, wrong-iv-length, unknown-version, encryptDsn roundtrip, fail-fast missing-key, non-hex-key guard.
- Coverage crypto.ts: 100% / 100% / 100% / 100%.
- Integration: N/A (pure helper, no DB/IO).

Notes / questions (untuk PM A)
- 2 test-infra items di atas (jest mapper fix + NODE_ENV test-env). Keduanya perlu keputusan/ack; mapper fix saya nilai necessary & general, NODE_ENV saya batasi ke file test + flag untuk fix global terpisah.
- `CryptoError` reconcile ke AppError → tunggu T08 (noted di ACK #5).

Requesting PM A VERDICT.

##### VERDICT T03 — APPROVED (H12, attempt 1) by PM A

✅ **APPROVE.** All 7 binding conditions verified independently; crypto reviewed line-by-line as a security-floor deliverable.

**Independent verification (PM reran on `feat/crypto-at-rest` `f2b9fcf`):**
- **#1 algo/envelope** — `aes-256-gcm`, `randomBytes(12)` IV per call, envelope `v1:<iv>:<ct>:<tag>`; IV-randomness test (2× encrypt → different ct) ✓.
- **#2 fail-fast** — `loadConfig()` throws on missing/short key + `decodeKey` regex-guards 64-hex/32-byte; both tested (missing-key + 64-non-hex) ✓.
- **#3 tamper detection** — GCM `final()` wrapped in `CryptoError`; mutated-ct, mutated-tag, malformed (≠4 parts), wrong-iv-length, unknown-version all throw; 5 tests ✓. Tag length pinned to 16 bytes (blocks truncated-tag) — good defensive touch.
- **#4 no leakage** — `CryptoError` messages static; only the **public** envelope version string appears (`"v1"`), never key/plaintext ✓.
- **#5 named error** — 0 raw `throw new Error(` in crypto.ts; all `CryptoError` ✓.
- **#6 scope/no-any/coverage** — `env.ts`/core-config UNTOUCHED (Opsi A held); **0 `any`** in crypto.ts + test (`as string`, not `as any`); **crypto.ts coverage = 100/100/100/100** (PM reran `jest --coverage`), well above the 80% floor ✓.
- **#7 make check green** — PM rerun exit 0; 13 crypto tests pass; `test:unit` runs without `--experimental-vm-modules` → `package.json` unchanged, resolving the T01 ESM watch-item ✓.

**On the 2 flagged side-effects — both accepted:**
- **jest.config.cjs moduleNameMapper** (`^@core/(.*)$` → `^@core/(.*?)(?:\.js)?$`, +modules/plugins/shared) — legitimate, general, correct: this is the first test importing a `@core/*` alias with a `.js` suffix (required by NodeNext), exposing a latent boilerplate gap; the optional `(?:\.js)?` mirrors the existing relative-import stripper and is backward-compatible. Verified only the 4 mapper lines changed — coverageThreshold/preset/setup/timeout intact. Does **not** touch the surface condition #6 protected (env.ts/core-config). Analogous to T01's tsconfig side-effect. Transparent, not silent.
- **`NODE_ENV` localized in test BASE_ENV** — Jest sets `NODE_ENV=test` but `env.ts` enum lacks `test`, so `loadConfig()` would throw. Localizing `NODE_ENV:'development'` to the test file (no env.ts edit) is the correct minimal fix for T03. Accepted.

**One tracked follow-up (does NOT hold T03):** the `NODE_ENV=test` gap is **shared-infra** — every future test calling `loadConfig()` (T04/T05… and slots B/C) will hit it. A global fix belongs in `src/shared/utils/test-setup.ts` (baseline env) or adding `'test'` to the enum — that touches shared infra affecting >1 dev, so I'm raising it to Parent PM rather than patching unilaterally (§3 Q-A-03 + PARENT roll-up). Recommendation: small chore setting a baseline test env in `test-setup.ts`.

→ §1 tracker: T03 `approved`, Verified by PM A. → Code on `feat/crypto-at-rest` awaiting **PO merge + CI** (PM does not merge).

**Executor A: T03 done — T10 (WA config) + T17 (Telegram config) now have their encryption primitive.** Foundation critical path (T01→T02→T03) complete. Next in queue: **T04** (webhook signature-verify plugin — `src/plugins/hmac-validator.plugin.ts`, **plugin-level before handler**, WA `X-Hub-Signature-256` → 401 with no `webhook_events` insert, Telegram own scheme). Post PLAN when ready.

### ASSIGNMENT T04 — claimed by exec-A (Nathan) at H12 (2026-07-03)
- Branch: `feat/hmac-webhook-verify` (proposal, `feat/<short>` per CLAUDE.md §12)
- Routed from: PM-STATUS-A.md §1 T04 + VERDICT T03 hand-off. Spec: `SECURITY.md §4` (HMAC + timingSafeEqual), `04-integration-channels.md §2.3/§8` (webhook ingress, no session), `MVP-INTEGRATION-FIRST.md §4.2` (verify → 401, no exceptions), guardrail (`src/plugins/hmac-validator.plugin.ts`; plugins/ kosong).

#### PLAN T04 — exec-A (Nathan) at H12 (2026-07-03)

**Scope recap**
- T04 = plugin verifikasi signature webhook, jalan **plugin-level SEBELUM handler**, sehingga invalid → 401 dan handler tak pernah jalan (→ **no `webhook_events` insert**). WA: `X-Hub-Signature-256` (`sha256=<hmac-sha256(rawBody, secret)>`). Telegram: header `X-Telegram-Bot-Api-Secret-Token` (secret echo, Telegram tidak HMAC-sign). `timingSafeEqual` wajib. Foundation primitive — dikonsumsi B (webhook WA ingest) & C (Telegram webhook).

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot A (Nathan) ✓ · CLAUDE.md loaded ✓
- Task spec read: `SECURITY.md §4` (contoh `createHmac('sha256')` + `timingSafeEqual`, WAJIB bukan `===`), `04-integration-channels.md §2.3` (`POST /webhook/whatsapp|telegram/:hotel_slug`, `X-Hub-Signature-256`) + §8 (webhook no Auth session, secured via signature) + §9 (no dedicated sig-fail code → 401/`AuthError`), `MVP §4.2` (401, no exceptions).
- Parent docs spot-read: `api.ts` (Fastify **stub** — belum wired; T04 = primitive, live-wiring nanti oleh B/C), `app-errors.ts` (`AuthError` 401 sudah ada), `crypto.ts`/`env.ts` (pola).
- Dependencies: T01 ✓. **Catatan dep**: secret per-hotel dari `wa_configs.webhook_verify_token`/`telegram_configs` (domain B/C) + resolusi `:hotel_slug`→`hotel_id` (T05, belum ada). → T04 pakai **injected secret-resolver** (GAP #2), tidak hard-couple ke DB/T05.
- **Dep availability check**: `fastify-plugin` & `fastify-raw-body` **TIDAK** di `package.json` (fastify-plugin cuma transitive → pnpm strict = tak importable tanpa declare = PO-gated). → **Zero new dep**: desain tanpa `fp`, raw-body via custom content-type parser.
- `make check` clean baseline ✓. Scaffolder risk: none.

**Files to create**
```
src/plugins/hmac-validator.plugin.ts
src/plugins/__tests__/hmac-validator.plugin.test.ts
```

**Files to modify**
- (none) — `api.ts` masih stub; T04 tidak wire ke server hidup (deferred ke assembly). Tidak sentuh `env.ts`/`src` lain.

**Approach (arsitektur)** — export dari `hmac-validator.plugin.ts`:
1. **Pure core** (unit-test tanpa Fastify): `verifyMetaSignature(rawBody: Buffer, header: string|undefined, secret: string): boolean` (parse `sha256=`, `createHmac('sha256',secret).update(rawBody).digest`, guard equal-length lalu `timingSafeEqual`); `verifyTelegramToken(header: string|undefined, secret: string): boolean` (constant-time equal). Length-mismatch → `false` (hindari throw `timingSafeEqual`).
2. **Raw-body parser**: `registerWebhookRawBody(app)` — `addContentTypeParser('application/json',{parseAs:'buffer'}, …)` simpan `req.rawBody: Buffer` lalu `JSON.parse`. (HMAC wajib atas byte mentah, bukan re-serialize.) + module augmentation `FastifyRequest.rawBody`.
3. **Hook factory**: `verifyWebhookSignature(opts:{ provider:'whatsapp'|'telegram'; resolveSecret:(req)=>string|Promise<string> }): preHandlerHookHandler` — ambil `req.rawBody` + header provider, resolve secret (injected), verify; gagal → `throw new AuthError('Invalid webhook signature')`. preHandler throw sebelum handler → handler tak jalan → **no webhook_events insert** (invariant terjaga tanpa tergantung error-handler).
- **Consumption (B/C nanti)**: `registerWebhookRawBody(scope)` + route `preHandler: verifyWebhookSignature({...})`. Tanpa `fp` (parser + route se-scope).
- **Test** (`fastify.inject`, in-proc, no DB/Redis): valid WA sig → 200 + handler-ran flag true; invalid/missing/`sha256=`-malformed → 401 + handler-ran **false** (bukti no-handler-exec = proxy no-insert); Telegram valid/invalid; pure-fn unit (timing-safe, length-mismatch). Daftar error-handler mini `AppError→statusCode` (GAP #3).

**GAPs / questions — butuh ACK PM A**
- **GAP T04-#1 — raw-body capture.** A (default): custom `addContentTypeParser` parseAs buffer + `JSON.parse`, simpan `req.rawBody`. Zero dep. B: `fastify-raw-body` (new dep → PO). **Intent: A.**
- **GAP T04-#2 — secret source decoupling.** Secret per-hotel di config B/C + butuh T05. A (default): T04 expose hook factory dgn **`resolveSecret` injected** (port-style); B/C wire resolver DB nanti; test pakai stub. B: tunggu T05 (blokir T04). **Intent: A.**
- **GAP T04-#3 — 401 translation vs invariant.** `AuthError` throw sebelum handler menjamin **no insert** apa pun. Kode **401** butuh global error-handler (T08, belum ada). A (default): plugin **throw `AuthError`** (konvensi SECURITY §4); 401 diproduksi error-handler saat T08; test daftar mini error-handler lokal utk assert 401. B: `reply.code(401).send()` langsung (self-contained tapi menyimpang konvensi). **Intent: A.**
- **Nota (bukan blocker) — WA secret semantics:** spec §4.2 verify `X-Hub-Signature-256` thd `webhook_verify_token`; Meta-native X-Hub ditandatangani **App Secret** (verify_token utk GET-challenge). T04 agnostik (secret via resolver) → nuansa ini urusan wiring B; saya flag, tidak act.

Awaiting PM A ACK (GAP #1/#2/#3).

##### PM A ACK — T04 PLAN APPROVED, proceed to coding (H12, 2026-07-03)

Verified by PM A: `AuthError` has `readonly statusCode = 401` (app-errors.ts:33); SECURITY §4 canonical example = `createHmac('sha256')` + `timingSafeEqual` + `throw AuthError` (exactly your approach); `fastify-plugin`/`fastify-raw-body` NOT in package.json; `api.ts` fully stubbed. All three intents sound.

**GAP T04-#1 (raw-body) → Opsi A (custom `addContentTypeParser` parseAs buffer, zero-dep). APPROVED.** HMAC MUST be over raw bytes (re-serialized JSON breaks the signature); `fastify-raw-body` = PO-gated new dep. Encapsulated per-scope parser (no `fp`) is the correct Fastify pattern — won't pollute the global JSON parser.

**GAP T04-#2 (secret decoupling) → Opsi A (injected `resolveSecret` hook factory). APPROVED.** Textbook hexagonal-disiplin (ADR-0001): T04 is a primitive; injecting the secret resolver keeps it unit-testable with a stub and unblocks T04 from T05. Do NOT hard-couple to DB/T05.

**GAP T04-#3 (401 vs invariant) → Opsi A (throw `AuthError`). APPROVED — with a clarification.** Throw-in-preHandler guarantees the handler never runs → **no `webhook_events` insert** (the binding invariant), independent of T08. **AND I verified the literal 401 is produced natively**: Fastify's default error handler reads `error.statusCode`, and `AuthError.statusCode = 401` → `fastify.inject` on an invalid sig returns **401 pre-T08, no custom handler required**. So your test should assert the **native 401** via `inject` (that's the real runtime behavior B/C get today) — the "mini local error-handler" is unnecessary; drop it or keep only as a T08-preview, but the native-401 assertion is the one that must pass. Opsi B (`reply.code(401)` directly) rejected — deviates from SECURITY §4 / CLAUDE §5.4 convention.

**Nota (WA secret semantics) → escalated as Q-A-04 (affects slot B, not a T04 blocker).** Your catch is correct and important: Meta signs `X-Hub-Signature-256` with the **App Secret**, while `webhook_verify_token` is for the GET verify-challenge (`hub.verify_token`) — spec §4.2 conflates them, and `wa_configs` has no `app_secret` column. T04 is agnostic (injected secret) so unaffected, but **B (T12 webhook ingest) will verify against the wrong secret** unless resolved, and it may need a schema follow-up (add `app_secret_enc`). Raised to Parent PM → PO / PM B (§3 Q-A-04 + PARENT §3a). You: flag only, do NOT act in T04 — correct.

**Binding conditions — verify at SUBMIT (security floor):**
1. **`timingSafeEqual`** (never `===`); length-guard BEFORE it (it throws on unequal length) → length-mismatch returns `false`, not throw. Tested.
2. **HMAC over raw bytes** — `req.rawBody` (Buffer) from the content-type parser; computed on raw buffer, not re-serialized JSON. Prove it: sign a body with non-canonical whitespace/key-order, send exact bytes → 200; a re-serialized digest would fail.
3. **plugin-level BEFORE handler** — verification in a `preHandler` hook; invalid → `throw AuthError` → **handler never runs**. Test asserts handler-ran = `false` on invalid (proxy for no-insert invariant). This is the core WAJIB.
4. **401 native** — `inject` returns 401 on invalid/missing/malformed WA `X-Hub-Signature-256` + Telegram `X-Telegram-Bot-Api-Secret-Token`, via `AuthError.statusCode` (no T08 dependency).
5. **`AuthError` thrown** (not raw `Error`, not direct `reply`). Message generic (`'Invalid webhook signature'`) — no secret/body leak.
6. **Zero new deps** — package.json + lockfile unchanged.
7. **Files** — `src/plugins/hmac-validator.plugin.ts` + its test only; `api.ts`/`env.ts` untouched; 0 `any`; explicit return types on exported fns; coverage ≥ 80%. `declare module 'fastify'` augmentation for `rawBody` is fine.
8. **Telegram** — constant-time secret-echo compare (Telegram doesn't HMAC-sign) ✓.

Branch `feat/hmac-webhook-verify` OK. Note: if the `NODE_ENV=test` gap (Q-A-03) bites this test's `loadConfig()` path, apply the same localized in-test workaround as T03 — don't fix it globally here (still Parent-PM-routed shared-infra). Proceed to coding.

#### SUBMIT T04 — exec-A (Nathan) at H12 (2026-07-03) (attempt 1)

Task: Webhook signature-verification plugin (WA `X-Hub-Signature-256` + Telegram secret-echo)
Branch: `feat/hmac-webhook-verify` (pushed, commit `e101e6a`)
Files changed: 2 (both new)
  - `src/plugins/hmac-validator.plugin.ts` (new)
  - `src/plugins/__tests__/hmac-validator.plugin.test.ts` (new, 15 tests)

DoD self-check (8 binding conditions)
- [x] **#1 `timingSafeEqual` + length-guard** — `constantTimeEqual` cek `bufA.length !== bufB.length` → `false` SEBELUM `timingSafeEqual` (yang throw kalau beda length). Test `provided hex length differs` + `telegram token differs in length` → `false`, no throw.
- [x] **#2 HMAC over raw bytes** — `req.rawBody` (Buffer) dari content-type parser; HMAC atas buffer mentah. **Dibuktikan**: test `verify HMAC over raw bytes` kirim body non-canonical `{"b":2,   "a":1}` (whitespace + key unsorted), sign byte persis → **200**. Digest atas `JSON.stringify(parsed)` akan beda → gagal. Lulus.
- [x] **#3 plugin-level SEBELUM handler** — verifikasi di `preHandler` hook; invalid → `throw AuthError` → handler tak jalan. Test assert `didHandlerRun()===false` di semua kasus invalid (WA wrong/missing, Telegram wrong). **Invariant no-`webhook_events`-insert** terjaga.
- [x] **#4 401 native** — `fastify.inject` → **401** untuk WA sig salah, header hilang, `sha256=`-malformed, + Telegram token salah. Via `AuthError.statusCode=401` (default Fastify error handler), **tanpa** T08/custom handler. Lulus.
- [x] **#5 `AuthError` thrown, generic msg** — `throw new AuthError('Invalid webhook signature')` (bukan raw Error/reply langsung). Pesan statis, tak ada secret/body.
- [x] **#6 zero new deps** — `package.json` + `pnpm-lock.yaml` UNCHANGED (`git diff` bersih). Tanpa `fp`/`fastify-raw-body`.
- [x] **#7 files/no-any/return-types/coverage** — hanya `hmac-validator.plugin.ts` + testnya; `api.ts`/`env.ts` UNTOUCHED; **0 `any`**; return type eksplisit di semua exported fn; `declare module 'fastify'` augment `rawBody`. **Coverage plugin = 100% line / 100% func / 80% branch** (jauh > 80% line floor; 3 branch tak-tercover = defensive fallback: header-array, non-buffer body, `rawBody ?? alloc(0)`).
- [x] **#8 Telegram** — `verifyTelegramToken` constant-time secret-echo compare (Telegram tak HMAC-sign). Test valid/invalid/missing.

Quality gate
- `make lint`: PASS · `make format-check`: PASS · `make typecheck`: PASS · `make test-unit`: PASS (28: 13 crypto + 15 hmac; 2 skipped template). `make check` exit 0.

Drift scans (§4.4)
- My files: `any` 0 · console 0 · `throw new Error(` 0 (pakai `AuthError`/`ValidationError`) · forbidden imports 0 · default export 0 · `.skip` 0.
- Baseline lain (di `_template/`/core, tak disentuh) tidak berubah. Diff = 2 file `src/plugins/` saja.

Security check (task = webhook/HMAC)
- HMAC verified before business logic (preHandler before handler): **yes**. `timingSafeEqual` (bukan `===`): yes. AuthError before handler → no insert on spoof: yes. No secret hardcoded (test pakai dummy `'test-webhook-secret'`): confirmed. Secret injected (resolver), plugin tak simpan/log secret.

Test evidence
- Unit: 15 tests. 7 pure (`verifyMetaSignature`/`verifyTelegramToken`: match, no-prefix, undefined, length-mismatch, telegram match/mismatch/undefined) + 6 inject (WA valid, WA raw-byte-proof, WA wrong→401, WA missing→401, TG valid, TG wrong→401) + 2 parser (empty-body→200/undefined, malformed-json→400).
- Coverage: 100/80/100/100.
- Integration: N/A murni (in-proc `fastify.inject`, no DB/Redis).

Notes / questions (untuk PM A)
- **Item butuh keputusan — eslint `no-misused-promises` vs Fastify async hooks.** Async hook di **property** route-option (`preHandler`) memicu `checksVoidReturn.properties` (typecheck LULUS — ini strictness lint, bukan bug; runtime benar). Saya pakai **1 baris `eslint-disable-next-line` lokal + komentar** di test (blast radius 1 baris), TIDAK edit `.eslintrc.cjs` (shared-infra). **Tapi ini akan kena B/C** tiap mereka pasang async `preHandler`/hook di route. **Rekomendasi**: ratifikasi project-level `'@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { properties: false } }]` (targeted; `no-floating-promises` tetap aktif) supaya B/C tak perlu suppress per-baris. Ini shared-config affecting >1 dev → saya flag untuk route ke Parent PM (mirip Q-A-03), tidak act unilateral. Kalau PM prefer, saya bisa ganti disable lokal → bridge callback, tapi itu memindah keruwetan ke B/C.
- **`ValidationError` (400) untuk malformed JSON** di raw-body parser — tanpa itu Fastify balikin **500** untuk input klien rusak (salah kelas). Kecil, in-scope (parser bagian T04), pakai `@core/errors` existing.
- **Nota WA-secret (Q-A-04)** — plugin agnostik (secret via resolver); nuansa App-Secret vs verify_token = urusan wiring B, sudah di-escalate PM. Tidak act.

Requesting PM A VERDICT.

##### VERDICT T04 — APPROVED (H12, attempt 1) by PM A

✅ **APPROVE.** All 8 binding conditions verified independently; plugin reviewed line-by-line as a security-floor deliverable.

**Independent verification (PM reran on `feat/hmac-webhook-verify` `e101e6a`):**
- **#1 timingSafeEqual + length-guard** — `constantTimeEqual` guards `bufA.length !== bufB.length → false` before `timingSafeEqual`; never `===`. ✓
- **#2 HMAC over raw bytes** — HMAC computed on `req.rawBody` Buffer from the content-type parser. Proof test sends non-canonical `{"b":2,   "a":1}`, signs exact bytes → **200 + handler ran**; a re-serialized digest would fail. ✓
- **#3 plugin-level BEFORE handler** — verification in a `preHandler` hook; invalid → `throw AuthError` → tests assert `didHandlerRun() === false` on every invalid case. **No-`webhook_events`-insert invariant proven.** ✓
- **#4 401 native** — `inject` returns **401** for WA wrong/missing/`sha256=`-malformed + Telegram wrong, via `AuthError.statusCode=401` (Fastify default handler) with **no T08 dependency**. ✓
- **#5 AuthError, generic msg** — `throw new AuthError('Invalid webhook signature')`, static, no secret/body leak. ✓
- **#6 zero new deps** — package.json + lockfile UNCHANGED (PM confirmed); no `fp`/`fastify-raw-body`. ✓
- **#7 files/no-any/coverage** — 2 files in `src/plugins/` only; `api.ts`/`env.ts` untouched; **0 `any`**; explicit return types; `declare module 'fastify'` augment. PM rerun coverage = **100 line / 100 func / 80 branch** (3 uncovered = defensive fallbacks: array-header, non-buffer body, `?? alloc(0)`). `make check` green on PM rerun. ✓
- **#8 Telegram** — constant-time secret-echo compare, tested valid/invalid/missing. ✓

**Design quality:** clean hexagonal split (pure `verifyMetaSignature`/`verifyTelegramToken` + injected `resolveSecret` + scoped raw-body parser), fail-closed `rawBody ?? alloc(0)`, encapsulated parser (no global pollution). Matches SECURITY §4 exactly.

**On the 2 SUBMIT notes:**
- **`ValidationError` (400) for malformed JSON** — ACCEPTED. In-scope (the parser is a T04 deliverable), correct status (bad client JSON = 400, not Fastify's default 500), reuses existing `@core/errors`. Good touch.
- **eslint `no-misused-promises` on async `preHandler`** — the local single-line `eslint-disable-next-line` (in the **test** only, well-commented; plugin itself clean) is ACCEPTED as the minimal mitigation, and you correctly did NOT edit shared `.eslintrc.cjs`. Your project-level recommendation (`checksVoidReturn: { properties: false }`, keeping `no-floating-promises` active) is sound and **will hit B/C on every async route hook** → raised as **Q-A-05** (tooling, shared-config) to Parent PM, same handling as Q-A-03. Until ratified, B/C use the same local disable.

→ §1 tracker: T04 `approved`, Verified by PM A. → Code on `feat/hmac-webhook-verify` awaiting **PO merge + CI** (PM does not merge).

**Executor A: T04 done — webhook signature primitive ready for B (WA ingest T12) & C (Telegram T19).** Next in queue: **T05** (tenant resolution from `:hotel_slug`, LRU 5-min, `hotels.code` lookup). Note T05 will need the `hotels`-lookup source — expect a topology dependency on Q-A-01; call it out in your PLAN's session-start gate. Post PLAN when ready.

### ASSIGNMENT T05 — claimed by exec-A (Nathan) at H12 (2026-07-03)
- Branch: `feat/tenant-slug-resolver` (proposal, `feat/<short>`)
- Routed from: PM-STATUS-A.md §1 T05 + VERDICT T04 hand-off. Spec: `MVP-INTEGRATION-FIRST.md §4.3` (LRU 5-min, 404, never-trust-body), `04-integration-channels.md §2.3` (`:hotel_slug`→`hotel_id` via Auth `hotels.code`) + §8 (webhook no session; tenant guard derives `hotel_id` dari slug).

#### PLAN T05 — exec-A (Nathan) at H12 (2026-07-03)

**Scope recap**
- T05 = resolusi tenant dari `:hotel_slug` (URL param) → `hotel_id`, di-cache **LRU 5-min TTL**. Slug tak ditemukan → **404** (`NotFoundError`). **Never trust `hotel_id` dari body** — hanya dari URL param. Foundation primitive; dikonsumsi webhook routes B (T12) & C (T19) sebagai preHandler, mendahului signature-verify handler.

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot A (Nathan) ✓ · CLAUDE.md loaded ✓
- Task spec read: `MVP §4.3` (LRU 5-min, 404, no-trust-body), `04 §2.3` (slug→id via `hotels.code`, cache) + §8 (tenant guard).
- Parent docs spot-read: `prisma-client.ts` (**STUB** `db={}`), `redis-client.ts` (stub), `app-errors.ts` (`NotFoundError` 404 ada), `hmac-validator.plugin.ts` (pola injected-port + Fastify hook + `declare module`).
- **Topology dep (Q-A-01, per PM note)**: `hotels` = **Auth-owned**, TIDAK ada di schema repo ini (T02 = 8 tabel Integration saja); `prisma-client` masih stub. Sumber lookup `hotels.code`→`id` = cross-service (Auth RPC vs shared-DB read) — **belum diputus (Q-A-01 open)**. → T05 pakai **injected lookup port** (GAP #1), sama pola `resolveSecret` T04; impl data-source di-wire nanti.
- **Dep availability**: `lru-cache` cuma **transitive** (10.4.3/5.1.1), TIDAK di `package.json` → pnpm strict = tak importable tanpa declare (PO-gated). → **hand-rolled** TTL+LRU cache, zero dep (GAP #3).
- `make check` clean baseline ✓. Scaffolder risk: none.

**Files to create (lokasi PROPOSED — minta ACK)**
```
src/shared/utils/ttl-lru-cache.ts              (generic TTL+LRU cache, injectable clock)
src/shared/utils/__tests__/ttl-lru-cache.test.ts
src/plugins/tenant-resolver.plugin.ts          (slug→hotelId resolver + Fastify preHandler)
src/plugins/__tests__/tenant-resolver.plugin.test.ts
```

**Files to modify**
- (none) — `api.ts` stub; primitive tak di-wire ke server hidup (deferred). `env.ts`/prisma UNTOUCHED.

**Approach (arsitektur — mirror T04 hexagonal)**
1. **`TtlLruCache<V>`** (pure, unit-test): `constructor({ maxSize, ttlMs, now? })`; `get/set/has/delete/clear`. Eviksi TTL lazy saat `get`; eviksi LRU (Map insertion-order: delete+set saat akses, buang terlama saat > maxSize). **Inject `now()`** (default `Date.now`) → test TTL/LRU deterministik tanpa real-wait. `now()` di app-code diperbolehkan (batasan Date.now hanya untuk workflow script).
2. **`HotelSlugLookup`** port: `(code: string) => Promise<string | null>` (null = tak ada). 
3. **`createSlugResolver({ lookup, ttlMs=300_000, maxSize=1000, now? })`** → `resolve(slug): Promise<string>` — cek cache → miss: `lookup(slug)` → null → **`throw NotFoundError('hotel', slug)`** (404); non-null → cache (positif saja, lihat GAP #2) + return.
4. **Fastify preHandler**: `resolveTenantFromSlug({ resolver, paramName='hotel_slug' })` → baca `req.params[paramName]` (URL only, **abaikan body**), `resolver.resolve`, set `req.hotelId`. `declare module 'fastify'` augment `hotelId?: string`. Gagal → `NotFoundError` → **404 native** (via `NotFoundError.statusCode=404`, sama pola T04 tanpa T08).
5. **Test**: cache unit (hit, miss, TTL-expiry via mock `now`, LRU eviksi saat over-cap, negative tak-di-cache); resolver (miss→lookup→cache, hit→no-2nd-lookup [spy call count], not-found→NotFoundError); Fastify inject (valid slug→200 + `req.hotelId` benar via echo handler; unknown slug→**404** + handler tak jalan; body `hotel_id` diabaikan — kirim body beda, pastikan pakai slug URL).

**GAPs / questions — butuh ACK PM A**
- **GAP T05-#1 — hotels-lookup source (Q-A-01 dep).** A (default): T05 expose **injected `HotelSlugLookup` port**; impl (Auth RPC vs shared-DB `hotels.code` query) di-wire saat Q-A-01 resolved + prisma-client hidup. Test pakai stub lookup. B: blokir T05 sampai Q-A-01 + prisma live. **Intent: A** — primitive + caching/404/no-trust-body logic bisa selesai & teruji sekarang; data-source plug belakangan.
- **GAP T05-#2 — cache negatives?** A (default): cache **positif saja**. Hotel baru dibuat → slug-nya tak ke-blokir 404 stale sampai 5 menit. B: cache negatif TTL pendek (mis. 30s) utk redam brute-force slug-enum. **Intent: A** (correctness > micro-opt; negative-cache bisa ditambah nanti kalau ada abuse).
- **GAP T05-#3 — LRU impl.** A (default): hand-rolled Map-based TTL+LRU, zero dep. B: declare `lru-cache` (new dep → PO). **Intent: A** (kecil, teruji, no PO-gate).
- **GAP T05-#4 — lokasi file.** PROPOSED: cache generic → `src/shared/utils/ttl-lru-cache.ts` (reusable B/C); resolver+hook → `src/plugins/tenant-resolver.plugin.ts`. Alternatif: fold cache inline ke plugin (kurang reusable). **Intent: split** (cache reusable + unit-test isolated). Minta ACK lokasi (guardrail: bukan `src/common/`).

Awaiting PM A ACK (GAP #1–#4).

##### PM A ACK — T05 PLAN APPROVED, proceed to coding (H12, 2026-07-03)

Verified by PM A: `prisma-client.ts` = stub (`db = {} as ...placeholder`); `lru-cache` NOT in package.json (transitive only); `NotFoundError('resource', id?)` = 404 (app-errors.ts:42); **MVP §4.3** = "LRU 5-min TTL · slug not found → 404 · never trust `hotel_id` from body" (matches scope exactly). All 4 intents sound.

**Decisive spec finding — MVP §4.3 line 71:** *"webhook routing uses `:hotel_slug` lookup against a cached `hotels.code → hotels.id` map (**RPC to Auth or shared-DB read, your choice**)."* → the injected-port design is **spec-blessed**, and T05's resolver logic is identical under either topology. **T05 is genuinely unblocked** regardless of Q-A-01 (only the injected `lookup` impl differs at wiring time). Line 71 also affirms own-DB/opaque `hotel_id` — reinforcing Q-A-01's recommended resolution (isolated), against the schema-header outlier.

**GAP T05-#1 (lookup source) → Opsi A (injected `HotelSlugLookup` port). APPROVED.** Spec §4.3 L71 explicitly leaves the mechanism to implementation → port defers it cleanly; caching/404/no-trust-body logic completes + tests now with a stub. Do NOT block on Q-A-01 or live prisma.

**GAP T05-#2 (negative cache) → Opsi A (positive-only). APPROVED.** Not an MVP AC; a newly-provisioned hotel must not eat a stale 404. Slug-enumeration/DoS is dampened by the webhook rate-limit (`RATE_LIMIT_WEBHOOK_PER_MIN=300`). **Wiring note for B/C (not T05):** rate-limit plugin MUST run before the tenant-resolver preHandler; negative-cache can be added if abuse is observed.

**GAP T05-#3 (LRU impl) → Opsi A (hand-rolled Map-based TTL+LRU, zero-dep). APPROVED.** `lru-cache` is transitive → declaring it = PO-gated new dep (pnpm phantom-dep rule). Map insertion-order LRU + lazy TTL is ~40 lines and fully testable.

**GAP T05-#4 (file location) → APPROVED as proposed.** `src/shared/utils/ttl-lru-cache.ts` (generic, reusable by B/C, unit-tested in isolation) + `src/plugins/tenant-resolver.plugin.ts` (resolver + preHandler). **Correctly avoids the MVP brief's forbidden `src/common/slug-lookup.ts`** (path-alignment guardrail — `src/common/` DILARANG). Split over inline = right call.

**Binding conditions — verify at SUBMIT (multi-tenancy security floor):**
1. **Never trust body** — `hotel_id` derived ONLY from `req.params[hotel_slug]`; body ignored. Prove it: send a body carrying a *different* `hotel_id`, assert the resolver uses the URL slug (this is the WAJIB tenant-isolation guard).
2. **404 native** — unknown slug → `NotFoundError('hotel', slug)` → `inject` returns 404 via `statusCode=404` (no T08 dep).
3. **LRU + 5-min TTL** — `ttlMs` default `300_000`; TTL lazy-evict on `get` (expired → miss → re-lookup); LRU evicts least-recently-used over `maxSize`; **recency updates on `get`**. Deterministic tests via injected `now()` mock — no real waits. Cover: hit, miss, TTL-expiry, over-cap eviction, recency-refresh.
4. **preHandler-level** — resolver as `preHandler`; unknown slug throws before handler → handler-ran = `false` (tested).
5. **Injected port** — `HotelSlugLookup` injected; no prisma/RPC coupling; cache-hit does NOT call `lookup` twice (spy call-count).
6. **Zero new deps**; **files** = the 4 proposed only (NOT `src/common/`); `api.ts`/`env.ts`/prisma untouched; 0 `any`; explicit return types; coverage ≥ 80% each; `make check` green.
7. **`now()` injection** — `Date.now` default in app-code is fine (the Date.now ban is workflow-script-only). Correct.
8. eslint async-hook (Q-A-05) still unratified → reuse the same local 1-line disable if the inject test trips it.

Branch `feat/tenant-slug-resolver` OK. Proceed to coding.

#### SUBMIT T05 — exec-A (Nathan) at H12 (2026-07-03) (attempt 1)

Task: Tenant resolution from `:hotel_slug` (LRU 5-min TTL, 404, never-trust-body)
Branch: `feat/tenant-slug-resolver` (pushed, commit `ad8b188`)
Files changed: 4 (all new)
  - `src/shared/utils/ttl-lru-cache.ts` (new — generic TTL+LRU cache)
  - `src/shared/utils/__tests__/ttl-lru-cache.test.ts` (new, 7 tests)
  - `src/plugins/tenant-resolver.plugin.ts` (new — resolver + preHandler)
  - `src/plugins/__tests__/tenant-resolver.plugin.test.ts` (new, 8 tests)

**⚠ Perubahan dari PLAN (PO-directed, transparansi):** PLAN sebut cache sebagai **class** `TtlLruCache` (`constructor`). **PO (Nathan) minta function-based, tidak pakai class.** → refactor ke factory `createTtlLruCache(opts)` + closure over `Map` (private state di closure, bukan field). Kontrak/behavior identik; call-site berubah `new TtlLruCache()` → `createTtlLruCache()`, getter `size` → method `size()`. `HotelSlugLookup`/resolver/hook memang sudah functional. (Disimpan ke memory sbagai preferensi.)

DoD self-check (8 binding conditions)
- [x] **#1 never trust body** — `resolveTenantFromSlug` baca `req.params[hotel_slug]` SAJA, body diabaikan. **Dibuktikan**: test `ignore hotel_id in the body` kirim body `{hotel_id:'attacker-controlled-id'}` ke `/webhook/whatsapp/acme` → handler balikin `hotelId='hotel-acme-id'` (dari slug URL), bukan body. Tenant-isolation guard.
- [x] **#2 404 native** — slug tak dikenal → `NotFoundError('hotel', slug)` → `inject` **404** via `statusCode=404`, tanpa T08. Tested.
- [x] **#3 LRU + 5-min TTL** — `ttlMs` default `300_000`; TTL lazy-evict on `get`/`has`; LRU evict over `maxSize`; **recency refresh on get**. Deterministic via injected `now()`: test hit, miss, TTL-expiry (t=1099 valid, t=1100 expired), over-cap eviction, recency-refresh (get('a') → 'b' evicted bukan 'a'), has-expired.
- [x] **#4 preHandler-level** — resolver sebagai `preHandler`; unknown slug throw sebelum handler → `didHandlerRun()===false` (tested).
- [x] **#5 injected port** — `HotelSlugLookup` injected; no prisma/RPC coupling. Cache-hit **tak** panggil lookup 2×: test `lookup.mock.calls` length=1 (hit) vs 2 (setelah TTL expiry).
- [x] **#6 zero-dep/files/no-any/coverage** — `package.json`+lock UNCHANGED; 4 file proposed saja (BUKAN `src/common/`); `api.ts`/`env.ts`/prisma UNTOUCHED; **0 `any`**, **0 `class`**; explicit return types. Coverage: `tenant-resolver.plugin.ts` **100/100/100/100**, `ttl-lru-cache.ts` **96.96 stmt / 85.71 br / 100 fn / 100 line** (>80 floor; 1 branch = defensive `oldest===undefined` guard).
- [x] **#7 `now()` injection** — default `Date.now` di app-code (ban hanya workflow-script). OK.
- [x] **#8 eslint async-hook (Q-A-05)** — reuse local 1-line `eslint-disable-next-line` di test (preHandler property), `.eslintrc.cjs` tak disentuh.

Quality gate
- `make lint`: PASS · `make format-check`: PASS · `make typecheck`: PASS · `make test-unit`: PASS (43: +15 T05; 2 skipped template). `make check` exit 0.

Drift scans (§4.4)
- My 4 files: `any` 0 · `class` 0 · console 0 · `throw new Error(` 0 (pakai `NotFoundError`) · forbidden imports 0 · default export 0 · `.skip` 0.
- Diff = 4 file baru saja (2 `src/plugins/`, 2 `src/shared/utils/`). Baseline lain tak berubah.

Security check (multi-tenancy)
- Tenant derived dari URL slug only (never body) — **WAJIB guard terpenuhi & tested**. 404 on unknown slug. Positive-only cache (hotel baru tak ke-404 stale). No secret/PII di cache/log.

Test evidence
- Unit: 15 (7 cache: hit/miss/ttl-expiry/has-expired/lru-evict/recency/delete-clear · 8 resolver: resolve-known, cache-hit-no-2nd-lookup, re-lookup-after-ttl, unknown→NotFound, missing-param→NotFound, inject valid→200+hotelId, body-ignored, unknown→404+handler-skip).
- Coverage: resolver 100%, cache 100% line.
- Integration: N/A (in-proc `fastify.inject`, no DB/Redis).

Notes / questions (untuk PM A)
- **PO-directed no-class refactor** (di atas) — deviasi dari PLAN's class design, atas permintaan Nathan. Behavior identik. Flag untuk awareness.
- **Q-A-01 dep**: resolver logic selesai & teruji dgn stub lookup; impl `HotelSlugLookup` (Auth RPC vs shared-DB `hotels.code`) di-wire saat Q-A-01 resolved + prisma live (B/C consumption).
- **Q-A-05 (eslint async-hook)** masih unratified → local disable dipakai lagi (1 baris, test only).

Requesting PM A VERDICT.

##### VERDICT T05 — APPROVED (H12, attempt 1) by PM A

✅ **APPROVE.** All 8 binding conditions verified independently; multi-tenancy guard reviewed line-by-line.

**Independent verification (PM reran on `feat/tenant-slug-resolver` `ad8b188`):**
- **#1 never-trust-body (WAJIB tenant guard)** — `resolveTenantFromSlug` reads `req.params[hotel_slug]` ONLY; body never touched. Proof test POSTs `{hotel_id:'attacker-controlled-id'}` to `/webhook/whatsapp/acme` → resolved `hotelId` = the URL-slug's id, body ignored. ✓
- **#2 404 native** — unknown slug (`lookup → null`) + empty/missing param → `NotFoundError('hotel', slug)` → `inject` 404 via `statusCode=404`, no T08 dep. ✓
- **#3 LRU + 5-min TTL** — `ttlMs` default `300_000`; correct Map-insertion-order LRU (delete+re-set on `get` = recency; evict-front on overflow); lazy TTL that correctly does **not** refresh expiry on read; deterministic tests via injected `now()` (hit/miss/expiry boundary/over-cap/recency-refresh). ✓
- **#4 preHandler-level** — throws before handler; `didHandlerRun()===false` on unknown slug. ✓
- **#5 injected port** — `HotelSlugLookup` injected, no prisma/RPC coupling; cache-hit does not call `lookup` twice (mock call-count 1 vs 2 post-expiry). ✓
- **#6 zero-dep/files/no-any/no-class/coverage** — deps + lockfile UNCHANGED; 4 files at proposed locations (**not** `src/common/`); `api.ts`/`env.ts`/prisma untouched; **0 `any`, 0 `class`**; explicit return types. PM rerun coverage: tenant-resolver **100/100/100/100**, cache **100 line / 100 func / 85.7 branch** (1 uncovered = defensive `oldest===undefined` guard). `make check` green on PM rerun. ✓
- **#7 `now()` injection** — `Date.now` default (app-code, not workflow) ✓. **#8 eslint async-hook** — same local 1-line disable (Q-A-05 pending), `.eslintrc.cjs` untouched ✓.

**On the PO-directed class→factory refactor (deviation from my ACK'd PLAN — ENDORSED):** the PLAN specified a `class TtlLruCache`; PO (Nathan) directed function-based, so it shipped as `createTtlLruCache(opts)` + closure over `Map` (private state in closure, `new` → factory call, `size` getter → `size()` method). A PO directive supersedes my ACK'd design — correct call, and it's the right moment (foundation util, 0 external call-sites, before B/C copy the pattern). Behavior identical, transparently flagged. This preference now applies to future stateful utils (T06/T07 etc.).

**Design quality:** clean hexagonal (pure factory cache + injected lookup + factory hook), TTL-not-refreshed-on-read is the subtle-correct LRU+TTL semantics, `exactOptionalPropertyTypes`-safe `now` spread. Matches MVP §4.3 exactly.

→ §1 tracker: T05 `approved`, Verified by PM A. → Code on `feat/tenant-slug-resolver` awaiting **PO merge + CI**.

**Executor A: T05 done — tenant-resolution primitive ready for B (T12) & C (T19).** The `HotelSlugLookup` impl (Auth RPC vs shared-DB) is deferred to consumer wiring per Q-A-01. Next in queue: **T06** (BSP adapter interface + `1engage` impl — module-scoped at `src/modules/<wa-module>/adapters/`, NOT top-level `src/adapters/`; port + adapter per ADR-0001). Post PLAN when ready.

### ASSIGNMENT T06 — claimed by exec-A (Nathan) at H12 (2026-07-03)
- Branch: `feat/wa-bsp-adapter` (proposal, `feat/<short>`)
- Routed from: PM-STATUS-A.md §1 T06 + VERDICT T05 hand-off. Spec: `04-integration-channels.md §3.1` (WA outbound via BSP) + §6 (BSP=1engage, per-hotel access_token+phone_number_id), `open-questions.md Q-OPS-04` (thin BSP-agnostic interface — Recommended), `ADR-0001` (external HTTP → WAJIB port+adapter; swap 1engage↔IOH), guardrail (module-scoped, BUKAN `src/adapters/` top-level).

#### PLAN T06 — exec-A (Nathan) at H12 (2026-07-03)

**Scope recap**
- T06 = **BSP port (ABI, vendor-agnostic) + `1engage` adapter** untuk dispatch outbound WA. Foundation utk B4 (`send_wa_message`, T-dispatch). Port = kontrak stabil yang B consume via barrel; adapter = impl konkret (fungsi factory, bukan class — preferensi PO). Q-OPS-04: thin interface walau 1engage satu-satunya v1.

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot A (Nathan) ✓ · CLAUDE.md loaded ✓
- Task spec read: `04 §3.1` ("Dispatches to WA Cloud API"; text/template; per-hotel BSP+access_token+phone_number), `§6` (BSP 1engage), `Q-OPS-04` (thin interface), `ADR-0001` (port utk external HTTP), `_template/ports|adapters` (pola), `MODULE_TEMPLATE.md` (barrel = public API, TIDAK export adapter).
- Parent docs spot-read: `_template/adapters/example-vendor.adapter.ts` (pola adapter), `core/http/http-client.ts` (**STUB** class `HttpClient.post` throw), `app-errors.ts` (`ExternalServiceError(service,msg,upstream?)` = 502).
- Dependencies: T01 ✓. **Note**: `HttpClient` core = stub → adapter depend pada **narrow `HttpPoster` interface** (structural, dipenuhi HttpClient nanti) yang di-inject → unit-test dgn mock. Access token diterima **sudah plaintext** (B decrypt via `crypto` T03 sebelum panggil adapter) — adapter tak decrypt.
- ESLint boundary: barrel export **port saja** (bukan adapter, per MODULE_TEMPLATE). Adapter di-import hanya oleh test (test file `no-restricted-imports` OFF) + entrypoint-wiring nanti. T06 tak wire ke `api.ts` (stub).
- `make check` clean baseline ✓. Scaffolder risk: none (buat folder modul manual, bukan `cp -r`/generator).

**Files to create (lokasi PROPOSED — minta ACK, esp. nama modul GAP #1)**
```
src/modules/whatsapp/ports/whatsapp-bsp.port.ts          (port interface + domain types)
src/modules/whatsapp/adapters/1engage.adapter.ts         (create1engageAdapter factory)
src/modules/whatsapp/index.ts                            (barrel: export port + types, NOT adapter)
src/modules/whatsapp/__tests__/1engage.adapter.test.ts   (unit, mock HttpPoster)
```

**Files to modify**
- (none) — modul baru; tak sentuh `_template/` (frozen), `api.ts` (stub), `env.ts`, existing `src`.

**Approach (arsitektur — hexagonal, function-based)**
- **Port `WhatsappBspPort`** (ABI): `sendText(input): Promise<BspSendResult>` + `sendTemplate(input): Promise<BspSendResult>`. Domain types: `BspCredentials { phoneNumberId; accessToken }`, `SendTextInput { credentials; to; body }`, `SendTemplateInput { credentials; to; templateName; languageCode; variables? }`, `BspSendResult { messageId }`. Vendor-agnostic (no 1engage/axios leak).
- **`create1engageAdapter({ http, config }): WhatsappBspPort`** (factory + closure): build WA Cloud API request — `POST ${config.baseUrl}/${config.apiVersion}/${phoneNumberId}/messages`, header `Authorization: Bearer <accessToken>`; body text = `{messaging_product:'whatsapp',to,type:'text',text:{body}}`, template = `{...type:'template',template:{name,language:{code},components:[{type:'body',parameters:[{type:'text',text:v}...]}]}}`. Response `{messages:[{id}]}` → `{messageId}`. Non-2xx / no message id / http throw → **`ExternalServiceError('1engage', …, {status, body})`** (502, Sentry-friendly). `HttpPoster` = narrow `{ post<T>(url, body, opts?): Promise<{data:T;status:number}> }`.
- **Test** (mock HttpPoster): sendText → assert URL/Bearer-header/Cloud-API-text-payload + `messageId` dari response; sendTemplate → assert components/parameters mapping + messageId; template tanpa variables → components kosong/omit; error non-2xx → `ExternalServiceError`; error http-throw → `ExternalServiceError`. No real network.

**GAPs / questions — butuh ACK PM A**
- **GAP T06-#1 — nama modul (cross-slot, B bangun CRUD di modul yang SAMA).** PROPOSED: `whatsapp` (jelas; `src/modules/whatsapp/`). Alternatif `wa` (match prefix tabel `wa_configs`). Ini keputusan lintas-slot (B harus align nama) → mohon PM confirm / route ke Parent-PM+B. **Intent: `whatsapp`.**
- **GAP T06-#2 — kontrak 1engage konkret tak ada di spec.** 1engage = BSP WhatsApp Cloud API → saya impl **konvensi Cloud API (Meta Graph shape)**: `POST {base}/{ver}/{phoneNumberId}/messages`, `Bearer` auth. `baseUrl`+`apiVersion` **injected via config** → di-set ke endpoint 1engage saat wiring. A (default): Cloud-API shape sekarang, adjustable saat kontrak vendor confirmed (port tetap stabil apa pun payload). B: tunggu kontrak 1engage nyata (blokir T06). **Intent: A** — port stabil; payload adapter refinable tanpa ubah ABI.
- **GAP T06-#3 — cakupan operasi port.** A (default): **messaging only** — `sendText` + `sendTemplate` (kebutuhan B4 dispatch). EXCLUDE: template-management relay submit/resubmit-to-Meta (B8, API berbeda) + health getMe (C8) → port/tugas terpisah nanti. B: masukkan semua sekarang (over-scope, kontrak B8/C8 belum jelas). **Intent: A** — ABI fokus dispatch; extend belakangan.
- **Nota**: adapter = factory function (no class) per preferensi PO + endorsement VERDICT T05. Port = `interface` (bukan class — OK).

Awaiting PM A ACK (GAP #1–#3, esp. nama modul lintas-slot).

##### PM A ACK — T06 PLAN APPROVED, proceed to coding (H12, 2026-07-03)

Verified by PM A: merged schema provider enum = `('whatsapp','telegram')`; spec routes `/api/integrations/whatsapp` + `/webhook/whatsapp` (only `send_wa_message`/`wa_configs` use the `wa` abbrev); `http-client.ts` = stub (`throw 'HttpClient not implemented'`); MODULE_TEMPLATE `index.ts` = barrel public API; **Q-OPS-04 explicitly recommends a thin BSP-agnostic interface** ("Backend's call... keeps options open"). All intents sound.

**GAP T06-#1 (module name — CROSS-SLOT) → DECISION: `whatsapp`. APPROVED, + routed to Parent PM for B alignment.**
- Evidence is decisive: the **ratified provider enum is `'whatsapp'`** and the public API/webhook routes are `/whatsapp`. `wa` only appears as the DB-column/RPC abbreviation — not the bounded-context name. → `src/modules/whatsapp/`.
- **Cross-slot:** B builds WA config CRUD (T10) in this same module. T10 is now schema-unblocked, so alignment matters soon. Raised as **Q-A-06** to Parent PM (§3c) so PM B uses `whatsapp` too. T06 proceeds on `whatsapp`; if overruled it's a cheap pre-B `git mv` (no consumers yet).

**GAP T06-#2 (1engage concrete contract absent) → Opsi A (Cloud-API shape now, config-injected `baseUrl`/`apiVersion`). APPROVED.** 1engage is a WA Cloud-API BSP; building to the Meta Graph shape with injected endpoint is correct, and the **vendor-agnostic port stays stable** even if 1engage's real payload differs (only the adapter changes). Q-OPS-04 backs the thin interface. Don't block on the vendor contract.

**GAP T06-#3 (port scope) → Opsi A (messaging only: `sendText` + `sendTemplate`). APPROVED.** YAGNI — B4 dispatch needs exactly these. Correctly EXCLUDE B8 template-management relay (different Meta API) + C8 health `getMe` (different concern) → separate ports later. Don't speculate an ABI for unclear contracts.

**Nota (factory + interface) — ENDORSED.** Adapter = factory function (no class, per PO preference + T05 endorsement); port = `interface` (a contract, which CLAUDE.md §5 wants as `interface`, not a class). Correct distinction.

**Binding conditions — verify at SUBMIT:**
1. **Hexagonal (ADR-0001)** — `WhatsappBspPort` = `interface`, vendor-agnostic (NO axios/1engage/Cloud-API leak in the port types); adapter = factory implementing it via an injected narrow `HttpPoster`.
2. **Barrel discipline** — `index.ts` exports the **port + domain types ONLY, NOT the adapter** (MODULE_TEMPLATE). Adapter imported only by its test (+ future entrypoint wiring).
3. **Module-scoped path** — `src/modules/whatsapp/{ports,adapters,__tests__}` — **NOT** top-level `src/adapters/` (guardrail). 
4. **Error mapping** — non-2xx / missing `messageId` / http-throw → `ExternalServiceError('1engage', msg, { status, body })` (502, Sentry-friendly). Both non-2xx and http-throw paths tested. Not raw `Error`.
5. **Injected `HttpPoster`** — narrow structural type, mocked in tests; **no real network**. Adapter receives **plaintext** access token (B decrypts via T03 before calling) — adapter does NOT decrypt.
6. **No hardcoded vendor URL** — `baseUrl`/`apiVersion` from injected config (drift: hardcoded-URL). 
7. **Factory (no class); 0 `any`** (typed mock, no `as any`); explicit return types; coverage ≥ 80%.
8. **Cloud-API payload shape** — text `{messaging_product:'whatsapp',to,type:'text',text:{body}}` + template components/parameters mapping (incl. template-without-variables path). Tested.
9. `make check` green; 4 proposed files only; `_template`/`api.ts`/`env.ts` untouched.

Minor: `1engage.adapter.ts` filename (leading digit) is acceptable — matches the vendor brand and the factory identifier `create1engageAdapter` is letter-first so imports are fine; adjust only if a lint/tooling rule objects. Branch `feat/wa-bsp-adapter` OK. Proceed to coding.

#### SUBMIT T06 — exec-A (Nathan) at H12 (2026-07-03) (attempt 1)

Task: BSP port (ABI) + `1engage` adapter — outbound WA messaging (module `whatsapp`)
Branch: `feat/wa-bsp-adapter` (pushed, tip `1a05af1`)
Files changed: 4 (all new)
  - `src/modules/whatsapp/ports/whatsapp-bsp.port.ts` (new — port + domain types)
  - `src/modules/whatsapp/adapters/1engage.adapter.ts` (new — `create1engageAdapter` factory)
  - `src/modules/whatsapp/index.ts` (new — barrel: port + types only)
  - `src/modules/whatsapp/__tests__/1engage.adapter.test.ts` (new, 7 tests)

DoD self-check (9 binding conditions)
- [x] **#1 hexagonal (ADR-0001)** — `WhatsappBspPort` = `interface`, vendor-agnostic (types = `BspCredentials`/`SendTextInput`/`SendTemplateInput`/`BspSendResult`; NO axios/Cloud-API/1engage leak). Adapter = factory via injected `HttpPoster`.
- [x] **#2 barrel discipline** — `index.ts` `export type` **port + domain types ONLY, NOT adapter**. Adapter di-import cuma oleh test (no-restricted-imports OFF di test).
- [x] **#3 module-scoped path** — `src/modules/whatsapp/{ports,adapters,__tests__}` — BUKAN top-level `src/adapters/` (guardrail).
- [x] **#4 error mapping** — non-2xx / missing `messageId` / http-throw → `ExternalServiceError('1engage', msg, {status?, body})` (502). Non-2xx + http-throw + non-Error-throw + missing-id semua tested. Bukan raw `Error`.
- [x] **#5 injected `HttpPoster`** — narrow structural type, mock di test, **no real network**. Adapter terima access token **plaintext** (B decrypt via T03) — adapter tak decrypt.
- [x] **#6 no hardcoded vendor URL** — `baseUrl`/`apiVersion` dari injected `config` (`grep graph.facebook` di adapter = 0).
- [x] **#7 factory/no-any/return-types/coverage** — factory function (0 `class`); **0 `any`** (mock via `as unknown as HttpPoster`, bukan `as any`); explicit return types di semua exported/fungsi non-test. Coverage `1engage.adapter.ts` **100 stmt / 92.3 br / 100 fn / 100 line** (>80 floor; 1 br = defensive `?? []` unreachable).
- [x] **#8 Cloud-API payload** — text `{messaging_product:'whatsapp',recipient_type:'individual',to,type:'text',text:{body}}`; template `type:'template',template:{name,language:{code},components:[{type:'body',parameters:[{type:'text',text}...]}]}`; template-tanpa-variables → components di-omit. Semua tested via `toHaveBeenCalledWith`.
- [x] **#9 make check green; 4 files; `_template`/`api.ts`/`env.ts` untouched** — confirmed.

Quality gate
- `make lint`: PASS · `make format-check`: PASS · `make typecheck`: PASS · `make test-unit`: PASS (50: +7 T06; 2 skipped template). `make check` exit 0.

Drift scans (§4.4)
- My module files: `any` 0 · `class` 0 · console 0 · `throw new Error(` 0 (pakai `ExternalServiceError`) · forbidden imports (express/axios/moment) 0 · hardcoded URL 0 · default export 0 · `.skip` 0. Barrel tak export adapter (boundary OK).
- Diff = 4 file baru di `src/modules/whatsapp/` saja.

Security check (external IO)
- External HTTP via port+adapter (ADR-0001): yes. Access token plaintext in-memory only (from B's decrypt), tidak di-log, tidak di-hardcode. `ExternalServiceError.upstream` bawa status+body untuk Sentry (bukan token). No secret hardcoded (test pakai `plain-token` dummy).

Test evidence
- Unit: 7 — sendText (success+assert URL/Bearer/payload, non-2xx→ExternalServiceError, missing-id→ExternalServiceError, http-reject→ExternalServiceError, non-Error-reject→ExternalServiceError) · sendTemplate (with-vars mapping, without-vars omit-components).
- Coverage: adapter 100% line/func. Integration: N/A (mock HttpPoster, no network/DB).

Notes / questions (untuk PM A)
- **Module `whatsapp`** dibuat partial (ports+adapters+barrel saja); B isi service/CRUD di modul yang sama nanti (Q-A-06 alignment). Barrel `export type` — B append export lain saat build.
- **1engage payload = Cloud-API shape** (GAP #2 Opsi A) — refinable saat kontrak vendor confirmed; port stabil.
- **Housekeeping:** port doc-header sempat hilang di commit awal `b997ae4` (gremlin, bukan hook/prettier — sudah dicek: no husky/lint-staged, `.prettierrc` clean); dipulihkan di `1a05af1` dan **diverifikasi di committed blob** (`git show HEAD:…`). Tip branch final = `1a05af1`.

Requesting PM A VERDICT.

##### VERDICT T06 — APPROVED (H12, attempt 1) by PM A

✅ **APPROVE.** All 9 binding conditions verified independently on `feat/wa-bsp-adapter` (`1a05af1`).

**Independent verification (PM rerun):**
- **#1 hexagonal (ADR-0001)** — `WhatsappBspPort` = `interface`, fully vendor-agnostic (PM read the port: no axios/1engage/Cloud-API leak in any type). Adapter = factory implementing it via injected `HttpPoster`. ✓
- **#2 barrel discipline** — `index.ts` = `export type { port + 4 domain types }` ONLY; `grep adapter index.ts` = 0 → **adapter not exported** (MODULE_TEMPLATE respected). ✓
- **#3 module-scoped** — `src/modules/whatsapp/{ports,adapters,__tests__}`; not top-level `src/adapters/`. ✓
- **#4 error mapping** — all three failure paths → `ExternalServiceError('1engage', msg, {status?, body})`: http-throw (incl. non-Error via `String(err)`), non-2xx, missing/empty `messageId`. All tested (7 cases). Not raw `Error`. ✓
- **#5 injected `HttpPoster`** — narrow structural type, mocked; no real network; adapter takes **plaintext** token as Bearer, does NOT decrypt. ✓
- **#6 no hardcoded URL** — `messagesUrl` built from injected `config.baseUrl`/`apiVersion`; `grep https?:// / graph.facebook / axios` in module = 0. ✓
- **#7 factory/no-any/coverage** — factory (0 `class`); **0 `any`** (mock via `as unknown as`, not `as any`); explicit return types. PM rerun coverage = **100 line / 100 func / 92.3 branch** (line 111 = unreachable `?? []` defensive). ✓
- **#8 Cloud-API payload** — text + template (components/parameters mapping; components omitted when no variables) verified via `toHaveBeenCalledWith`. ✓
- **#9 make check green (PM rerun)** — 4 files only; `_template`/`api.ts`/`env.ts` untouched. ✓

**Design quality:** clean single `dispatch()` helper shared by `sendText`/`sendTemplate`, `ExternalServiceError.upstream` carries `{status, body}` for Sentry (never the token), port stays stable regardless of vendor payload. Textbook ADR-0001 + Q-OPS-04.

**Housekeeping note (verified):** the port doc-header that vanished in `b997ae4` is present in the final committed blob (`1a05af1`) — PM confirmed by reading `index`/port on the branch tip. Transparent, resolved, no residue.

→ §1 tracker: T06 `approved`, Verified by PM A. → Code on `feat/wa-bsp-adapter` awaiting **PO merge + CI**.

**Executor A: T06 done — BSP dispatch primitive ready for B4 (`send_wa_message`, T13).** `src/modules/whatsapp/` now seeded (ports+adapters+barrel); **B fills service/CRUD in this same module** (Q-A-06 — pending Parent PM confirm B aligns). Next in queue: **T07** (queue + scheduler infra — extend existing `src/core/queue/bull-factory.ts`, Bull + retry/backoff + DLQ). Post PLAN when ready.

### ASSIGNMENT T07 — claimed by exec-A (Nathan) at H12 (2026-07-03)
- Branch: `feat/queue-infra` (proposal, `feat/<short>`)
- Routed from: PM-STATUS-A.md §1 T07 + VERDICT T06 hand-off. Spec: `04 §7` (retry 3× backoff 1s/5s/30s, DLQ/`dead`, quota/template-not-approved NOT retried), `MVP §4.9` (3 attempts backoff 1s/5s/30s, exhaust→failed), `CLAUDE.md §9` (Bull pattern + queue naming `<module>:<job-type>`), guardrail (extend `src/core/queue/bull-factory.ts`).

#### PLAN T07 — exec-A (Nathan) at H12 (2026-07-03)

**Scope recap**
- T07 = infra queue+scheduler foundation: extend `bull-factory.ts` (stub `queueFactory={}`) jadi factory Bull dengan default job-options, **custom backoff 1s/5s/30s**, **DLQ** (Bull tak punya native → dead-letter queue + failed-forwarder), naming helper, worker-register + repeatable-schedule helper tipis. Dikonsumsi B (outbound dispatch retry T-B6) & C (OTA poller/health cron T-C5/C8).

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot A (Nathan) ✓ · CLAUDE.md loaded ✓
- Task spec read: `04 §7` (retry+DLQ+non-retryable), `MVP §4.9` (backoff), `CLAUDE §9` (Bull `new Queue<T>('foo',{redis})` + `.process(name, concurrency, fn)`, naming `<module>:<job-type>`).
- Parent docs spot-read: `bull-factory.ts` (stub), `env.ts` (`REDIS_URL`, `REDIS_QUEUE_DB`, `REDIS_TLS_ENABLED`, `WORKER_CONCURRENCY_DEFAULT`), `redis-client.ts` (stub), `app-errors.ts`.
- Dependencies: T02 ✓ (migration; `outbound_dispatch_queue` ada). `bull@4.16.3` + `ioredis@5.3.2` **declared di package.json** → importable (bukan phantom).
- **Bull vs BullMQ**: task title sebut "BullMQ" TAPI CLAUDE §2 tech-stack + `package.json` = **`bull` 4.x** (bukan `bullmq`). Per CLAUDE §14 (ikuti yang ratified) → pakai **Bull 4.x**. (GAP #1.)
- **Testing**: Bull `new Queue()` butuh Redis (buka koneksi ioredis) → tak boleh di unit test (open handles). → pisah **pure config/logic** (backoff/naming/job-options/DLQ-forwarder) yang di-unit-test, dari `createQueue` (thin `new Bull`) yang integration-only. (GAP #4.)
- `make check` clean baseline ✓. Scaffolder risk: none.

**Files to modify**
- `src/core/queue/bull-factory.ts` — ganti stub dengan factory + helpers (function-based, no class).

**Files to create**
```
src/core/queue/__tests__/bull-factory.test.ts   (unit — pure/logic parts, mock queue/job, no Redis)
```

**Approach (function-based)**
- **Retry/backoff**: `RETRY_BACKOFF_DELAYS_MS = [1000,5000,30000]`, `DEFAULT_JOB_ATTEMPTS = 3`, `integrationBackoffStrategy(attemptsMade): number` (idx `attemptsMade-1`, clamp ke last). `buildDefaultJobOptions(overrides?)`: `{ attempts, backoff:{type:'integration'}, removeOnComplete:true, removeOnFail:false }` (keep failed utk DLQ inspect).
- **Naming**: `queueName(module, jobType)` = `${module}:${jobType}`; `deadLetterQueueName(module)` = `${module}:dead`.
- **Queue options (pure)**: `buildQueueOptions(redis, jobOverrides?)` → `{ redis, defaultJobOptions, settings:{ backoffStrategies:{ integration: integrationBackoffStrategy } } }`. `createQueue<T>({ name, redis, jobOptions? })` → thin `new Bull<T>(name, buildQueueOptions(...))`. **Redis connection di-inject** (string/RedisOptions) — konstruksi dari config di wiring (entrypoint), bukan di factory (testability + Q-A-03 NODE_ENV avoidance).
- **DLQ**: `attachDeadLetterForwarder(queue, deadLetterQueue)` — `queue.on('failed', (job, err) => { if (job.attemptsMade >= job.opts.attempts) deadLetterQueue.add({ originalQueue: queue.name, jobId, name, data, failedReason }) })`. Non-retryable (quota/template) = caller pakai `attempts:1` atau discard — foundation sediakan mekanisme, keputusan per-job di B.
- **Worker/scheduler helper (tipis)**: `registerProcessor(queue, jobName, concurrency, processor)` wrapper `.process`; `scheduleRepeatable(queue, jobName, data, cron)` wrapper `.add(data,{repeat:{cron}})`. Concurrency dari `config.WORKER_CONCURRENCY_DEFAULT` (env, bukan konstanta baru).
- **Test** (no Redis): `integrationBackoffStrategy` (1→1000,2→5000,3→30000,4→30000 clamp); `queueName`/`deadLetterQueueName`; `buildDefaultJobOptions` (attempts/backoff/removeOn*); `buildQueueOptions` (backoffStrategies wired, redis passthrough, defaultJobOptions); **DLQ-forwarder** via fake queue (EventEmitter/handler capture) + `deadLetterQueue={add:jest.fn()}` → emit failed at exhaustion (attemptsMade=3,attempts=3) → add dipanggil; not-exhausted (attemptsMade=1) → tidak. `createQueue`/`registerProcessor`/`scheduleRepeatable` = thin, NOT unit-tested (integration/wiring; noted).

**GAPs / questions — butuh ACK PM A**
- **GAP T07-#1 — Bull vs BullMQ.** Title "BullMQ" vs CLAUDE §2 + `package.json` = `bull` 4.x. **Intent: Bull 4.x** (ratified/installed). Kalau PO mau BullMQ → new dep + ganti API (route PO). 
- **GAP T07-#2 — retry count semantics.** Spec §7 "3 retries (1s,5s,30s)" vs "after 3 attempts→failed" / MVP §4.9 "3 attempts (1s,5s,30s)" — konflik jumlah (3 attempts = 2 delay; 3 retries = 4 attempts = 3 delay). **Intent (A)**: `attempts=3` default (konfigurable) + backoff sequence `[1s,5s,30s]` by `attemptsMade` → efektif 1s,5s dipakai; 30s reserved kalau `attempts≥4`. Strategy faithful, attempts tunable per-job. (Kalau PM mau full 1s/5s/30s terpakai → default `attempts=4`.)
- **GAP T07-#3 — DLQ mechanism.** Bull tak punya native DLQ. **Intent (A)**: dead-letter queue (`<module>:dead`) + `attachDeadLetterForwarder` on exhaustion; `removeOnFail:false` agar failed job inspectable. B/C wire DLQ per queue.
- **GAP T07-#4 — testing tanpa live Redis.** **Intent (A)**: unit-test pure/logic (backoff/naming/options/DLQ-forwarder via mock); `createQueue`+worker/scheduler thin = integration-only (deferred, butuh `make start`). Coverage floor dihitung atas kode non-thin.

Awaiting PM A ACK (GAP #1–#4).

##### PM A ACK — T07 PLAN APPROVED, proceed to coding (H12, 2026-07-03)

Verified by PM A: `bull-factory.ts` = stub (`queueFactory = {} placeholder`, naming convention `<module>:<job-type>` documented); CLAUDE §2 stack = **Bull 4.x** + `package.json` `bull@4.16.3` (no bullmq); env has `REDIS_URL`/`REDIS_QUEUE_DB`/`REDIS_TLS_ENABLED`/`WORKER_CONCURRENCY_DEFAULT`; CLAUDE §9 naming matches. Intents sound.

**GAP T07-#1 (Bull vs BullMQ) → DECISION: Bull 4.x. APPROVED.** Task title says "BullMQ" but CLAUDE §2 (ratified stack) + `package.json` = Bull 4.x; BullMQ would be a new dep + API change (PO-gated). CLAUDE §14 → ratified wins. The "BullMQ" wording in PARENT §1/§8 is a misnomer (noted for Parent PM to clean up — cosmetic, no code impact; B/C consume whatever T07 ships = Bull).

**GAP T07-#2 (retry count semantics) → ACK the configurable mechanism; DEFAULT `attempts=3`; escalated as Q-A-07.** The spec **self-contradicts**: §7 L344 "3 retries (1s,5s,30s)" vs §7 L345 "after 3 attempts → failed" vs MVP §4.9 "3-attempt". Majority reading + CLAUDE §14 (most-restrictive-until-confirmed) → **default `attempts=3`** (uses 1s+5s; 30s reserved), exactly your Intent A. Keep it **per-job configurable** + the `[1s,5s,30s]` strategy faithful. Raised **Q-A-07** (§3a) for PO to ratify "3 attempts vs 3 retries / is 30s meant to be exercised" and fix the spec **before B's T14** (outbound retry queue needs the exact count). Non-blocking — B sets attempts per-job.

**GAP T07-#3 (DLQ) → Opsi A (dead-letter queue `<module>:dead` + `attachDeadLetterForwarder` on exhaustion, `removeOnFail:false`). APPROVED.** Bull 4.x has no native DLQ; forwarder-on-`failed`-at-exhaustion is the standard pattern. Bonus: `<module>:dead` aligns with the schema's `outbound_dispatch_queue.status` CHECK (`'dead'` enum from T02) — consistent vocabulary.

**GAP T07-#4 (test w/o live Redis) → Opsi A. APPROVED.** Separating pure/logic (backoff/naming/options/DLQ-forwarder — unit-tested with mock queue/job) from the thin `new Bull()` + worker/scheduler wrappers (integration-only, deferred) is correct (CLAUDE §8 / TESTING.md; `new Queue()` opens a Redis handle). **Condition:** the deferred wrappers MUST be genuinely logic-free passthroughs — no untested logic hides in them; ≥80% coverage on the logic-bearing exports.

**Binding conditions — verify at SUBMIT:**
1. **Bull 4.x**, zero new deps (bull+ioredis already declared).
2. **Backoff** `integrationBackoffStrategy(attemptsMade)` → `[1000,5000,30000]` indexed `attemptsMade-1`, clamp to last; default `attempts=3` (overridable). Unit-tested incl. clamp (4→30000).
3. **Naming** `queueName`=`${module}:${jobType}`, `deadLetterQueueName`=`${module}:dead` (CLAUDE §9). Tested.
4. **DLQ forwarder** moves to dead-queue ONLY on exhaustion (`attemptsMade >= attempts`); `removeOnFail:false`. Tested: exhausted→`add` called, not-exhausted→not called (fake EventEmitter queue + mock `.add`).
5. **Redis injected** (constructed at wiring from config, not inside the factory); concurrency from `config.WORKER_CONCURRENCY_DEFAULT` (no new constant, no direct `process.env`).
6. **Non-retryable knob** (quota/template-not-approved) — mechanism provided (`attempts:1`/discard); per-job decision documented as B's call.
7. **Testing** — logic-bearing exports unit-tested with mocks, **NO Redis** (no open handles hanging `make check`); thin wrappers logic-free + integration-deferred (noted). ≥80% coverage on logic code.
8. **Files** — modify `bull-factory.ts` + create its test only; function-based (0 `class`); 0 `any` (typed mocks); explicit return types; `env.ts`/others untouched. `make check` green.

Branch `feat/queue-infra` OK. Proceed to coding.

#### SUBMIT T07 — exec-A (Nathan) at H12 (2026-07-03) (attempt 1)

Task: Queue + scheduler infra — Bull factory + retry/backoff + DLQ (extend `bull-factory.ts`)
Branch: `feat/queue-infra` (pushed, commit `04f2e04`)
Files changed: 2
  - `src/core/queue/bull-factory.ts` (modified — stub → factory + helpers)
  - `src/core/queue/__tests__/bull-factory.test.ts` (new, 11 tests)

DoD self-check (binding conditions)
- [x] **Bull 4.x, zero-dep** — `import Bull from 'bull'` (declared `bull@4.16.3`); `package.json`+lock UNCHANGED. Bukan `bullmq`.
- [x] **backoff [1000,5000,30000] + clamp** — `integrationBackoffStrategy(attemptsMade)` → 1→1000, 2→5000, 3→30000, ≥4→30000 (clamp), 0→1000. Registered via `settings.backoffStrategies.integration`. Tested.
- [x] **DLQ forwarder only on exhaustion** — `attachDeadLetterForwarder(queue, sink)` on `'failed'`: `attemptsMade >= opts.attempts` → `sink.add({originalQueue,jobId,name,data,failedReason})`; else no-op. Both paths + failedReason-precedence tested (via structural mock, no Bull). `removeOnFail:false` agar failed inspectable.
- [x] **Redis injected (not constructed in factory)** — `buildQueueOptions(redis, …)` + `createQueue({name, redis, …})` terima `redis` injected; factory tak `loadConfig`/tak buka koneksi (→ tak ada open handle di unit test).
- [x] **concurrency from `WORKER_CONCURRENCY_DEFAULT`** — `registerProcessor(queue, jobName, concurrency, processor)` terima concurrency param; wiring pass `config.WORKER_CONCURRENCY_DEFAULT` (di-doc di JSDoc; factory tak coupling ke env).
- [x] **≥80% coverage on logic; no hanging Redis handles** — **logic fns = 100%** (backoff/naming/job-options/queue-options/DLQ-forwarder). File overall 88.9% line / 80% br; 3 uncovered = thin Bull wrappers `createQueue`/`registerProcessor`/`scheduleRepeatable` (integration-deferred per ACK GAP #4, genuinely logic-free 1-liner delegasi). `jest --detectOpenHandles` → **0 open handles**.
- [x] **function-based, 0 `any`** — semua factory/helper = function (0 `class`); 0 `any` di bull-factory.ts (mock test pakai struktural `DeadLetterSink`/`FailableQueue`, bukan `as any`). Explicit return types.
- [x] **make check green; extend bull-factory.ts** — hanya `core/queue/`; `_template`/`api.ts`/`env.ts`/`redis-client.ts` untouched.

Quality gate
- `make lint`: PASS · `make format-check`: PASS · `make typecheck`: PASS · `make test-unit`: PASS (61: +11 T07; 2 skipped template). `make check` exit 0.

Drift scans (§4.4)
- bull-factory.ts: `any` 0 · `class` 0 · console 0 · `throw new Error(` 0 · forbidden imports 0 (bull = official stack). Diff = 2 file `core/queue/` saja.

Security check
- N/A langsung (infra queue). Job-data convention = minimal context (ids), bukan full domain / secret (di-doc). DLQ payload = ids + failedReason (no secret).

Test evidence
- Unit: 11 — backoff (sequence, clamp-high, clamp-zero), naming (queue + dead-letter), default-job-options (defaults + override-wins), queue-options (backoffStrategies wired + redis passthrough), DLQ-forwarder (exhaustion→forward, retries-remain→no-op, failedReason-precedence).
- Coverage: logic 100% line/func; 3 thin wrappers integration-deferred. `--detectOpenHandles`: clean.
- Integration: N/A unit (Bull instantiation needs Redis; wrappers wired + integration-tested when server assembled).

Notes / questions (untuk PM A)
- **3 thin wrappers** (`createQueue`/`registerProcessor`/`scheduleRepeatable`) = 1-liner delegasi ke Bull, uncovered by design (butuh live Redis) — per ACK GAP #4 "stay genuinely logic-free". Semua keputusan (backoff/naming/options/DLQ) di logic fns yang 100% tested.
- **Q-A-07 (retry count)** — shipped `attempts=3` (backoff pakai 1s+5s; 30s reserved kalau attempts≥4), per-job configurable via `buildDefaultJobOptions({attempts})`. Menunggu ruling PO sebelum B's T14.
- **Non-retryable** (quota/template-not-approved, spec §7) — caller set `attempts:1` (override) atau skip enqueue; foundation sediakan mekanisme, keputusan per-job = B.

Requesting PM A VERDICT.

##### VERDICT T07 — APPROVED (H12, attempt 1) by PM A

✅ **APPROVE.** Full code-vs-spec audit done (read every line of the factory), all binding conditions independently verified.

**Code ↔ spec/planning audit (PM):**
- **Bull 4.x (CLAUDE §2 / `package.json`)** — `import Bull from 'bull'`, not bullmq; deps + lock UNCHANGED. ✓
- **Backoff (spec §7 / MVP §4.9)** — `integrationBackoffStrategy` → `[1000,5000,30000]` at `attemptsMade-1`, clamp-high (4/99→30000) + clamp-low (0→1000); wired via `settings.backoffStrategies.integration` ↔ `backoff:{type:'integration'}` (correct Bull 4.x custom-strategy API). Default `attempts=3` (Q-A-07 restrictive reading), per-job configurable. ✓
- **DLQ (spec §7)** — `attachDeadLetterForwarder` gates `attemptsMade >= attempts` → forwards **exactly once on exhaustion** (Bull fires `failed` every attempt — the gate is load-bearing and correct); `removeOnFail:false`; `<module>:dead` matches schema `status='dead'` enum. Both paths + `failedReason` precedence tested. ✓
- **Naming (CLAUDE §9)** — `queueName`=`${module}:${jobType}`, `deadLetterQueueName`=`${module}:dead`. ✓
- **Redis injected** — built at wiring, never in the factory; no `loadConfig` → no open handles; concurrency via `WORKER_CONCURRENCY_DEFAULT` param (no new constant, no `process.env`). ✓
- **Non-retryable (spec §7)** — `attempts:1` override mechanism provided; per-job call = B. ✓

**Quality (PM rerun):** `make check` green; **logic fns 100% covered**; file 88.9% line (>80 floor) — 3 uncovered (L73/123/133) are the `createQueue`/`registerProcessor`/`scheduleRepeatable` wrappers, which I read and confirmed are **genuinely logic-free 1-line Bull delegations** (ACK GAP #4 condition met); `--detectOpenHandles` **clean**; drift 0 (`any`/`class`/`console`/`bullmq`/hardcoded-redis/`loadConfig`); function-based; explicit return types; structural test mocks (no `as any`).

**Q-A-07 (retry count)** — shipped default `attempts=3` (restrictive/majority reading per CLAUDE §14, configurable); still open for PO to ratify + fix the spec §7 self-contradiction before B's T14. Non-blocking.

→ §1 tracker: T07 `approved`, Verified by PM A. → Code on `feat/queue-infra` awaiting **PO merge + CI**.

**Executor A: T07 done — queue/retry/DLQ primitive ready for B (T14 outbound retry) & C (T21 OTA poller / T24 health cron).** Next in queue: **T08** (error catalog — extend existing `src/core/errors/app-errors.ts` with Integration-specific codes per spec §9). Post PLAN when ready.

### ASSIGNMENT T08 — claimed by exec-A (Nathan) at H12 (2026-07-03)
- Branch: `feat/error-catalog` (proposal, `feat/<short>`)
- Routed from: PM-STATUS-A.md §1 T08 + VERDICT T07 hand-off. Spec: `04-integration-channels.md §9` (7 Integration codes + HTTP), guardrail (extend `src/core/errors/app-errors.ts`).

#### PLAN T08 — exec-A (Nathan) at H12 (2026-07-03)

**Scope recap**
- T08 = extend `app-errors.ts` dengan 7 error class Integration-specific per spec §9 (kode + HTTP status). Error class = **pengecualian** dari preferensi no-class PO (hierarki `AppError` memang class-based per repo/ADR; `CryptoError` T03 ikut pola ini). Dikonsumsi B (config CRUD 422, dispatch 429/502) & C (health 503, config 422).

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot A (Nathan) ✓ · CLAUDE.md loaded ✓
- Task spec read: `04 §9` (WEBHOOK_VERIFICATION_FAILED/WA_CONFIG_INVALID/TELEGRAM_CONFIG_INVALID/DND_BLOCK = 422, RATE_LIMIT = 429, THIRD_PARTY_UNREACHABLE = 502, CHANNEL_DEGRADED = 503).
- Parent docs spot-read: `app-errors.ts` (AppError abstract {statusCode, code, details, toJson}; existing ValidationError 400 / RateLimitError 429 `RATE_LIMIT_EXCEEDED` / ExternalServiceError 502 `EXTERNAL_SERVICE_ERROR` / dst).
- Dependencies: T01 ✓. Belum ada test app-errors; belum ada usage 422/DND_BLOCK.
- `make check` clean baseline ✓. Scaffolder risk: none.

**Files to modify**
- `src/core/errors/app-errors.ts` — append 7 kelas Integration (tak ubah kelas existing).

**Files to create**
```
src/core/errors/__tests__/app-errors.test.ts   (unit — status/code/message/toJson/instanceof)
```

**Approach**
- Append 7 subclass `AppError` (statusCode + code literal sesuai §9), kode SCREAMING_SNAKE_CASE:
  - `WebhookVerificationError` → 422 `WEBHOOK_VERIFICATION_FAILED`
  - `WaConfigInvalidError` → 422 `WA_CONFIG_INVALID`
  - `TelegramConfigInvalidError` → 422 `TELEGRAM_CONFIG_INVALID`
  - `DndBlockError` → 422 `DND_BLOCK` (internal RPC only — doc di komentar kelas)
  - `OutboundQuotaError` → 429 `RATE_LIMIT` (kode spec §9; lihat GAP #1)
  - `ThirdPartyUnreachableError` → 502 `THIRD_PARTY_UNREACHABLE` (lihat GAP #1)
  - `ChannelDegradedError` → 503 `CHANNEL_DEGRADED`
- Semua inherit constructor base `(message, details={})` → `toJson()` = `{code, message, details}`. 422 = status baru di hierarki (belum ada; AppError.statusCode abstract → OK).
- **Test**: per kelas assert `statusCode`, `code`, `instanceof AppError`, `toJson()` shape + `details` passthrough. ~100% atas kode baru.

**GAPs / questions — butuh ACK PM A**
- **GAP T08-#1 — 2 kode §9 overlap status dgn kelas generic existing.** `RATE_LIMIT`(429) vs `RateLimitError`(`RATE_LIMIT_EXCEEDED`,429); `THIRD_PARTY_UNREACHABLE`(502) vs `ExternalServiceError`(`EXTERNAL_SERVICE_ERROR`,502). **Intent (A)**: tambah kelas Integration-specific dgn **kode persis spec §9** (spec/API-CONTRACT = kontrak yg FE harapkan), **TIDAK** ubah kelas generic (shared hierarchy, dipakai lintas-service) dan **TIDAK** sentuh T06 (yg pakai `ExternalServiceError` di adapter-level — itu generic upstream, boundary-level pakai `ThirdPartyUnreachableError`). Konsekuensi: 2 kelas share status 429 & 502 tapi kode+semantik beda (generic vs quota / adapter vs boundary) — dapat diterima. B: reuse generic (deviasi kode dari §9). **Intent: A.**
- **GAP T08-#2 — scope: catalog saja, bukan error-handler plugin.** Per hand-off PM "extend app-errors.ts". T08 = **catalog only** (kelas + test). Canonical-envelope Fastify error-handler (map AppError→HTTP envelope, non-AppError→500) = concern terpisah (api.ts assembly / task lain). **Intent: catalog only**; flag kalau PM mau plugin masuk T08.

Awaiting PM A ACK (GAP #1/#2).

##### PM A ACK — T08 PLAN APPROVED with SCOPE CORRECTION (H12, 2026-07-03)

Verified by PM A against **spec §9** (read the full table) + existing `app-errors.ts`.

**GAP T08-#1 (codes overlap status) → Opsi A. APPROVED — mapping is faithful.** I checked all 7 against spec §9: `WEBHOOK_VERIFICATION_FAILED`/`WA_CONFIG_INVALID`/`TELEGRAM_CONFIG_INVALID`/`DND_BLOCK` = 422, `RATE_LIMIT` = 429 (outbound quota — semantically distinct from generic `RateLimitError`/`RATE_LIMIT_EXCEEDED` = public-API 100/min), `THIRD_PARTY_UNREACHABLE` = 502 (distinct from generic `ExternalServiceError`/`EXTERNAL_SERVICE_ERROR`), `CHANNEL_DEGRADED` = 503. New classes with the **exact spec §9 code strings** (the FE contract) + leave generic classes and T06's adapter usage untouched = correct. Two classes sharing a status with distinct codes is fine.

**GAP T08-#2 (scope) → SCOPE CORRECTION: catalog-only is INSUFFICIENT. T08 = F7 = "canonical envelope + Integration codes".**
- My earlier "extend app-errors.ts" hand-off under-scoped it. The ratified scope (`MVP-INTEGRATION-FIRST §1` **F7**, which PARENT §1a maps to T08) is **"Common error handlers (canonical envelope + Integration codes)"** — the **canonical-envelope error-handler is in scope**, not deferred.
- **Why it matters now:** without the handler, B/C endpoints that throw these AppErrors get Fastify's default body (`{statusCode,error,message}`) — the spec §9 `code` + `details` are **lost**, so FE can't key off the code. The handler is the thing that makes the catalog actually usable. Build it as a foundation plugin (unit-tested via `inject`, wired to `api.ts` later) exactly like T04/T05 — the stubbed `api.ts` is not a blocker.
- **Add to T08:** `src/plugins/error-handler.plugin.ts` (Fastify `setErrorHandler`; **NOT** `src/common/`).

**Binding conditions — verify at SUBMIT:**
*Catalog (7 classes):*
1. Exact spec §9 code strings + statuses (the 7 above); SCREAMING_SNAKE_CASE; all `extends AppError`, inherit `toJson()`. Error-class-as-class is the correct AppError-hierarchy exception to the no-class preference (you noted this — agreed).
2. Do NOT modify existing generic classes; do NOT touch T06's `ExternalServiceError` adapter usage.
3. `DndBlockError` — class comment noting "internal RPC only" per spec §9.
4. Per-class unit test: `statusCode`, `code`, `instanceof AppError`, `toJson()` shape, `details` passthrough.

*Canonical-envelope handler (F7):*
5. `error-handler.plugin.ts` maps: `AppError` → `reply.code(err.statusCode).send(<envelope>)` where envelope = `err.toJson()` (`{code,message,details}`) — the repo's designated serialization; **non-`AppError` → 500** with a generic safe body (NO internal message/stack leak).
6. **Structured log on error** with `correlationId` (CLAUDE §7) via `req.log`; winston redaction not bypassed — **no secret/PII in the response or log**.
7. Unit tests via `fastify.inject`: a route throwing each representative AppError → assert status + envelope body (`code`/`message`/`details`); a route throwing a plain `Error` → 500 + safe body (assert internal message NOT leaked).
8. If you find an API-CONTRACT doc pinning a different envelope wrapper (e.g. `{error:{…}}`), match it and flag; otherwise `toJson()` is canonical. Don't invent a contract silently.

*Both:* files = `app-errors.ts` (append) + `app-errors.test.ts` + `error-handler.plugin.ts` + its test; `env.ts`/`api.ts`/T06 untouched; 0 `any`; explicit return types; `make check` green.

If bundling both makes the PR large, that's fine (F7 is one logical feature). Branch `feat/error-catalog` OK — consider `feat/error-handling` since it now includes the plugin (your call). Proceed to coding.

#### SUBMIT T08 — exec-A (Nathan) at H12 (2026-07-03) (attempt 1)

Task: Error catalog (spec §9) + canonical-envelope error handler (F7)
Branch: `feat/error-handling` (pushed, commit `cab3551`)
Files changed: 4
  - `src/core/errors/app-errors.ts` (modified — append 7 classes; existing untouched, 0 deletions)
  - `src/core/errors/__tests__/app-errors.test.ts` (new, 14 tests)
  - `src/plugins/error-handler.plugin.ts` (new)
  - `src/plugins/__tests__/error-handler.plugin.test.ts` (new, 4 tests)

**⚠ Condition #8 — canonical envelope IS a wrapper (found + matched + flagging):** `docs/spec/README.md §2.3` pins the canonical envelope for **every service/endpoint** as `{ "error": { code, message, details } }` — a **wrapper**, NOT bare `toJson()`. So handler sends `{ error: err.toJson() }`, and non-AppError 500 uses code **`INTERNAL`** (README §2.3 list: `INTERNAL` for 500, not `INTERNAL_ERROR`). This **overrides** ACK binding #5's assumed shape (`= err.toJson()`); per your #8 instruction I matched the doc + flagged rather than invent. `toJson()` remains the inner payload (repo-designated). Observed pre-existing generic-class code drift vs README §2.3 (`AUTH_ERROR` vs `UNAUTHENTICATED`, `RATE_LIMIT_EXCEEDED` vs `RATE_LIMIT`, `EXTERNAL_SERVICE_ERROR`) — **not touched** (binding #2), flagged for later cleanup.

DoD self-check (binding conditions)
*Catalog:*
- [x] **#1 exact §9 codes+status** — 7 classes: WEBHOOK_VERIFICATION_FAILED/WA_CONFIG_INVALID/TELEGRAM_CONFIG_INVALID/DND_BLOCK=422, RATE_LIMIT=429, THIRD_PARTY_UNREACHABLE=502, CHANNEL_DEGRADED=503; SCREAMING_SNAKE_CASE; all `extends AppError`, inherit `toJson()`.
- [x] **#2 existing untouched** — `git diff` app-errors.ts = **42 insertions, 0 deletions**; generic `RateLimitError`/`ExternalServiceError`/etc. + T06 adapter usage intact.
- [x] **#3 DndBlockError comment** — class doc "internal RPC only" per §9.
- [x] **#4 per-class test** — statusCode, code, `instanceof AppError`, `toJson()` shape, details passthrough (14 tests = 7×2).
*Handler:*
- [x] **#5 envelope** — `AppError` → `reply.code(statusCode).send({ error: toJson() })` (wrapper per §2.3, see flag above).
- [x] **#5 non-AppError → safe 500** — code `INTERNAL`, message `Internal server error`, **no internal message/stack in body** (test asserts `res.body` NOT contains the thrown secret string).
- [x] **#6 structured log + correlationId** — `req.log.warn`(AppError)/`req.log.error`(unhandled) with `correlationId` (`x-correlation-id` header ?? `req.id`); request body NOT logged → no secret/PII leak.
- [x] **#7 inject tests** — WA_CONFIG_INVALID→422 envelope, RATE_LIMIT→429, NotFoundError→404 (hierarchy), plain Error→500 safe (leak-check). 4 tests.
- [x] **#8** — see flag above (wrapper matched, not invented).

Quality gate
- `make lint` PASS · `make format-check` PASS · `make typecheck` PASS · `make test-unit` PASS (79: +18 T08; 2 skipped). `make check` exit 0.

Coverage
- **error-handler.plugin.ts = 100% line / 100% func / 80% br** (1 br = defensive array-header). **7 new Integration classes = 100% covered.** app-errors.ts file-level = 68% **only because it includes pre-existing generic classes (ValidationError/AuthError/…) never tested by the boilerplate** — out of T08 scope (binding #2). New code fully covered.

Drift scans (§4.4)
- New/modified files: `any` 0 · console 0 · `throw new Error(` 0 (error classes only) · forbidden imports 0 · default export 0 · `.skip` 0. Diff = `app-errors.ts` (append) + 3 new files.

Security check
- Non-AppError 500 = generic body, internal message/stack NEVER sent (tested). Log has `correlationId` + err (server-side), no request body/secret. AppError messages are developer-set (callers must not embed secrets — convention).

Test evidence
- Unit: 18 — 14 catalog (7 classes × status/code/instanceof + toJson/details) + 4 handler (AppError envelope, quota 429, NotFound 404 hierarchy, non-AppError safe-500 + leak assertion). `fastify.inject`, no DB/Redis.

Notes / questions (untuk PM A)
- **Envelope wrapper `{error:{…}}`** (README §2.3) — the one deviation from ACK #5's literal wording; matched-not-invented per #8. Confirm OK.
- **Pre-existing generic-code drift vs README §2.3** (`AUTH_ERROR`↔`UNAUTHENTICATED`, `RATE_LIMIT_EXCEEDED`↔`RATE_LIMIT`) — left untouched (binding #2); candidate for a separate boilerplate-reconcile task (affects >1 service → Parent PM).
- **Handler not wired to `api.ts`** (stub) — foundation plugin, wired at assembly like T04/T05.

Requesting PM A VERDICT.

##### VERDICT T08 — APPROVED (H12, attempt 1) by PM A

✅ **APPROVE.** Both deliverables (catalog + canonical-envelope handler) verified independently vs spec §9 + README §2.3.

**Catalog audit (PM):** all 7 classes match spec §9 **exactly** (verified the diff): 422 `WEBHOOK_VERIFICATION_FAILED`/`WA_CONFIG_INVALID`/`TELEGRAM_CONFIG_INVALID`/`DND_BLOCK`, 429 `RATE_LIMIT`, 502 `THIRD_PARTY_UNREACHABLE`, 503 `CHANNEL_DEGRADED`. `git diff` = 42 insertions / **0 deletions** → generic classes + T06 usage intact (binding #2). `DndBlockError` doc'd internal-RPC-only. All `extends AppError`, inherit `toJson()`; new classes 100% covered.

**Handler audit (PM):** `registerErrorHandler` = `setErrorHandler` → `AppError` = `reply.code(err.statusCode).send({ error: err.toJson() })`; non-AppError = 500 `INTERNAL` generic body. Verified **no leak** (test throws `'super secret internal detail'` → asserts `res.body` excludes it; internal message/stack logged server-side only). correlationId from `x-correlation-id ?? req.id`, `req.log` structured, body not logged. Handler 100% line/func cov, 0 `any`.

**On the envelope-wrapper finding (condition #8 — exemplary):** you correctly found `README.md §2.3` pins the canonical envelope as the **wrapper** `{ error: { code, message, details } }` (not bare `toJson()`) + `INTERNAL` for 500 — I confirmed §2.3 says exactly this. You **matched the doc and flagged**, per my #8 instruction, instead of shipping my ACK #5's literal assumption. That's precisely the judgment I want. My ACK #5 assumed the shape; the doc overrode it — correct call.

**Your other finding → escalated as Q-A-08 (cross-service, not a T08 defect):** the **pre-existing generic `AppError` codes drift from README §2.3 canonical** — `AuthError`=`AUTH_ERROR` (FE expects `UNAUTHENTICATED`), `RateLimitError`=`RATE_LIMIT_EXCEEDED` (canonical `RATE_LIMIT`), `ExternalServiceError`=`EXTERNAL_SERVICE_ERROR`. This is shared-boilerplate (all services) so you correctly left it untouched (binding #2). Raised to Parent PM (§3c). Note the interplay: reconciling `RateLimitError`→`RATE_LIMIT` would then share the code with T08's `OutboundQuotaError` (429 `RATE_LIMIT`) — the reconcile task must decide whether to merge or keep both.

→ §1 tracker: T08 `approved`, Verified by PM A. → Code on `feat/error-handling` awaiting **PO merge + CI**.

**Executor A: T08 done — F7 complete (catalog + canonical envelope). B/C now have consistent error responses.** Foundation is **8/9**. Last one: **T09** (internal RPC server — spec §10 catalog; auth = shared-secret/mTLS, NOT session cookie; propose the `src/` location in your PLAN's session-start gate since there's no ratified path yet — I'll ACK it before you code, per the T09 guardrail). Post PLAN when ready.

### ASSIGNMENT T09 — claimed by exec-A (Nathan) at H12 (2026-07-03)
- Branch: `feat/internal-rpc-auth` (proposal, `feat/<short>`)
- Routed from: PM-STATUS-A.md §1 T09 + VERDICT T08 hand-off. Spec: `04 §2.4` (4 internal RPC catalog), `MVP §4.11` (auth = shared-secret **or** mTLS, NOT cookie; service-to-service; document scheme di README), guardrail (propose lokasi; **BUKAN** `src/rpc/`).

#### PLAN T09 — exec-A (Nathan) at H12 (2026-07-03)

**Scope recap**
- T09 = **auth primitive untuk internal RPC** (dipanggil HC/AI). Foundation: guard shared-secret timing-safe → 401 kalau invalid, jalan plugin-level SEBELUM handler. RPC handler konkret (`send_wa_message`/`send_telegram_message`/`submit|resubmit_wa_template_to_meta`, §2.4) = domain B/C — BUKAN T09. Pola sama T04 (verifier + injected secret), tapi **sinkron** (secret statik injected, tak ada async lookup → tak ada friksi eslint async-hook).

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot A (Nathan) ✓ · CLAUDE.md loaded ✓
- Task spec read: `04 §2.4` (RPC surface, internal-only), `MVP §4.11` (shared-secret/mTLS bukan cookie, service-to-service, doc di README).
- Parent docs spot-read: `hmac-validator.plugin.ts` (pola verifier+guard+timingSafeEqual), `app-errors.ts` (`AuthError` 401 — existing, pre-T08), `env.ts` (belum ada `INTERNAL_RPC_SECRET`).
- Dependencies: T01 ✓, T05 ✓ (tenant — RPC-nya B/C). T08 tidak diperlukan (`AuthError` sudah ada sebelum T08).
- **Secret source**: guard terima **injected secret** (bukan `loadConfig` di guard) → decoupled + testable. Env var `INTERNAL_RPC_SECRET` **TIDAK** ditambah di T09 — karena field env **required** baru akan pecahkan test yg panggil `loadConfig` (mis. `crypto.test` BASE_ENV). Wiring (assembly) yg tambah env var + pass ke guard (deferred, sama pola redis/HttpClient/resolveSecret). (GAP #3.)
- `make check` clean baseline ✓. Scaffolder risk: none.

**Files to create (lokasi PROPOSED — GAP #1, minta ACK)**
```
src/plugins/internal-rpc-auth.plugin.ts          (verifier + guard factory)
src/plugins/__tests__/internal-rpc-auth.plugin.test.ts
```

**Files to modify**
- (none) — `env.ts`/`api.ts`/`_template` untouched. Env var + wiring deferred.

**Approach (function-based)**
- **Pure**: `verifyInternalSecret(provided: string|undefined, expected: string): boolean` — `timingSafeEqual` (bukan `===`), length-guard dulu (mismatch→false, no throw), `provided===undefined` / `expected===''` → false (tolak empty-secret bypass). Timing-safe compare inline (hindari sentuh merged T04; lihat GAP #4).
- **Guard factory**: `internalRpcAuthGuard({ secret }): (req) => void` — baca header `X-Internal-Secret`, verify; gagal → `throw new AuthError('Invalid internal RPC credentials')` (401 native via `AuthError.statusCode`, tanpa dep handler). **Sinkron** (secret injected) → dipasang sbg `preHandler`, throw sebelum handler → RPC handler tak jalan.
- **Test** (`fastify.inject`): pure-fn (match, mismatch, missing, length-diff no-throw, empty-expected→false); guard inject (valid `X-Internal-Secret`→200+handler-ran; wrong→401+skip; missing→401+skip). No async → no eslint disable.

**GAPs / questions — butuh ACK PM A**
- **GAP T09-#1 — LOKASI (guardrail wajib propose).** PROPOSED: `src/plugins/internal-rpc-auth.plugin.ts` (konsisten dgn `hmac-validator`/`tenant-resolver`/`error-handler` plugins). **BUKAN** `src/rpc/` (dilarang guardrail). **Intent: plugins/.**
- **GAP T09-#2 — mekanisme + header.** Shared-secret (default MVP; mTLS = layer TLS/LB infra, bukan app-code → noted, tak diimplement di app). Header **`X-Internal-Secret`** (dedicated; hindari bentrok `Authorization` JWT user). Ini **kontrak lintas-service** (HC/AI harus kirim header sama) → perlu didokumentasikan di README (MVP §4.11) = tugas planning/PM (saya tak edit docs) → flag. **Intent: shared-secret + `X-Internal-Secret`.**
- **GAP T09-#3 — secret source.** Injected ke guard (T09); env `INTERNAL_RPC_SECRET` + wiring deferred ke assembly (menghindari pecahnya `loadConfig` test bila field required ditambah sekarang). **Intent: inject-only di T09**, env var saat wiring. (Kalau PM mau env var sekarang → saya buat OPTIONAL + update `crypto.test` BASE_ENV, tapi lebih berisiko.)
- **GAP T09-#4 (minor) — timing-safe compare.** Inline lokal di plugin (hindari sentuh merged T04 `hmac-validator`) vs extract `shared/utils/timing-safe-equal.ts` (DRY, refactor T04 pakai itu). **Intent: inline lokal** (minim blast radius; extract bisa jadi chore terpisah).

Awaiting PM A ACK (GAP #1–#4, esp. lokasi #1).

##### PM A ACK — T09 PLAN APPROVED, proceed to coding (H12, 2026-07-03)

Verified by PM A: spec §2.4 = 4 internal RPCs (send_wa/send_telegram/submit+resubmit_template) → handlers are B (T13/T16) & C (T20), **not T09**; MVP §4.11 = "auth via shared secret **or** mTLS, NOT cookies; service-to-service; document in README"; `AuthError` (401) exists pre-T08; `env.ts` has no `INTERNAL_RPC_SECRET`.

**Scope check — auth-guard-only is CORRECT (not under-scoped).** Unlike T08's F7 (which explicitly bundled the envelope), **MVP §4.11 scopes the foundation requirement to the auth SCHEME**, and §2.4's concrete RPC methods are B/C's. This matches the whole-foundation pattern (T04 hmac-guard, T05 tenant-resolver, T06 BSP-port = primitives; consumers mount routes). B/C mount their RPC routes with this guard — no orphaned "server scaffold." I checked; no expansion needed.

**GAP T09-#1 (location) → `src/plugins/internal-rpc-auth.plugin.ts`. APPROVED.** Consistent with `hmac-validator`/`tenant-resolver`/`error-handler` plugins; NOT `src/rpc/` (guardrail). Correct — T09 is a Fastify guard, plugins/ is its home.

**GAP T09-#2 (mechanism + header) → shared-secret + `X-Internal-Secret`. APPROVED — cross-service contract escalated (Q-A-09).** shared-secret is the MVP §4.11 default; mTLS = TLS/LB infra layer, correctly NOT app-code. Dedicated `X-Internal-Secret` header (avoids `Authorization` JWT collision) is sound. BUT this is a **cross-service contract** (HC/AI must send the same header+secret) and MVP §4.11 mandates documenting it in README — a shared-doc change affecting >1 service, so per PM-AGENT §0.6 I escalate to Parent PM (Q-A-09) to ratify + document, rather than editing unilaterally. T09 proceeds on this scheme; if PO/HC ratify differently, only the header string changes (trivial).

**GAP T09-#3 (secret source) → inject-only in T09; env var deferred. APPROVED.** Adding a required `INTERNAL_RPC_SECRET` now would break existing `loadConfig` tests (same class as Q-A-03). Inject the secret into the guard (like `resolveSecret`/redis/HttpClient), defer the env var + wiring to assembly. Consistent, decoupled, testable.

**GAP T09-#4 (timing-safe compare) → inline local. APPROVED, with a follow-up note.** Inline in the plugin avoids touching merged T04. Accepted for min blast radius on the finale. **Note:** timing-safe compare now exists in both `hmac-validator` (T04) and this plugin — a small **follow-up chore** to extract `shared/utils/timing-safe-equal.ts` and DRY both guards would centralize a security-critical primitive. Recommended post-foundation (not blocking T09; flag to Parent PM as a chore).

**Binding conditions — verify at SUBMIT (security floor):**
1. **`timingSafeEqual`** (never `===`), length-guard first (mismatch → `false`, no throw); `provided===undefined` → false; **`expected===''` → false** (reject empty-secret bypass — critical: a blank configured secret must never authenticate). All tested.
2. **Guard** reads `X-Internal-Secret`; invalid → `throw new AuthError('Invalid internal RPC credentials')` → **401 native** (via `AuthError.statusCode`, no handler dep). Synchronous `preHandler` → throws before handler → RPC handler never runs (handler-ran = `false` tested).
3. **NOT cookie/JWT auth** (MVP §4.11) — dedicated header + shared secret only.
4. **Injected secret** — no `loadConfig` in the guard; **no env var added** in T09 (deferred). No config/prisma coupling.
5. **Location** `src/plugins/internal-rpc-auth.plugin.ts` (NOT `src/rpc/`).
6. **inject tests** — valid → 200 + handler-ran; wrong → 401 + skip; missing → 401 + skip; pure-fn (match/mismatch/missing/length-diff-no-throw/empty-expected→false).
7. **No leak** — `AuthError` message generic, secret never echoed/logged.
8. Function-based; 0 `any`; explicit return types; coverage ≥ 80%; `make check` green; files = plugin + test only; `env.ts`/`api.ts` untouched.

Branch `feat/internal-rpc-auth` OK. Proceed to coding — this closes the foundation (T09/9).

<!--
TEMPLATE — copy untuk task baru:

### ASSIGNMENT T## — claimed by exec-A (Nathan) at H{N} HH:MM
- Branch: feat/<modul>-<short>
- Routed from: PM-STATUS-PARENT.md §1 T## (Parent PM assigned)

#### PLAN T## — exec-A (Nathan) at H{N} HH:MM

**Scope recap**
- ...

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot A (Nathan) ✓
- CLAUDE.md loaded ✓
- Task spec read: <doc:section>
- Parent docs spot-read: <list>
- Dependencies: T## ✓
- `make typecheck` clean ✓ ; `make lint` clean ✓
- Scaffolder risk: none / <tool>

**Files to create**
```
src/modules/<name>/...
```

**Files to modify**
- src/entrypoints/api.ts — ...

**Approach**
<1 paragraf>

**GAPs / questions**
- (none) / GAP T##-#1 — ...

Awaiting PM A ACK.

##### PM A ACK — T## PLAN APPROVED, proceed to coding (H{N})
- (atau) PM A REJECT-PLAN — fix sebelum mulai: <list>

#### SUBMIT T## — exec-A (Nathan) at H{N} HH:MM (attempt 1)

Task: <title>
Files changed: <count>
  - ...

DoD self-check
- [x] ...

Quality gate
- `make check`: PASS
- ...

Drift scans
- ...

Security check
- ...

Test evidence
- Unit: <n>
- Integration: <n>

Notes
- ...

Requesting PM A VERDICT.

##### VERDICT T## — APPROVED (H{N}, revisi N) by PM A
- All DoD verified ✓
- Drift scans clean ✓
- `make check` PASS confirmed by PM rerun
- → §1 task tracker updated; row mirrored to PARENT §1
- → Short roll-up posted to PARENT §2

(atau)

##### VERDICT T## — REJECT (revisi N) by PM A

⛔ Items to fix:

**Item #1 — <kategori>** `src/.../<file>.ts:<line>`
- **Violation**: <pelanggaran>
- **Fix**: <satu kalimat fix-path>

**Item #2 — ...**
- ...

Re-run `make check` after fix, confirm pass, resubmit (attempt N+1).

(atau)

##### VERDICT T## — ESCALATE by PM A
- Reason: <gap planning / open Q PO>
- Escalated to Parent PM at H{N} HH:MM (will reach PO via PARENT §3)
- Executor A: pick task lain dari §8 sementara

-->

---

## 3. Slot A open questions (mirror to PARENT §3)

> PM A catat di sini ketika executor A raise `GAP` atau `BLOCKED`. Setelah resolve atau eskalasi ke Parent PM, update status. Parent PM consolidate ke `PM-STATUS-PARENT.md §3`.

| ID            | Question | Source         | Status | Resolution |
| ------------- | -------- | -------------- | ------ | ---------- |
| Q-A-01 (arch) | Topology: schema-header L19-22 claims "Q-OPS-06 H12 shared-DB ratification + real `hotel_id→hotels(id)` FK", but ADR-0004 + CLAUDE §1 + data-model §1/§2 + spec §4.1 ("opaque if separate DB") mandate/permit **isolated DB**. Which is authoritative? Also runtime: spec §2.2 L101 "cross-table SELECT to Auth `hotels.dnd`" + T18 per-dept write-through assume shared. **T02 shipped isolated/opaque (forward-compatible; additive FK later).** PO confirm + fix stale header. | schema.prisma:19-22 vs ADR-0004/data-model/spec §4.1; T02 PLAN GAP-#1 | escalated → PARENT §3c | — |
| Q-A-02 (contract) | schema.prisma deviates from authoritative spec §4 at 2 non-functional points: (i) `external_id` full `@@index` vs spec §4.5 partial `WHERE external_id IS NOT NULL`; (ii) client-side `@default(uuid())` vs spec L169 / data-model §5 DB-side `gen_random_uuid()`. Schema self-contradictory (comment L26 says gen_random_uuid). **T02 shipped schema-as-is (Opsi A); both additively fixable.** PM recommendation = spec-faithful. PO ratify as-is OR direct reconcile. | schema.prisma:98,104,26 vs spec §4.4-4.8,L169; T02 PLAN GAP-#2 | escalated → PARENT §3c | — |
| Q-A-03 (infra) | `NODE_ENV=test` (Jest default) not in `env.ts` enum (`development\|staging\|production`) → any test calling `loadConfig()` throws. **Shared-infra: affects T04/T05… + slots B/C.** T03 used a localized `NODE_ENV:'development'` in-test workaround (no env.ts edit). Global fix = baseline env in `src/shared/utils/test-setup.ts` (recommended) OR add `'test'` to enum. Raised to Parent PM (affects >1 dev). | env.ts:16, Jest default; T03 SUBMIT Notes #2 | raised → PARENT (shared-infra) | — |
| Q-A-04 (contract) | **WA signature secret (affects slot B, T12).** Meta signs `X-Hub-Signature-256` with the **App Secret**; `webhook_verify_token` is only for the GET verify-challenge (`hub.verify_token`). Spec §4.2 conflates them, and `wa_configs` has no `app_secret` column. T04 is secret-agnostic (injected resolver) → not blocked; but B's webhook ingest will verify against the wrong secret unless resolved, likely needing a schema follow-up (`app_secret_enc` column). PO/PM B to rule. | spec §4.2 vs Meta WA Cloud API; schema `wa_configs`; T04 PLAN nota | escalated → PARENT §3a | — |
| Q-A-05 (tooling) | `@typescript-eslint/no-misused-promises` flags async Fastify hooks passed to route-option **properties** (`checksVoidReturn.properties`) — false-positive (Fastify awaits async hooks; typecheck passes). **Affects B/C** on every async `preHandler`/hook. T04 used a local 1-line `eslint-disable` (test only; `.eslintrc.cjs` untouched). Recommended project-level fix: `['error', { checksVoidReturn: { properties: false } }]` (keeps `no-floating-promises`). Shared-config → Parent PM. | T04 SUBMIT Notes; `.eslintrc.cjs` | raised → PARENT §3b (shared-config) | — |
| Q-A-06 (arch, cross-slot) | **WA module name — A + B share one bounded context.** T06 (BSP adapter, slot A) + T10 (WA config CRUD, slot B) live in the SAME module. **PM A decision: `whatsapp`** (matches ratified provider enum `'whatsapp'` + API routes `/whatsapp`; `wa` is only the DB/RPC abbrev). T06 proceeds on `src/modules/whatsapp/`. Parent PM: confirm **PM B aligns T10 to `whatsapp`**. | schema provider enum; spec routes; T06 PLAN GAP-#1 | PM A decided `whatsapp` → PARENT §3c (B alignment) | — |
| Q-A-09 (contract, cross-service) | **Internal RPC auth scheme — HC/AI must implement caller side.** T09 ships shared-secret guard reading header `X-Internal-Secret` (per MVP §4.11 "shared secret or mTLS, not cookie; document in README"). HC + AI (callers per §2.4) must send the same header + shared secret. **Needs: (a) README doc of the scheme (MVP §4.11), (b) cross-service ratification of header name + secret provisioning, (c) transport decision — internal routes on main API vs dedicated internal server/port (F8 `rpc/server.ts`).** Parent PM to route to PO + HC/AI. | MVP §4.11; spec §2.4; F8; T09 PLAN GAP-#2 | escalated → PARENT §3a | — |
| Q-A-08 (arch, cross-service) | **Generic `AppError` codes drift from README §2.3 canonical — shared boilerplate, all services.** `AuthError`=`AUTH_ERROR` (FE expects `UNAUTHENTICATED`), `RateLimitError`=`RATE_LIMIT_EXCEEDED` (canonical `RATE_LIMIT`), `ExternalServiceError`=`EXTERNAL_SERVICE_ERROR`. FE won't recognize these codes. T08 left generic classes untouched (binding #2). Needs a boilerplate-reconcile task (Parent PM/PO). Note: reconciling `RateLimitError`→`RATE_LIMIT` collides with T08 `OutboundQuotaError` code — decide merge-or-keep. | app-errors.ts vs README §2.3; T08 SUBMIT | escalated → PARENT §3c | — |
| Q-A-07 (contract) | **Outbound retry count — spec self-contradicts (affects B's T14).** spec §7 L344 "3 retries (1s,5s,30s)" vs §7 L345 "after 3 attempts→failed" vs MVP §4.9 "3-attempt". Is it 3 total attempts (30s delay unused) or 3 retries = 4 attempts (30s used)? **T07 ships default `attempts=3` (restrictive, configurable) + `[1s,5s,30s]` strategy.** PO: ratify + fix spec §7 wording before B builds T14. | spec §7 L344-345 vs MVP §4.9; T07 PLAN GAP-#2 | escalated → PARENT §3a | — |

---

## 4. Drift baseline (slot A files only, end of each day)

| Run | Touched files | `any` | console.log | `throw new Error(` | forbidden imports | default export (di luar entry) | `.skip` | hardcoded URL | webhook tanpa HMAC | wrap-Prisma interface |
| --- | ------------- | ----- | ----------- | ------------------ | ----------------- | ------------------------------ | ------- | ------------- | ------------------ | --------------------- |
| H12 baseline | (no src/ touched) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

> PM A jalankan drift scan per `PM-AGENT.md §3 Step 2` setiap SUBMIT + end-of-day full scan untuk slot A's touched files.

---

## 5. Standup log slot A (latest di atas)

> PM A post daily standup di sini, lalu post 1-2 baris ringkas ke `PM-STATUS-PARENT.md §6` (yang Parent PM consolidate jadi cross-team report).
>
> Format: per `PM-AGENT.md §7`.

### H12 — TBD (Nathan onboard, T01-T03 assigned)

```
QOOMA INT A (Nathan) — Standup — H{N}/{total}

✅ Approved hari ini
- (none — belum start)

🔄 In progress
- (none)

⛔ Rejected
- (none)

🚨 Eskalasi ke Parent PM
- (none)

📅 Gate status (global)
- Next gate: G1 — lihat PARENT §5

📈 Progress slot A
- 0 / 9 task (T01-T03 assigned · T04-T09 backlog)

🎯 Fokus besok
- Claim T01 (boilerplate `make check`) → T02 (Prisma migration) → T03 (encryption helper).
```

---

## 6. Slot A incidents / lessons (own-scope only)

> Hal yang affect cuma slot A. Bila affect > 1 dev, escalate ke `PM-STATUS-PARENT.md §7` lewat Parent PM.

_(kosong)_

---

## 7. PM A operating notes (untuk Executor A)

- PM A baca `PM-AGENT.md` (full) + `PM-STATUS-A.md` + scan `PM-STATUS-PARENT.md` (§1 mine, §3, §5, §8).
- PM A **TIDAK** edit `src/`, `prisma/schema.prisma` (kecuali typo non-semantik), `package.json` deps — read-only di area itu.
- PM A **BOLEH** update planning docs untuk sync (per `PM-AGENT.md §0.6`) — TAPI escalation ke Parent PM dulu bila perubahan affect dev lain. Tiap edit planning docs dicatat di `PM-STATUS-PARENT.md §4`.
- PM A **TIDAK** edit `PM-STATUS-B.md` / `PM-STATUS-C.md` — strict per-slot ownership.
- PM A **TIDAK** jawab open contract / package question — hanya PO via Parent PM.
- PM A **TIDAK** negosiasi scope. Descope adalah otoritas PO via Parent PM.
- On REJECT: fix exactly the listed items (file:line). Re-run `make check` self-validate. Resubmit per `EXECUTOR-PROTOCOL §4.5`, sebut item mana yang sudah di-address.
- Rebuttal: bila Executor A yakin PM A flag salah, post one-sentence rebuttal + evidence di sub-block `REBUTTAL T## item-#N`. PM A re-check dalam session yang sama.
- Untuk CLI command apapun yang touch root repo (scaffolder, generator, dll.): tulis exact command di PLAN supaya PM A bisa flag risiko overwrite sebelum executor run.
- Branch naming: `feat/<modul>-<short>`, `fix/<modul>-<short>`, `chore/<short>`, `docs/<short>` (per `CLAUDE.md §12`).
- Commit message: conventional commits — `feat(modul): X`, `fix(modul): Y`.
- Gunakan `make commit MSG="..."` — auto lint + typecheck + format-check sebelum commit.

---

## 8. Slot A queue (filter dari PARENT §1 di mana Slot=A)

> Parent PM authority untuk rewrite — PM A baca only. Executor A self-select dari §1 di atas bila tidak ada explicit ASSIGNMENT.

- **assigned** (claim langsung): T01, T02, T03
- **backlog** (after deps): T04, T05, T06, T07, T08, T09

<!-- Mirror format dari PM-STATUS-PARENT.md §1 template. -->

---

## 9. Roll-up reminder

Setiap kali PM A:

- **APPROVE** task → post 1 line ke `PM-STATUS-PARENT.md §2` (latest di atas) + update row status di PARENT §1
- **REJECT** task → tidak perlu PARENT roll-up (internal to slot A)
- **ESCALATE** task → post status `escalated` ke PARENT §1 + raise di PARENT §3 (Q register)
- **End-of-day** → post 3-line standup summary ke PARENT §6 di bawah Parent PM's daily roll-up block

Jangan paste full SUBMIT/VERDICT ke PARENT — itu tetap di sini.
