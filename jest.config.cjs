/* eslint-env node */
/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/scripts'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.integration.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@core/(.*?)(?:\\.js)?$': '<rootDir>/src/core/$1',
    '^@modules/(.*?)(?:\\.js)?$': '<rootDir>/src/modules/$1',
    '^@plugins/(.*?)(?:\\.js)?$': '<rootDir>/src/plugins/$1',
    '^@shared/(.*?)(?:\\.js)?$': '<rootDir>/src/shared/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
    '!src/entrypoints/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },
  clearMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['<rootDir>/src/shared/utils/test-setup.ts'],
  testTimeout: 10000,
};

module.exports = config;
