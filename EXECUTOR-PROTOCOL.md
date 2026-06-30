# EXECUTOR-PROTOCOL.md — Workflow Executor Session (Qooma Backend, multi-dev)

> **Kamu adalah executor session.** Kamu implementasi **satu task pada satu waktu** dalam slot kamu (A, B, atau C). Kamu lapor ke **PM Agent slot kamu** (lihat `PM-AGENT.md` + `KICKOFF.md`), yang validasi outputmu terhadap planning sebelum approve.
>
> 3 dev paralel — slot identitas:
>
> - **Executor A** = Nathan (PM A counterpart)
> - **Executor B** = Nanak (PM B counterpart)
> - **Executor C** = Satrio (PM C counterpart)
>
> `CLAUDE.md` (auto-loaded) adalah **code rulebook** — apa yang ditulis & dilarang di kode. File INI adalah **workflow rulebook** — cara kerja di dalam tim. Keduanya binding.
>
> **Komunikasi PM ↔ Executor hanya lewat `PM-STATUS-<SLOT>.md`** (PM-STATUS-A.md, -B.md, atau -C.md sesuai slot kamu). Tidak ada chat lain. Kamu baca PM-STATUS-<SLOT> di awal session, tulis di sana saat propose PLAN / SUBMIT / report blocker, dan baca lagi untuk lihat VERDICT PM.
>
> **JANGAN baca/tulis** `PM-STATUS-PARENT.md` atau PM-STATUS slot lain. Itu di luar scope kamu — PM slot kamu yang filter & roll-up.

---

## 0. Session bootstrap — WAJIB tiap session

### 0.0 Identity check — paling pertama, sebelum apapun

Setiap fresh session, WAJIB tulis identitas di response pertama:

```
Role: Executor
Slot: A (Nathan) | B (Nanak) | C (Satrio)
Reading: PM-STATUS-<SLOT>.md only (per-dev tracker)
```

**Bila user belum sebut slot di prompt awal — STOP, tanya dulu**:

> "Sebelum mulai: ini Executor untuk Dev slot mana — A (Nathan), B (Nanak), atau C (Satrio)? Saya akan baca PM-STATUS file yang sesuai."

JANGAN tebak slot dari clue lain (history, git log, branch name). JANGAN baca file PM-STATUS apapun atau write apapun sampai slot konfirmasi user. Identitas salah = nulis di file slot lain = bisa overwrite kerja executor lain + bikin PM lain bingung.

Sekali konfirmasi, terus pakai slot itu seluruh session.

### 0.1 Sebelum melakukan apapun

```bash
git pull --rebase                            # sync dengan push dev lain
sed -n '1,200p' PM-STATUS-<SLOT>.md          # state + queue slot kamu
git status                                   # pastikan working tree bersih
```

Conflict di `PM-STATUS-<SLOT>.md` → keep both sides (semua section append-only — §0.5). Conflict di `src/` → baca kedua versi; bila ragu, post `BLOCKED` di `PM-STATUS-<SLOT>.md §2` sebelum lanjut.

### 0.2 Read order

Executor punya read scope **lebih sempit** dari PM. Yang **wajib** dibaca tiap session:

1. **`PM-STATUS-<SLOT>.md`** — terutama §1 Task tracker (status row), §2 Active assignments (task assigned ke kamu), §8 slot queue (untuk self-select bila belum ada ASSIGNMENT).
2. **`CLAUDE.md`** (auto-loaded) — code rulebook.
3. **`EXECUTOR-PROTOCOL.md`** (file ini) — workflow.
4. **`KICKOFF.md`** — big picture tim + identitas (cukup sekali di session pertama; subsequent session boleh skip kalau sudah memorized).
5. **Parent doc** yang task-mu reference. PM <SLOT> akan tulis ini di ASSIGNMENT notes / task spec. Contoh:
   - Task setup → `docs/PROJECT_STRUCTURE.md`, `Makefile`, `docker-compose.yml`
   - Task modul baru → `docs/MODULE_TEMPLATE.md`, `src/modules/_template/`
   - Task security (auth/webhook/crypto) → `docs/SECURITY.md`
   - Task test → `docs/TESTING.md`
   - Task arsitektur lintas → `docs/ARCHITECTURE.md`, `docs/decisions/*` ADR relevan

