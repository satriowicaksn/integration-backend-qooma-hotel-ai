import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import { HotelCorePendingVisitStubAdapter } from '../adapters/hotel-core-pending-visit-stub.adapter.js';
import type { CreatePendingVisitInput } from '../ports/hotel-core-pending-visit.port.js';

interface LoggerMock extends Logger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}

function buildLogger(): LoggerMock {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
}

const INPUT: CreatePendingVisitInput = {
  hotelId: 'hotel-1',
  guestName: 'John Doe',
  checkInDate: '2026-08-01',
  checkOutDate: '2026-08-03',
  roomNumber: '101',
  bookingSource: 'booking_com',
  externalRef: 'BC-12345',
};

describe('HotelCorePendingVisitStubAdapter', () => {
  it('should return { status: ok, visitId: stub-… } unconditionally', async () => {
    const adapter = new HotelCorePendingVisitStubAdapter(buildLogger());
    const result = await adapter.createPendingVisit(INPUT);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.visitId.startsWith('stub-')).toBe(true);
    }
  });

  it('should emit hc_rpc_stubbed warn with hotelId + bookingSource; guestName NEVER logged', async () => {
    const logger = buildLogger();
    const adapter = new HotelCorePendingVisitStubAdapter(logger);
    await adapter.createPendingVisit(INPUT);
    const record = logger.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record['msg']).toBe('ota_mailbox.hc_rpc_stubbed');
    expect(record['hotelId']).toBe('hotel-1');
    expect(record['bookingSource']).toBe('booking_com');
    expect(record['hasExternalRef']).toBe(true);
    // Guest PII must NEVER appear in log.
    expect(JSON.stringify(record)).not.toContain('John Doe');
    expect(JSON.stringify(record)).not.toContain('BC-12345');
  });
});
