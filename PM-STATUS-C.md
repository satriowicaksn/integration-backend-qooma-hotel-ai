# PM-STATUS-C — Qooma Integration · Dev C (Satrio)

> **Per-dev tracker untuk slot C (Satrio).** PM C + Executor C komunikasi **hanya** via file ini. Roll-up short summary ke `PM-STATUS-PARENT.md §2` setelah tiap VERDICT atau end-of-session.
>
> **PM A, PM B, Executor A, Executor B — JANGAN edit file ini.** File ini private ke slot C.
>
> **Identity check**: di response pertama session WAJIB confirm `Role: PM | Executor`, `Slot: C (Satrio)`. Bila user belum sebut slot — STOP, tanya dulu (lihat `KICKOFF.md §4`).
>
> Format block di §2 Active assignments **append-only** (lihat `EXECUTOR-PROTOCOL.md §0.5` & `PM-AGENT.md §0.4`).
>
> **Domain slot C (Integration)**: Telegram + OTA + QR + health — `telegram_configs` CRUD, per-dept Telegram routing write-through (HC `departments`), Telegram inbound commands (`/take` `/release` `/done` `/help`), outbound Telegram dispatch, OTA IMAP poller + parser → HC pending-visit RPC, QR generation/download (1024×1024 PNG → object storage), integration overview, channel health probes + snapshots + `integration:health_changed` socket emits. Spec routing: C1–C9 (`docs/spec/MVP-INTEGRATION-FIRST.md §1`).

---

## 0. Current focus (slot C)

- **Day**: H12+ (task tracker activated 2026-06-30)
- **Active task**: T17 (spec reading + module skeleton allowed; impl blocked sampai T02 APPROVE)
- **Branch**: —
- **Next gate (global)**: G1 — lihat `PM-STATUS-PARENT.md §5`
- **My queue (preview)**: T17–T25 (Telegram + OTA + QR + health) — lihat §8 di bawah
- **Critical dependency**: T02 (Nathan, Prisma migration) + T03 (encryption helper) WAJIB approved sebelum T17 impl. Sampai itu — boleh baca spec, draft module skeleton, draft types, draft handler stub. JANGAN `prisma generate` / hit DB / commit migration sendiri.
- **Cross-service note**: T18 (per-dept routing write-through) menulis langsung ke HC `departments.telegram_chat_id` per Q-OPS-06 — perlu koordinasi dengan PM B Hotel Core supaya shared-DB write tidak conflict dengan HC `departments` schema migration. Lihat `docs/spec/04-integration-channels.md` §6.

---

## 1. Task tracker (slot C — PM C authority)

> Mirror dari `PM-STATUS-PARENT.md §1` di mana Slot=C. PM C update status row di sini + push status update ke PARENT §1 setelah verdict.

| T## | Title                                                                            | Status   | Verified by PM | Notes                                                              |
| --- | -------------------------------------------------------------------------------- | -------- | -------------- | ------------------------------------------------------------------ |
| T17 | Telegram config CRUD (`GET, PUT /api/integrations/telegram`)                     | assigned | —              | Spec read + skeleton OK; impl blocked on T02 + T03                 |
| T18 | Per-dept Telegram routing write-through (HC `departments` table)                 | backlog  | —              | After T17; per Q-OPS-06 shared-DB direct write                     |
| T19 | Telegram inbound webhook + commands (`/take`, `/release`, `/done`, `/help`)      | backlog  | —              | After T04 (Nathan) + T05 + T17                                     |
| T20 | Outbound Telegram dispatch RPC                                                   | backlog  | —              | After T06 + T09 (Nathan); per-dept routing per T18                 |
| T21 | OTA email IMAP poller + parser pipeline + HC pending-visit RPC                   | backlog  | —              | After T07 (Nathan); HC internal RPC for pending-visit insert       |
| T22 | QR generation + download (1024×1024 PNG, object storage)                         | backlog  | —              | After T02 + T10 (Nanak)                                            |
| T23 | Integration overview endpoint (`GET /api/integrations`)                          | backlog  | —              | After T10 (Nanak) + T17                                            |
| T24 | Channel health probes + snapshots + 2-poll debounce                              | backlog  | —              | After T07 (Nathan) + T10 (Nanak) + T17                             |
| T25 | `integration:health_changed` socket emits                                        | backlog  | —              | After T24                                                          |

---

## 2. Active assignments (append-only)

> **Executor C** append `ASSIGNMENT` block saat claim task. **PM C** append `ACK` / `VERDICT` sub-block di bawah block executor — JANGAN edit block lama.

_(kosong — belum ada assignment)_

<!--
TEMPLATE — copy untuk task baru:

### ASSIGNMENT T## — claimed by exec-C (Satrio) at H{N} HH:MM
- Branch: feat/<modul>-<short>
- Routed from: PM-STATUS-PARENT.md §1 T## (Parent PM assigned)

#### PLAN T## — exec-C (Satrio) at H{N} HH:MM

**Scope recap**
- ...

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot C (Satrio) ✓
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

Awaiting PM C ACK.

##### PM C ACK — T## PLAN APPROVED, proceed to coding (H{N})
- (atau) PM C REJECT-PLAN — fix sebelum mulai: <list>

#### SUBMIT T## — exec-C (Satrio) at H{N} HH:MM (attempt 1)

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

Requesting PM C VERDICT.

##### VERDICT T## — APPROVED (H{N}, revisi N) by PM C
- All DoD verified ✓
- Drift scans clean ✓
- `make check` PASS confirmed by PM rerun
- → §1 task tracker updated; row mirrored to PARENT §1
- → Short roll-up posted to PARENT §2

(atau)