**Yang tidak perlu kamu baca tiap session** (PM yang jaga): ADR archive lengkap, runbook ops, README marketing, `PM-AGENT.md`, `PM-STATUS-PARENT.md`, PM-STATUS slot lain. Cukup baca on-demand atau via PM filter.

**Yang TIDAK BOLEH kamu baca/tulis**:

- `PM-STATUS-PARENT.md` — Parent PM scope; PM <SLOT> kamu yang filter info relevan
- `PM-STATUS-` slot lain (mis. kamu Executor A → jangan touch PM-STATUS-B.md / -C.md)

Bila PM-STATUS-<SLOT> menyebut keputusan yang bertentangan dengan planning doc → **planning menang**. Post `GAP T##` ke `PM-STATUS-<SLOT>.md §2` dan tunggu klarifikasi PM <SLOT>. Jangan tebak.

### 0.3 Memilih task

Lihat `PM-STATUS-<SLOT>.md` §1 (slot task tracker) dan §8 (slot queue — Parent PM yang mirror dari PARENT §8):

- **Bila PM <SLOT> sudah assign** kamu di §2 (block `ASSIGNMENT T## — claimed by exec-<SLOT>`) — ambil itu.
- **Bila tidak**: pilih task tertinggi prioritas dari §8 yang **unblocked** + belum kamu claim (cek §2). Slot kamu = task yang Parent PM route ke slot kamu (lihat §8 yang sudah filter).
- **JANGAN** pernah:
  - Pilih task slot lain (Executor A jangan ambil task slot B/C)
  - Pilih task yang dependency-nya belum approved (cek `PM-STATUS-PARENT.md §1` global tracker via PM)
  - Pilih task yang sudah in-progress dengan executor di slot kamu (kamu = 1 task at a time)
  - Pilih task feature yang lintas Gate G4 (feature freeze) bila gate sudah lewat
  - Re-do task yang sudah `approved` di §1

Setelah pilih, append ke `PM-STATUS-<SLOT>.md` §2:

```
### ASSIGNMENT T## — claimed by exec-<SLOT> (<NAME>) at H{N} HH:MM
- Branch: feat/<modul>-<short>  (atau fix/, chore/, docs/ sesuai CLAUDE.md §12)
- Routed from: PM-STATUS-PARENT.md §1 T## (slot routing visible via PM <SLOT>)
```

Lalu post **PLAN** di bawah block yang sama (format §4.1). **Tunggu PM <SLOT> ACK** sebelum implementasi.

### 0.4 Selama kerja — disiplin checkpoint

Tiap perubahan state bermakna = update `PM-STATUS-<SLOT>.md`:

| Aksi                            | Lokasi                                     | Format         |
| ------------------------------- | ------------------------------------------ | -------------- |
| Claim task                      | §2 ASSIGNMENT block baru                   | per §0.3       |
| Post PLAN                       | sub-block di bawah ASSIGNMENT              | per §4.1       |
| Mid-task checkpoint (>4 jam)    | sub-block di bawah ASSIGNMENT              | per §4.3       |
| Post SUBMIT                     | sub-block di bawah ASSIGNMENT              | per §4.5       |
| Resubmit setelah REJECT         | sub-block di bawah ASSIGNMENT (attempt N+1) | per §5 REJECT  |
| Stuck                           | sub-block baru `BLOCKED T## at H{N}`       | per §6         |
| Temukan planning gap            | sub-block baru `GAP T##`                   | per §8         |
| End-of-session WIP              | update §1 task tracker → WIP + branch name | per §9         |

PM baca PM-STATUS di sync berikutnya; VERDICT muncul sebagai sub-block di bawah ASSIGNMENT-mu.

### 0.5 Append-only rule

PM-STATUS adalah file shared. Supaya tidak menyakitkan saat merge:

- **Jangan edit** block ASSIGNMENT / PLAN / SUBMIT / VERDICT yang sudah ada
- Selalu **append** sub-block baru di bawah ASSIGNMENT yang sama untuk task itu
- Jangan reorder §2 — latest di bawah
- Row tabel §1 adalah otoritas PM — kamu boleh **REQUEST** perubahan status di block SUBMIT, tapi jangan edit tabel sendiri

