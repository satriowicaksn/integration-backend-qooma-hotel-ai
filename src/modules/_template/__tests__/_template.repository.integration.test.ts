// Integration test pattern: real Postgres via testcontainers, no mock.
// Lihat docs/TESTING.md §5.

import { describe, it, expect } from '@jest/globals';

describe.skip('ExampleRepository (integration)', () => {
  // TODO(boilerplate): setup DB lewat helper testcontainers (src/shared/utils/test-setup.ts)
  // beforeEach: clean tabel
  // afterAll: dispose

  it('should persist and retrieve example', async () => {
    // const repo = new ExampleRepository(db);
    // const created = await repo.create({ name: 'test' });
    // const fetched = await repo.findById(created.id);
    // expect(fetched).toEqual(created);
    expect(true).toBe(true);
  });
});
