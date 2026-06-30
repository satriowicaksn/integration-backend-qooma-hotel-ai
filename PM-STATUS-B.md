# PM-STATUS-B — Qooma Integration · Dev B (Nanak)

> **Per-dev tracker untuk slot B (Nanak).** PM B + Executor B komunikasi **hanya** via file ini. Roll-up short summary ke `PM-STATUS-PARENT.md §2` setelah tiap VERDICT atau end-of-session.
>
> **PM A, PM C, Executor A, Executor C — JANGAN edit file ini.** File ini private ke slot B.
>
> **Identity check**: di response pertama session WAJIB confirm `Role: PM | Executor`, `Slot: B (Nanak)`. Bila user belum sebut slot — STOP, tanya dulu (lihat `KICKOFF.md §4`).
>
> Format block di §2 Active assignments **append-only** (lihat `EXECUTOR-PROTOCOL.md §0.5` & `PM-AGENT.md §0.4`).
>
> **Domain slot B (Integration)**: WhatsApp + outbound dispatch — `wa_configs` CRUD, verify-webhook action, WA inbound ingress (signature → persist → HC guest upsert → AI RPC), outbound WA dispatch (DND check + quota two-phase), retry queue, delivery receipts, WA template Meta relay. Spec routing: B1–B8 (`docs/spec/MVP-INTEGRATION-FIRST.md §1`).

---

## 0. Current focus (slot B)

- **Day**: H12+ (task tracker activated 2026-06-30)
- **Active task**: T10 (spec reading + module skeleton allowed; impl blocked sampai T02 APPROVE)
- **Branch**: —
- **Next gate (global)**: G1 — lihat `PM-STATUS-PARENT.md §5`
- **My queue (preview)**: T10–T16 (WA + dispatch) — lihat §8 di bawah
- **Critical dependency**: T02 (Nathan, Prisma migration) + T03 (encryption helper) WAJIB approved sebelum T10 impl. Sampai itu — boleh baca spec, draft module skeleton, draft types, draft handler stub. JANGAN `prisma generate` / hit DB / commit migration sendiri.

---

## 1. Task tracker (slot B — PM B authority)

> Mirror dari `PM-STATUS-PARENT.md §1` di mana Slot=B. PM B update status row di sini + push status update ke PARENT §1 setelah verdict.

| T## | Title                                                                            | Status   | Verified by PM | Notes                                                              |
| --- | -------------------------------------------------------------------------------- | -------- | -------------- | ------------------------------------------------------------------ |
| T10 | WA config CRUD (`GET, PUT /api/integrations/whatsapp`)                           | assigned | —              | Spec read + skeleton OK; impl blocked on T02 + T03                 |
| T11 | Verify webhook action (`POST /api/integrations/whatsapp/verify-webhook`)         | backlog  | —              | After T10                                                          |
| T12 | WA inbound webhook ingest (signature → persist → HC guest upsert → AI RPC)       | backlog  | —              | After T04 (Nathan) + T05 + T10                                     |
| T13 | Outbound WA dispatch RPC + DND check + quota two-phase                           | backlog  | —              | After T06 + T09 (Nathan); HC `check_and_reserve_outbound_quota` RPC|
| T14 | Outbound retry queue (3 attempts exponential backoff)                            | backlog  | —              | After T07 (Nathan) + T13                                           |
| T15 | Delivery receipts ingest (WA Cloud webhook stream)                               | backlog  | —              | After T04 + T12                                                    |
| T16 | WA template Meta relay (submit/resubmit/callback to HC)                          | backlog  | —              | After T06; HC internal `updateWaTemplateStatus` callback           |

---

## 2. Active assignments (append-only)

> **Executor B** append `ASSIGNMENT` block saat claim task. **PM B** append `ACK` / `VERDICT` sub-block di bawah block executor — JANGAN edit block lama.

_(kosong — belum ada assignment)_

<!--
TEMPLATE — copy untuk task baru:

### ASSIGNMENT T## — claimed by exec-B (Nanak) at H{N} HH:MM
- Branch: feat/<modul>-<short>
- Routed from: PM-STATUS-PARENT.md §1 T## (Parent PM assigned)

#### PLAN T## — exec-B (Nanak) at H{N} HH:MM

**Scope recap**
- ...

**Session-start gate** (EXECUTOR-PROTOCOL §2)
- Identity confirmed: Executor, Slot B (Nanak) ✓
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

Awaiting PM B ACK.

##### PM B ACK — T## PLAN APPROVED, proceed to coding (H{N})
- (atau) PM B REJECT-PLAN — fix sebelum mulai: <list>

#### SUBMIT T## — exec-B (Nanak) at H{N} HH:MM (attempt 1)

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

Requesting PM B VERDICT.

##### VERDICT T## — APPROVED (H{N}, revisi N) by PM B
- All DoD verified ✓
- Drift scans clean ✓
- `make check` PASS confirmed by PM rerun
- → §1 task tracker updated; row mirrored to PARENT §1
- → Short roll-up posted to PARENT §2

(atau)

##### VERDICT T## — REJECT (revisi N) by PM B

⛔ Items to fix:

**Item #1 — <kategori>** `src/.../<file>.ts:<line>`
- **Violation**: <pelanggaran>
- **Fix**: <satu kalimat fix-path>

**Item #2 — ...**
- ...