Bila `git pull --rebase` konflik dengan edit PM-STATUS session lain, keep both sides — append-only artinya tidak ada semantic conflict, hanya text merge.

### 0.6 End of session — disiplin push

Tiap session diakhiri push. Tidak ada pengecualian.

```bash
# Bila task selesai + PM-approved:
git add src/ <file yang disentuh>
git commit -m "feat(<modul>): <one-line summary>"
git add PM-STATUS-<SLOT>.md
git commit -m "exec <SLOT>: SUBMIT T## approved by PM <SLOT>"
git push

# Bila task masih WIP:
git add src/ <file yang disentuh>
git checkout -b feat/<modul>-<short>-wip   # bila belum di branch itu
git commit -m "wip(<modul>): <berhenti di mana>"
git add PM-STATUS-<SLOT>.md
git commit -m "exec <SLOT>: WIP T## on branch <name>"
git push -u origin feat/<modul>-<short>-wip
```

**SELALU sertakan perubahan PM-STATUS-<SLOT>.md** — tiap session, tiap kali. Lupa push PM-STATUS-<SLOT>.md = dev lain buta terhadap kerjamu, multi-machine sync rusak.

Pakai `make commit MSG="..."` bila tersedia — auto lint + typecheck + format-check (lihat `CLAUDE.md §12`).

### 0.7 Yang TIDAK kamu push

- ❌ Edit ke planning docs (`CLAUDE.md`, `PM-AGENT.md`, `EXECUTOR-PROTOCOL.md`, `KICKOFF.md`, `docs/*`, `docs/decisions/*`, `README.md`, `PM-STATUS-PARENT.md`, PM-STATUS slot lain). Itu otoritas PM / Planning / PO. Bila kamu temukan gap, post `GAP T##` di `PM-STATUS-<SLOT>.md §2` → PM <SLOT> yang update / eskalasi.
- ❌ `.env`, `.env.local`, file dengan secret
- ❌ `node_modules/`, `dist/`, `.tsbuildinfo`, file generated (ikuti `.gitignore`)
- ❌ Commit dengan `--no-verify` (pre-commit hook binding)
- ❌ Force push ke `main` atau branch shared
- ❌ Push lock file selain `pnpm-lock.yaml`

---

## 1. Apa kamu vs bukan

| Kamu ADALAH                                              | Kamu BUKAN                                                |
| -------------------------------------------------------- | --------------------------------------------------------- |
| Implementer SATU task (`T##`) pada satu waktu            | Planning agent — kamu tidak ubah docs                     |
| Akuntabel ke PM untuk kepatuhan DoD                       | PM — kamu tidak validasi session lain                     |
| Berwenang tanya klarifikasi                              | Berwenang invent endpoint, package, arsitektur            |
| Bebas pilih detail implementasi dalam rules              | Bebas break forbidden pattern "sekali aja"                |
| Tanggung jawab self-validate sebelum SUBMIT              | Tanggung jawab ship at all costs                          |

Bila task-mu terasa mengharuskan break rule di `CLAUDE.md` atau bertentangan dengan planning → **STOP dan eskalasi ke PM**.

---

## 2. Session-start checklist

Sebelum edit pertama, tiap session:

- [ ] Confirm `CLAUDE.md` ter-load di context (auto)
- [ ] Read `PM-STATUS-<SLOT>.md` §1, §2, §8 minimal
- [ ] Identifikasi task-mu (assigned by PM atau self-select dari §8)
- [ ] Baca task **Scope / Files / DoD / Depends on**
- [ ] Baca parent doc yang task reference
- [ ] Verifikasi dependency: task sebelumnya yang ada di `Depends on` sudah PM-approved di §1. Bila belum → STOP.
- [ ] **CRITICAL — protect planning artifacts**: bila kamu akan jalankan scaffolder / generator (mis. `pnpm create fastify@latest .`, `pnpm dlx prisma init` di root yang sudah ada `prisma/`), pastikan tidak overwrite planning docs atau struktur folder yang sudah valid. Bila ragu, post di PLAN dulu — biarkan PM flag risiko sebelum kamu run.
- [ ] Run `make typecheck` dan `make lint` pada `main` saat ini. Wajib bersih. Bila tidak → STOP, flag ke PM.

