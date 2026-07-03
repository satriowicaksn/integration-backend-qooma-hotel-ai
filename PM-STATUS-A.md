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
- **Active task**: T01 / T02 / T03 (assigned — claim per `EXECUTOR-PROTOCOL §2`)
- **Branch**: —
- **Next gate (global)**: G1 — lihat `PM-STATUS-PARENT.md §5`
- **My queue (preview)**: T01–T09 (foundation) — lihat §8 di bawah (mirror dari PARENT §1 filter Slot=A)
- **Critical path**: T02 (Prisma migration) blokir implementasi Nanak (T10+) dan Satrio (T17+). Prioritaskan T01 → T02 → T03 sequence.

---

## 1. Task tracker (slot A — PM A authority)

> Mirror dari `PM-STATUS-PARENT.md §1` di mana Slot=A. PM A update status row di sini + push status update ke PARENT §1 setelah verdict.

| T## | Title                                                                            | Status   | Verified by PM | Notes                                                              |
| --- | -------------------------------------------------------------------------------- | -------- | -------------- | ------------------------------------------------------------------ |
| T01 | `make check` green dari boilerplate                                              | assigned | —              | Start here                                                         |
| T02 | Prisma schema initial migration (8 Integration tables + indexes)                 | assigned | —              | ⚠ Blokir slot B + C                                                |
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
| —             | —        | —              | —      | —          |

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
