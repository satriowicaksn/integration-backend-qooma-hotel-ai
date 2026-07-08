import { describe, expect, it } from '@jest/globals';

import { DepartmentTelegramReadStubAdapter } from '../adapters/department-telegram-read-stub.adapter.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const OTHER_ID = '22222222-2222-3333-4444-555555555555';

describe('DepartmentTelegramReadStubAdapter.getForTenantCheck', () => {
  it('should return { hotelId } for a dept present in the env map', async () => {
    const adapter = new DepartmentTelegramReadStubAdapter(
      JSON.stringify({ 'dept-hk-01': HOTEL_ID }),
    );
    const result = await adapter.getForTenantCheck({ deptId: 'dept-hk-01' });
    expect(result).toEqual({ hotelId: HOTEL_ID });
  });

  it('should return null for a dept NOT present in the env map', async () => {
    const adapter = new DepartmentTelegramReadStubAdapter(
      JSON.stringify({ 'dept-hk-01': HOTEL_ID }),
    );
    const result = await adapter.getForTenantCheck({ deptId: 'unknown-dept' });
    expect(result).toBeNull();
  });

  it('should treat an empty env string as an empty map (every dept 404s)', async () => {
    const adapter = new DepartmentTelegramReadStubAdapter('');
    const result = await adapter.getForTenantCheck({ deptId: 'dept-hk-01' });
    expect(result).toBeNull();
  });

  it('should handle multiple depts across multiple hotels in the same map', async () => {
    const adapter = new DepartmentTelegramReadStubAdapter(
      JSON.stringify({ 'dept-a': HOTEL_ID, 'dept-b': OTHER_ID }),
    );
    expect(await adapter.getForTenantCheck({ deptId: 'dept-a' })).toEqual({ hotelId: HOTEL_ID });
    expect(await adapter.getForTenantCheck({ deptId: 'dept-b' })).toEqual({ hotelId: OTHER_ID });
  });

  it('should throw TypeError when the JSON is not an object (e.g. array)', () => {
    expect(() => new DepartmentTelegramReadStubAdapter('["array","not","object"]')).toThrow(
      TypeError,
    );
  });

  it('should throw TypeError when a value is not a non-empty string', () => {
    expect(() => new DepartmentTelegramReadStubAdapter(JSON.stringify({ dept: 42 }))).toThrow(
      TypeError,
    );
    expect(() => new DepartmentTelegramReadStubAdapter(JSON.stringify({ dept: '' }))).toThrow(
      TypeError,
    );
  });
});
