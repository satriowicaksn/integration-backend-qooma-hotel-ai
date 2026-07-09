// Unit tests for T27 HC guest-upsert stub adapter.

import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import { HotelCoreGuestUpsertStubAdapter } from '../adapters/hc-guest-upsert.stub-adapter.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const WA_PHONE = '+6281234567890';

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

describe('HotelCoreGuestUpsertStubAdapter', () => {
  it('should return a uuid-shaped synthetic guestId when called for the first time', async () => {
    const logger = createLoggerSpy();
    const adapter = new HotelCoreGuestUpsertStubAdapter(logger);
    const result = await adapter.upsertGuestByWaPhone({ hotelId: HOTEL_ID, waPhone: WA_PHONE });
    expect(result.guestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('should return the SAME synthetic guestId when called twice with the same hotelId + waPhone (deterministic)', async () => {
    const adapter = new HotelCoreGuestUpsertStubAdapter(createLoggerSpy());
    const first = await adapter.upsertGuestByWaPhone({ hotelId: HOTEL_ID, waPhone: WA_PHONE });
    const second = await adapter.upsertGuestByWaPhone({ hotelId: HOTEL_ID, waPhone: WA_PHONE });
    expect(first.guestId).toBe(second.guestId);
  });

  it('should return a different guestId when the hotelId differs', async () => {
    const adapter = new HotelCoreGuestUpsertStubAdapter(createLoggerSpy());
    const a = await adapter.upsertGuestByWaPhone({ hotelId: HOTEL_ID, waPhone: WA_PHONE });
    const b = await adapter.upsertGuestByWaPhone({
      hotelId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      waPhone: WA_PHONE,
    });
    expect(a.guestId).not.toBe(b.guestId);
  });

  it('should NEVER include the raw waPhone in the log payload (PII floor)', async () => {
    const logger = createLoggerSpy();
    const adapter = new HotelCoreGuestUpsertStubAdapter(logger);
    await adapter.upsertGuestByWaPhone({ hotelId: HOTEL_ID, waPhone: WA_PHONE });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const payload = logger.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.stringify(payload)).not.toContain(WA_PHONE);
    expect(payload['msg']).toBe('hc_guest_upsert.stub_invoked');
    expect(payload['hcAdapters']).toBe('STUB');
    expect(payload['ratifyQs']).toBe('Q-B-04');
  });
});
