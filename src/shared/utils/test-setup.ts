/**
 * Jest global setup. Dirun sebelum semua test suite (`setupFilesAfterEach`).
 *
 * Untuk integration test: spin up testcontainers Postgres + Redis,
 * apply migrations, expose env var ke proses test.
 */

// TODO(qooma): implementasi setelah dependencies install.

// import { PostgreSqlContainer } from '@testcontainers/postgresql';
// import { GenericContainer } from 'testcontainers';
//
// beforeAll(async () => {
//   if (process.env.SKIP_TEST_CONTAINERS === '1') return;
//   ...
// });

export {}; // ESM marker