##### VERDICT T## — REJECT (revisi N) by PM C

⛔ Items to fix:

**Item #1 — <kategori>** `src/.../<file>.ts:<line>`
- **Violation**: <pelanggaran>
- **Fix**: <satu kalimat fix-path>

**Item #2 — ...**
- ...

Re-run `make check` after fix, confirm pass, resubmit (attempt N+1).

(atau)

##### VERDICT T## — ESCALATE by PM C
- Reason: <gap planning / open Q PO>
- Escalated to Parent PM at H{N} HH:MM (will reach PO via PARENT §3)
- Executor C: pick task lain dari §8 sementara

-->

---

## 3. Slot C open questions (mirror to PARENT §3)

> PM C catat di sini ketika executor C raise `GAP` atau `BLOCKED`. Setelah resolve atau eskalasi ke Parent PM, update status. Parent PM consolidate ke `PM-STATUS-PARENT.md §3`.

| ID            | Question | Source         | Status | Resolution |
| ------------- | -------- | -------------- | ------ | ---------- |
| —             | —        | —              | —      | —          |

---

## 4. Drift baseline (slot C files only, end of each day)

| Run | Touched files | `any` | console.log | `throw new Error(` | forbidden imports | default export (di luar entry) | `.skip` | hardcoded URL | webhook tanpa HMAC | wrap-Prisma interface |
| --- | ------------- | ----- | ----------- | ------------------ | ----------------- | ------------------------------ | ------- | ------------- | ------------------ | --------------------- |
| H12 baseline | (no src/ touched) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

> PM C jalankan drift scan per `PM-AGENT.md §3 Step 2` setiap SUBMIT + end-of-day full scan untuk slot C's touched files.

---

## 5. Standup log slot C (latest di atas)

> PM C post daily standup di sini, lalu post 1-2 baris ringkas ke `PM-STATUS-PARENT.md §6` (yang Parent PM consolidate jadi cross-team report).
>
> Format: per `PM-AGENT.md §7`.

### H12 — TBD (Satrio onboard, T17 assigned — skeleton-only sampai T02 land)

```
QOOMA INT C (Satrio) — Standup — H{N}/{total}

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

📈 Progress slot C
- 0 / 9 task (T17 assigned · T18-T25 backlog)
- Blocked: impl T17 menunggu T02 (Nathan)

🎯 Fokus besok
- T17 spec reading + draft module skeleton (`src/modules/telegram/`) + draft types dari spec §4 DDL `telegram_configs`.
```

---

## 6. Slot C incidents / lessons (own-scope only)

> Hal yang affect cuma slot C. Bila affect > 1 dev, escalate ke `PM-STATUS-PARENT.md §7` lewat Parent PM.

_(kosong)_

---

## 7. PM C operating notes (untuk Executor C)

- PM C baca `PM-AGENT.md` (full) + `PM-STATUS-C.md` + scan `PM-STATUS-PARENT.md` (§1 mine, §3, §5, §8).
- PM C **TIDAK** edit `src/`, `prisma/schema.prisma` (kecuali typo non-semantik), `package.json` deps — read-only di area itu.
- PM C **BOLEH** update planning docs untuk sync (per `PM-AGENT.md §0.6`) — TAPI escalation ke Parent PM dulu bila perubahan affect dev lain. Tiap edit planning docs dicatat di `PM-STATUS-PARENT.md §4`.
- PM C **TIDAK** edit `PM-STATUS-A.md` / `PM-STATUS-B.md` — strict per-slot ownership.
- PM C **TIDAK** jawab open contract / package question — hanya PO via Parent PM.
- PM C **TIDAK** negosiasi scope. Descope adalah otoritas PO via Parent PM.
- On REJECT: fix exactly the listed items (file:line). Re-run `make check` self-validate. Resubmit per `EXECUTOR-PROTOCOL §4.5`, sebut item mana yang sudah di-address.
- Rebuttal: bila Executor C yakin PM C flag salah, post one-sentence rebuttal + evidence di sub-block `REBUTTAL T## item-#N`. PM C re-check dalam session yang sama.
- Untuk CLI command apapun yang touch root repo (scaffolder, generator, dll.): tulis exact command di PLAN supaya PM C bisa flag risiko overwrite sebelum executor run.
- Branch naming: `feat/<modul>-<short>`, `fix/<modul>-<short>`, `chore/<short>`, `docs/<short>` (per `CLAUDE.md §12`).
- Commit message: conventional commits — `feat(modul): X`, `fix(modul): Y`.
- Gunakan `make commit MSG="..."` — auto lint + typecheck + format-check sebelum commit.

---

## 8. Slot C queue (filter dari PARENT §1 di mana Slot=C)

> Parent PM authority untuk rewrite — PM C baca only. Executor C self-select dari §1 di atas bila tidak ada explicit ASSIGNMENT.

- **assigned** (claim langsung, spec read + skeleton OK; impl blocked on T02 + T03): T17
- **backlog** (after deps): T18, T19, T20, T21, T22, T23, T24, T25

<!-- Mirror format dari PM-STATUS-PARENT.md §1 template. -->

---

## 9. Roll-up reminder

Setiap kali PM C:

- **APPROVE** task → post 1 line ke `PM-STATUS-PARENT.md §2` (latest di atas) + update row status di PARENT §1
- **REJECT** task → tidak perlu PARENT roll-up (internal to slot C)
- **ESCALATE** task → post status `escalated` ke PARENT §1 + raise di PARENT §3 (Q register)
- **End-of-day** → post 3-line standup summary ke PARENT §6 di bawah Parent PM's daily roll-up block

Jangan paste full SUBMIT/VERDICT ke PARENT — itu tetap di sini.
