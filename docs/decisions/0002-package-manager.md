# ADR-0002: pnpm sebagai package manager

- **Status**: accepted
- **Tanggal**: 2026-06-11

## Konteks

Kita perlu pilih package manager untuk Node.js project. Pilihan: npm v10+, yarn v4 (berry), pnpm 9.

Faktor utama: AI-driven dev (80%) → AI sering generate kode dengan import package. Kalau package manager permisif (phantom deps allowed), AI bisa generate kode yang "kebetulan jalan" karena dependency tidak deklarasi tapi tersedia akibat hoisting → break setelah refactor.

## Opsi yang dipertimbangkan

### Opsi A: npm v10
- Pros: Default, no install needed, lockfile v3 sudah baik
- Cons: Phantom dependencies tidak dicegah, install lebih lambat dari pnpm/yarn

### Opsi B: yarn v4 (berry)
- Pros: Cepat, PnP zero-install (advanced), workspaces matang
- Cons: PnP sering konflik dengan tooling (Prisma sempat ada issue), `.yarn/` folder ribet, lebih banyak setup, ecosystem fragmen (v1 vs v2+)

### Opsi C: pnpm 9 (pilihan)
- Pros: Strict node_modules (anti-phantom-dep), 2x lebih cepat dari npm cold cache, disk-efficient (content-addressable store), workspaces native, modern lockfile yang readable
- Cons: Beberapa package legacy butuh `node-linker=hoisted` (rare), tutorial sering pakai npm/yarn command (translate mudah)

## Keputusan

**pnpm 9**.

Configured via `.npmrc`:
- `strict-peer-dependencies=true`
- `auto-install-peers=false`
- `shamefully-hoist=false`
- `node-linker=isolated`

Lock to specific version via `packageManager` field di `package.json` + `corepack`.

## Konsekuensi

### Positif
- AI tidak bisa import package yang tidak declare → fail fast di lokal sebelum production
- Install CI cepat (cache friendly)
- Disk hemat (relevan untuk Docker layer)

### Negatif (yang kami terima)
- Dockerfile butuh `corepack enable` (1 layer extra, trivial)
- Beberapa Stack Overflow answer pakai `npm install` — translate ke `pnpm add`
- Native module dengan peer dependency aneh (rare) → set rule di `pnpm.peerDependencyRules`

### Migrasi / rollout
- Dari hari 1
- Engine strict di `package.json` engines field

## Trigger untuk revisit

- Saat ada package critical yang tidak bisa install di pnpm strict mode (sangat jarang di 2026)
- Saat pnpm corp acquisition / EOL — pindah ke npm (yarn v4 tidak kami trust untuk longterm)
