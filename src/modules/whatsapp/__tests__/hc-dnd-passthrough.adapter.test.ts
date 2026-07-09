// Unit tests for the FINAL MVP passthrough DND adapter (ADR-0009).
// Contract: always non-blocked, never throw, debug-log only, PII floor
// on the phone (masked).

import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import { HotelCoreDndPassthroughAdapter } from '../adapters/hc-dnd-passthrough.adapter.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const PHONE = '+6281234567890';

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

describe('HotelCoreDndPassthroughAdapter', () => {
  it('should always return { blocked: false, vvipExempt: false }', async () => {
    const logger = createLoggerSpy();
    const adapter = new HotelCoreDndPassthroughAdapter(logger);
    const result = await adapter.isDndForRecipient(HOTEL_ID, PHONE);
    expect(result).toEqual({ blocked: false, vvipExempt: false });
  });

  it('should NEVER include the full recipient phone in the debug log payload (PII floor)', async () => {
    const logger = createLoggerSpy();
    const adapter = new HotelCoreDndPassthroughAdapter(logger);
    await adapter.isDndForRecipient(HOTEL_ID, PHONE);
    expect(logger.debug).toHaveBeenCalledTimes(1);
    const payload = logger.debug.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.stringify(payload)).not.toContain(PHONE);
    expect(payload['msg']).toBe('wa_dnd.passthrough_invoked');
  });
});
