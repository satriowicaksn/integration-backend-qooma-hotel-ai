# ADR-0003: TypeScript strict + ESLint type-aware + Prettier

- **Status**: accepted
- **Tanggal**: 2026-06-11

## Konteks

AI generate banyak kode. Kita perlu compile-time + lint-time guard yang mencegah common bug (any drift, floating promise, missing await, unused imports, type leak).

## Keputusan

### TypeScript config (`tsconfig.json`)
Semua strict flag aktif:
- `strict: true`
- `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`
- `noUnusedLocals`, `noUnusedParameters`
- `exactOptionalPropertyTypes` — bedakan `{x?: T}` vs `{x: T | undefined}`
- `noImplicitReturns`
- `noUncheckedIndexedAccess` — `arr[0]` → `T | undefined`
- `noImplicitOverride`
- `verbatimModuleSyntax` + `isolatedModules` — siap ESM, type-only import eksplisit

Module system: **ESM** (`"type": "module"`). Path alias: `@core/*`, `@modules/*`, `@plugins/*`, `@shared/*`.

### ESLint
Plugin yang aktif:
- `@typescript-eslint/recommended-requiring-type-checking` — rule yang butuh type info (lebih ketat)
- `import` + `import-resolver-typescript` — boundary enforcement
- `unused-imports` — auto-fix unused

Rule custom kunci:
- `@typescript-eslint/no-explicit-any: error` (no `any`)
- `@typescript-eslint/no-floating-promises: error` (wajib await/handle)
- `@typescript-eslint/no-misused-promises: error` (no async di non-async context)
- `@typescript-eslint/consistent-type-imports: error` (type-only import wajib)
- `import/no-default-export: error` (kecuali config & entrypoint)
- `import/no-cycle: error`
- `no-restricted-imports`: blokir import `adapters/*` antar modul (enforce hexagonal-disiplin)
- `no-console: error` (kecuali warn/error)

### Prettier
- `singleQuote: true`
- `semi: true`
- `trailingComma: 'all'`
- `printWidth: 100`
- `arrowParens: 'always'`

## Konsekuensi

### Positif
- Bug terdeteksi di IDE / pre-commit, bukan di production
- AI tidak bisa "hack around" type system tanpa `@ts-expect-error` (visible di review)
- Format konsisten — review fokus ke logika, bukan style

### Negatif
- Verbose: explicit return type, type-only import
- `noUncheckedIndexedAccess` butuh `arr[0]!` atau guard di banyak tempat. Kami terima karena value safety > brevity

### Migrasi / rollout
- Pre-commit hook (husky) jalankan `lint-staged` (ESLint + Prettier) → otomatis fix
- CI strict: warning = error (`--max-warnings 0`)
