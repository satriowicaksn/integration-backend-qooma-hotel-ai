// Unit test pattern: mock port, inject ke service, assert behavior.
// TIDAK mock Prisma — repository pakai integration test.

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import type { ExampleExternalPort } from '../ports/example-external.port.js';

describe('ExampleService', () => {
  let externalPort: jest.Mocked<ExampleExternalPort>;

  beforeEach(() => {
    externalPort = {
      notify: jest.fn(async () => ({ acknowledged: true })),
    };
  });

  it.skip('should create example and notify external port (TODO implement)', async () => {
    // TODO(boilerplate):
    // const service = new ExampleService(repo, externalPort);
    // const result = await service.create({ name: 'test' });
    // expect(externalPort.notify).toHaveBeenCalledWith({ id: result.id });
    expect(externalPort).toBeDefined();
  });
});
