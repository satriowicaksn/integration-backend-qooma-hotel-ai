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
- **Active task**: T01 ✅ MERGED (PR #1) → **T02 PLAN ACK'd, coding** (Prisma migration, critical path). 2 open Qs escalated to PO (Q-A-01 topology, Q-A-02 spec-drift) — non-blocking.
- **Branch**: `feat/prisma-init-migration` (T02, in progress)
- **Next gate (global)**: G1 — lihat `PM-STATUS-PARENT.md §5`
- **My queue (preview)**: T01–T09 (foundation) — lihat §8 di bawah (mirror dari PARENT §1 filter Slot=A)
- **Critical path**: T02 (Prisma migration) blokir implementasi Nanak (T10+) dan Satrio (T17+). Prioritaskan T01 → T02 → T03 sequence.

---

## 1. Task tracker (slot A — PM A authority)

> Mirror dari `PM-STATUS-PARENT.md §1` di mana Slot=A. PM A update status row di sini + push status update ke PARENT §1 setelah verdict.

| T## | Title                                                                            | Status   | Verified by PM | Notes                                                              |
| --- | -------------------------------------------------------------------------------- | -------- | -------------- | ------------------------------------------------------------------ |
| T01 | `make check` green dari boilerplate                                              | merged   | PM A (H12) ✓   | Opsi B (jest.config.cjs, zero-dep). Merged to main PR #1 `7b40e11`. attempt 1 |
| T02 | Prisma schema initial migration (8 Integration tables + indexes)                 | wip      | —              | ⚠ Blokir slot B + C. PLAN ACK'd (GAP#1→A opaque, GAP#2→A as-is). 2 Qs escalated. |
| T03 | Encryption-at-rest helper (AES-256-GCM / KMS)                                    | assigned | —              | After T01; consumed by T10 + T17                                   |
| T04 | Webhook signature-verification middleware (Meta `X-Hub-Signature-256` + Telegram)| backlog  | —              | After T01                                                          |
| T05 | Tenant resolution from `:hotel_slug` (LRU 5-min, hotels.code lookup)             | backlog  | —              | After T01                                                          |
| T06 | BSP adapter interface + `1engage` impl                                           | backlog  | —              | After T01                                                          |
| T07 | Queue + scheduler infra (BullMQ + retry + DLQ)                                   | backlog  | —              | After T02                                                          |
| T08 | Common error handlers (Integration-specific codes per spec §9)                   | backlog  | —              | After T01                                                          |
| T09 | Internal RPC server (HTTP/mTLS; spec §10 catalog)                                | backlog  | —              | After T01 + T05                                                    |

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