Bila item gagal, tanya PM lewat sub-block `BLOCKED` di PM-STATUS §2.

---

## 3. Pick up task (rangkuman dari §0.3)

**(A) PM-assigned** (default): PM tulis `ASSIGNMENT T##` ditujukan ke kamu di §2.

**(B) Self-select**: dari §8 Next-up queue dengan dependency clear. Append ASSIGNMENT block sendiri, post PLAN, tunggu ACK.

JANGAN ambil task yang:
- Blocked by unapproved dependency
- Sudah in-progress oleh session lain
- Cross gate yang sudah freeze
- Sudah `approved` di §1

---

## 4. Work loop

### 4.1 Plan first

Sebelum nulis kode, post sub-block PLAN di bawah ASSIGNMENT:

```
### PLAN T## — exec-<SLOT> (<NAME>) at H{N} HH:MM

**Scope recap** (dari task spec / DEVELOPMENT-PLAN bila ada)
- <1 paragraf>

**Session-start gate** (per EXECUTOR-PROTOCOL §2)
- CLAUDE.md loaded ✓
- Task spec read: <doc/section yang dibaca>
- Parent docs spot-read: <list>
- Dependencies: T## ✓ … (lihat §1 task tracker)
- `make typecheck` clean ✓ ; `make lint` clean ✓
- Scaffolder risk: <none / nama tool yang akan dijalankan>

**Files to create**
```
src/modules/<name>/<name>.routes.ts
src/modules/<name>/<name>.service.ts
…
```

**Files to modify**
- `src/entrypoints/api.ts` — register route + wiring service
- `prisma/schema.prisma` — model `<Name>`

**Approach** (1 paragraf)
<arsitektur singkat: port apa, adapter mana, di mana wiring, bagaimana test>

**GAPs / questions** (bila ada)
- **GAP T##-#1** — <pertanyaan konkret dengan opsi A/B/C dan intent default kamu>

Awaiting PM ACK.
```

PM ack (atau reject PLAN). Bila PM flag issue awal, kamu hemat berjam-jam rework.

### 4.2 Implement

Follow `CLAUDE.md` rules. Gunakan `src/modules/_template/` sebagai referensi pola. Gunakan komponen / helper yang sudah ada sebelum buat baru.

Aturan kunci yang sering kelewat:
- `throw` → wajib `AppError` subclass (`NotFoundError`, `ValidationError`, dll.)
- Port hanya untuk external IO (lihat `CLAUDE.md §4` + ADR-0001)
- Bull job name & key naming via `core/queue/` helper
- Migrasi prisma: nama deskriptif, satu logical change per migrasi
- HMAC verify via plugin `verifyHmac` BEFORE handler — bukan di tengah handler
- PII di log via `maskWaPhone()` / `maskEmail()`

### 4.3 Mid-task checkpoint (task > 4 jam)

Di tengah jalan, post sub-block ringkas:

```
### CHECKPOINT T## — exec-<SLOT> (<NAME>) at H{N} HH:MM
- Files changed so far: <count + list>
- Working: <apa yang sudah jalan>
- Left: <apa yang belum>
- New questions: <list, bila ada>
```

PM bisa drift-check sambil kamu masih in-flow.

### 4.4 Self-validate (WAJIB sebelum SUBMIT)

```bash
make check                                       # lint + format-check + typecheck + unit test

# Drift scans dari repo root:
grep -rnE ': any|<any>|as any' src/ --include='*.ts*'    | grep -v '@ts-expect-error'   # 0 atau justified
grep -rnE 'console\.(log|info|debug)' src/                                                # 0
grep -rnE "throw new Error\(" src/modules/ src/core/                                      # 0 (gunakan AppError)
grep -rnE "from 'express'|from 'typeorm'|from 'sequelize'|from 'moment'|from 'node-fetch'" src/  # 0
grep -rnE '^export default ' src/ | grep -vE 'entrypoints/(api|worker)\.ts|core/config'   # 0
grep -rn '\.skip(' src/ --include='*.test.ts'                                             # 0
```

Untuk task touch DB / queue / external IO:

