/**
 * ESLint config — lihat docs/decisions/0003-coding-standards.md untuk rationale.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.eslint.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module',
    ecmaVersion: 2022,
  },
  plugins: ['@typescript-eslint', 'import', 'unused-imports'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      typescript: { project: './tsconfig.json' },
    },
  },
  rules: {
    // === TypeScript ===
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
    '@typescript-eslint/no-unused-vars': 'off', // diganti oleh unused-imports
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-non-null-assertion': 'error',

    // === Import discipline ===
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
    ],
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          { pattern: '@core/**', group: 'internal', position: 'before' },
          { pattern: '@modules/**', group: 'internal' },
          { pattern: '@plugins/**', group: 'internal' },
          { pattern: '@shared/**', group: 'internal' },
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      },
    ],
    'import/no-default-export': 'error',
    'import/no-cycle': 'error',

    // === Boundary enforcement (lihat CLAUDE.md §6 Multi-Tenancy) ===
    // Kustom no-restricted-imports untuk enforce hexagonal-disiplin.
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/adapters/*'],
            message:
              'Service tidak boleh import adapters/ langsung. Gunakan port interface dari ports/ dan dependency injection.',
          },
          {
            group: ['../*/adapters/*', '../../*/adapters/*'],
            message: 'Modul lain tidak boleh import adapters internal modul lain.',
          },
        ],
      },
    ],

    // === Umum ===
    'no-console': ['error', { allow: ['warn', 'error'] }],
    eqeqeq: ['error', 'always'],
    'prefer-const': 'error',
    'no-var': 'error',
  },
  overrides: [
    {
      files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.integration.test.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        'no-restricted-imports': 'off',
      },
    },
    {
      files: ['scripts/**/*.ts', 'prisma/seeds/**/*.ts'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['src/entrypoints/*.ts', '*.config.ts', '*.config.js', '*.config.cjs'],
      rules: {
        'import/no-default-export': 'off',
        '@typescript-eslint/require-await': 'off',
      },
    },
    {
      // Stub files — async signatures kept for interface contracts, bodies are TODOs
      files: ['src/modules/_template/**/*.ts', 'src/core/http/http-client.ts'],
      rules: {
        '@typescript-eslint/require-await': 'off',
      },
    },
  ],
  ignorePatterns: ['dist', 'node_modules', 'coverage', '.tsbuildinfo', 'prisma/migrations'],
};
