// Unit tests for the FINAL MVP passthrough quota adapter (ADR-0009).
// Contract: always allow, never throw, debug-log only.

import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import { HotelCoreQuotaPassthroughAdapter } from '../adapters/hc-quota-passthrough.adapter.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

function createLoggerSpy(): Logger & {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
} {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('HotelCoreQuotaPassthroughAdapter', () => {
  it('should always return { reserved: true } with a deterministic reservationId on checkAndReserve', async () => {
    const logger = createLoggerSpy();
    const adapter = new HotelCoreQuotaPassthroughAdapter(logger);
    const result = await adapter.checkAndReserve(HOTEL_ID, 1);
    expect(result.reserved).toBe(true);
    if (result.reserved) {
      expect(result.reservationId).toContain(HOTEL_ID);
    }
  });

  it('should never throw on commit', async () => {
    const logger = createLoggerSpy();
    const adapter = new HotelCoreQuotaPassthroughAdapter(logger);
    await expect(adapter.commit('any-reservation')).resolves.toBeUndefined();
  });

  it('should never throw on rollback', async () => {
    const logger = createLoggerSpy();
    const adapter = new HotelCoreQuotaPassthroughAdapter(logger);
    await expect(adapter.rollback('any-reservation')).resolves.toBeUndefined();
  });

  it('should emit a debug log line on every operation (ops signal for ADR-0009 shape)', async () => {
    const logger = createLoggerSpy();
    const adapter = new HotelCoreQuotaPassthroughAdapter(logger);
    await adapter.checkAndReserve(HOTEL_ID, 3);
    await adapter.commit('rid');
    await adapter.rollback('rid');
    expect(logger.debug).toHaveBeenCalledTimes(3);
    for (const call of logger.debug.mock.calls) {
      const payload = call[0] as Record<string, unknown>;
      expect(payload['msg']).toBe('wa_quota.passthrough_invoked');
    }
  });
});