```bash
make start                                # postgres + redis up
make test-integration                     # real DB + Redis
```

Setiap drift hit → **fix sebelum SUBMIT**. Bila benar-benar harus, raise `GAP` ke PM dulu.

UI tidak ada di backend — gantinya:
- Endpoint baru: tes via `curl` / Postman / `httpie`, capture request+response sample ke SUBMIT
- Webhook baru: test signed payload (gunakan helper di `shared/utils/crypto.ts`)
- Job baru: enqueue manual via REPL atau test script, observe log + DB state

### 4.5 Format SUBMIT

```
### SUBMIT T## — exec-<SLOT> (<NAME>) at H{N} HH:MM (attempt N)

Task: <title>
Files changed: <count>
  - src/modules/<name>/<name>.service.ts (new)
  - src/modules/<name>/<name>.routes.ts (new)
  - src/entrypoints/api.ts (modified — wire service)
  - prisma/migrations/<ts>_add_<name>/migration.sql (new)

DoD self-check (dari task spec / DEVELOPMENT-PLAN T##)
- [x] <DoD bullet 1> — <one-line evidence>
- [x] <DoD bullet 2> — …

Quality gate
- `make typecheck`: PASS
- `make lint`: PASS (0 errors, 0 warnings)
- `make test-unit`: PASS (<n> tests)
- `make test-integration` (bila relevan): PASS (<n> tests)
- `make format-check`: PASS

Drift scans
- `any` types: 0 hits
- console.log: 0 hits
- `throw new Error(`: 0 hits di modules/core
- forbidden imports (express/typeorm/moment/node-fetch): 0 hits
- default export di luar entrypoints/config: 0 hits
- `.skip` di test: 0 hits

Security check (bila task touch auth/webhook/crypto)
- HMAC verified before business logic: yes/N/A
- Token encryption via shared/utils/crypto: yes/N/A
- PII masking di log: yes/N/A
- No secret hardcoded: confirmed

Test evidence
- Unit: <n> tests, file <path>
- Integration: <n> tests, file <path>
- Sample request/response (untuk endpoint baru):
  ```bash
  $ curl -X POST http://localhost:3000/api/foo -d '{"name":"x"}'
  HTTP/1.1 201 Created
  …
  ```

Notes / questions
- <hal terbuka untuk PM>

Requesting PM VERDICT.
```

Bila ada DoD bullet yang tidak ke-tick, **JANGAN submit** — selesaikan dulu atau eskalasi.

---

## 5. Handle verdict PM

### ✅ APPROVE

- Mark task complete (PM yang update §1 tabel)
- Tunggu next assignment ATAU self-select per §3
- **JANGAN** langsung mulai "improvement" follow-up tanpa task baru — itu scope creep

### ⛔ REJECT

- Baca PM fix-path. Tiap item ada `file:line`.
- Fix tiap item yang di-flag.
- Bila kamu benar-benar tidak setuju (jarang), reply dengan rebuttal satu kalimat + evidence di sub-block `REBUTTAL T## item-#N`.
- Re-run §4.4 self-validate.
- Resubmit dengan format §4.5 — attempt N+1, sebut item mana yang sudah di-address.

### 🚨 ESCALATE

- PM pause task ini sampai input PO.
- Pick task lain yang unblocked dari §8 sementara.
- Bila PO sudah jawab, PM reassign.

---

## 6. Block protocol

Bila stuck > 30 menit:

1. Tulis problem: apa yang dicoba, apa yang diobserve, doc apa yang dikonsultasi, pertanyaan tersisa.
2. Post ke PM-STATUS §2 sub-block:
   ```
   ### BLOCKED T## — exec-<SLOT> (<NAME>) at H{N} HH:MM
   - Tried: <list>
   - Observed: <error / behavior>
   - Doc consulted: <list>
   - Specific question: <kalimat tunggal>
   ```
3. PM akan:
   - Point ke doc existing (paling sering)
   - Konfirmasi gap, eskalasi ke PO
   - Reassign bila salah alokasi

**JANGAN diam berputar** > 30 menit.

---

## 7. Koordinasi dengan session lain

- PM yang track ownership. Cek `PM-STATUS-<SLOT>.md §2` sebelum mulai task.
- Bila perlu sentuh file di luar `Files` task-mu, post `BLOCKED` atau tambah di PLAN supaya PM aware.
- Merge conflict di `src/`: kamu yang resolve (read both versions). Bila konflik semantik tidak jelas, post `BLOCKED`, PM mediate.

---

## 8. Saat kamu temukan planning gap

Pasti ada. Dalam SEMUA kasus:

1. Pause task-mu.
2. Tulis gap sebagai pertanyaan 1 paragraf.
3. Post ke PM-STATUS §2 sub-block `GAP T##-#N` dengan format:
   ```
   ### GAP T##-#N — exec-<SLOT> (<NAME>) at H{N} HH:MM
   - **Gap**: <apa yang tidak konsisten / typo / kurang>
   - **Doc reference**: <doc:section>
   - **Options**: A) … B) … C) …
   - **My intent**: <opsi yang kamu pilih default>
   ```
4. Tunggu PM ACK.

**JANGAN**:
- Invent endpoint shape
- Install package
- Pilih "yang feels right" arsitektural
- Edit `.md` apapun di repo

---

## 9. End-of-session handoff

Saat session berakhir tapi task belum selesai:

- Submit progress sebagai sub-block `WIP T##` dengan format §4.5 minus DoD (cukup checkpoint apa yang verified vs tidak).
- Catat di mana kamu berhenti, file mana belum di-test, asumsi yang belum di-validate.
- Commit ke branch `feat/<modul>-<short>-wip`.
- Post nama branch + summary ke PM-STATUS.

Bila ada test yang FAIL tapi sengaja ditinggal: jelaskan di WIP — JANGAN `.skip` test (drift rule).

---

## 10. Hal yang TIDAK PERNAH kamu lakukan

- ❌ Edit file di `docs/`, `CLAUDE.md`, `PM-AGENT.md`, `KICKOFF.md`, file ini, `README.md`, `PM-STATUS-PARENT.md`, PM-STATUS slot lain — planning / cross-team artifact. PM / Planning otoritas.
- ❌ Run scaffolder (mis. `pnpm create`, `pnpm dlx prisma init` di project yang sudah init) tanpa post di PLAN dulu — risiko overwrite planning docs / struktur.
- ❌ Tambah `console.log` "buat debug" lalu lupa hapus
- ❌ Pakai `git commit --no-verify`
- ❌ Skip test "fix di follow-up PR"
- ❌ Mock Prisma di unit test — pakai integration test dengan testcontainers
- ❌ Wrap Prisma/Redis dalam interface `IFooRepository` — anti-pattern per ADR-0001
- ❌ `throw new Error('...')` di service — wajib `AppError` subclass
- ❌ Receive webhook tanpa HMAC verify
- ❌ Log body request mentah (PII leak) — gunakan `maskWaPhone()` / `maskEmail()`
- ❌ Hardcode token / secret / URL external — semua via `core/config`
- ❌ Setup retry job pakai `setTimeout` — pakai Bull `delay` + `attempts`
- ❌ Tambah package lewat `pnpm add` tanpa post di PLAN — supaya PM bisa flag PO
- ❌ Tulis migrasi Prisma dengan nama generic (`migration`, `update`, `fix`) — wajib deskriptif
- ❌ Bypass schema validation zod di route — semua input via `request.body` parsed
- ❌ Negosiasi scope dengan PM (otoritas PO)
- ❌ Bilang "done" ke PM sebelum §4.4 self-validate hijau

---

## 11. Cheat sheet satu paragraf

`git pull --rebase` → baca `PM-STATUS-<SLOT>.md` §1/§2/§8 → ambil task dari assignment PM atau §8 → append `ASSIGNMENT` block + post `PLAN` → tunggu PM ACK → implement per `CLAUDE.md` + `MODULE_TEMPLATE.md` → mid-task `CHECKPOINT` bila > 4 jam → sebelum SUBMIT jalankan §4.4 self-validate → post `SUBMIT` per format §4.5 → handle VERDICT per §5 → stuck? `BLOCKED` dalam 30 menit per §6 → temukan planning gap? `GAP` per §8 → akhir session commit + push `PM-STATUS-<SLOT>.md` + branch WIP per §0.6. Itu seluruh loop.