Re-run `make check` after fix, confirm pass, resubmit (attempt N+1).

(atau)

##### VERDICT T## — ESCALATE by PM B
- Reason: <gap planning / open Q PO>
- Escalated to Parent PM at H{N} HH:MM (will reach PO via PARENT §3)
- Executor B: pick task lain dari §8 sementara

-->

---

## 3. Slot B open questions (mirror to PARENT §3)

> PM B catat di sini ketika executor B raise `GAP` atau `BLOCKED`. Setelah resolve atau eskalasi ke Parent PM, update status. Parent PM consolidate ke `PM-STATUS-PARENT.md §3`.

| ID            | Question | Source         | Status | Resolution |
| ------------- | -------- | -------------- | ------ | ---------- |
| —             | —        | —              | —      | —          |

---

## 4. Drift baseline (slot B files only, end of each day)

| Run | Touched files | `any` | console.log | `throw new Error(` | forbidden imports | default export (di luar entry) | `.skip` | hardcoded URL | webhook tanpa HMAC | wrap-Prisma interface |
| --- | ------------- | ----- | ----------- | ------------------ | ----------------- | ------------------------------ | ------- | ------------- | ------------------ | --------------------- |
| H12 baseline | (no src/ touched) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

> PM B jalankan drift scan per `PM-AGENT.md §3 Step 2` setiap SUBMIT + end-of-day full scan untuk slot B's touched files.

---

## 5. Standup log slot B (latest di atas)

> PM B post daily standup di sini, lalu post 1-2 baris ringkas ke `PM-STATUS-PARENT.md §6` (yang Parent PM consolidate jadi cross-team report).
>
> Format: per `PM-AGENT.md §7`.

### H12 — TBD (Nanak onboard, T10 assigned — skeleton-only sampai T02 land)

```
QOOMA INT B (Nanak) — Standup — H{N}/{total}

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

📈 Progress slot B
- 0 / 7 task (T10 assigned · T11-T16 backlog)
- Blocked: impl T10 menunggu T02 (Nathan)

🎯 Fokus besok
- T10 spec reading + draft module skeleton (`src/modules/whatsapp/`) + draft types dari spec §4 DDL `wa_configs`.
```

---

## 6. Slot B incidents / lessons (own-scope only)

> Hal yang affect cuma slot B. Bila affect > 1 dev, escalate ke `PM-STATUS-PARENT.md §7` lewat Parent PM.

_(kosong)_

---

## 7. PM B operating notes (untuk Executor B)

- PM B baca `PM-AGENT.md` (full) + `PM-STATUS-B.md` + scan `PM-STATUS-PARENT.md` (§1 mine, §3, §5, §8).
- PM B **TIDAK** edit `src/`, `prisma/schema.prisma` (kecuali typo non-semantik), `package.json` deps — read-only di area itu.
- PM B **BOLEH** update planning docs untuk sync (per `PM-AGENT.md §0.6`) — TAPI escalation ke Parent PM dulu bila perubahan affect dev lain. Tiap edit planning docs dicatat di `PM-STATUS-PARENT.md §4`.
- PM B **TIDAK** edit `PM-STATUS-A.md` / `PM-STATUS-C.md` — strict per-slot ownership.
- PM B **TIDAK** jawab open contract / package question — hanya PO via Parent PM.
- PM B **TIDAK** negosiasi scope. Descope adalah otoritas PO via Parent PM.
- On REJECT: fix exactly the listed items (file:line). Re-run `make check` self-validate. Resubmit per `EXECUTOR-PROTOCOL §4.5`, sebut item mana yang sudah di-address.
- Rebuttal: bila Executor B yakin PM B flag salah, post one-sentence rebuttal + evidence di sub-block `REBUTTAL T## item-#N`. PM B re-check dalam session yang sama.
- Untuk CLI command apapun yang touch root repo (scaffolder, generator, dll.): tulis exact command di PLAN supaya PM B bisa flag risiko overwrite sebelum executor run.
- Branch naming: `feat/<modul>-<short>`, `fix/<modul>-<short>`, `chore/<short>`, `docs/<short>` (per `CLAUDE.md §12`).
- Commit message: conventional commits — `feat(modul): X`, `fix(modul): Y`.
- Gunakan `make commit MSG="..."` — auto lint + typecheck + format-check sebelum commit.

---

## 8. Slot B queue (filter dari PARENT §1 di mana Slot=B)

> Parent PM authority untuk rewrite — PM B baca only. Executor B self-select dari §1 di atas bila tidak ada explicit ASSIGNMENT.

- **assigned** (claim langsung, spec read + skeleton OK; impl blocked on T02 + T03): T10
- **backlog** (after deps): T11, T12, T13, T14, T15, T16

<!-- Mirror format dari PM-STATUS-PARENT.md §1 template. -->

---

## 9. Roll-up reminder

Setiap kali PM B:

- **APPROVE** task → post 1 line ke `PM-STATUS-PARENT.md §2` (latest di atas) + update row status di PARENT §1
- **REJECT** task → tidak perlu PARENT roll-up (internal to slot B)
- **ESCALATE** task → post status `escalated` ke PARENT §1 + raise di PARENT §3 (Q register)
- **End-of-day** → post 3-line standup summary ke PARENT §6 di bawah Parent PM's daily roll-up block

Jangan paste full SUBMIT/VERDICT ke PARENT — itu tetap di sini.
