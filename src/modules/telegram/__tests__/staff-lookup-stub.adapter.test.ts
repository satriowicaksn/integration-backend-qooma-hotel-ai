import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import { StaffLookupStubAdapter } from '../adapters/staff-lookup-stub.adapter.js';

interface LoggerMock extends Logger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}

function buildLogger(): LoggerMock {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('StaffLookupStubAdapter.lookupByTelegramUserId', () => {
  it('should always return null (silent-ignore path pending Q-C-06)', async () => {
    const logger = buildLogger();
    const adapter = new StaffLookupStubAdapter(logger);

    const result = await adapter.lookupByTelegramUserId({
      hotelId: 'hotel-1',
      telegramUserId: '123456789',
    });

    expect(result).toBeNull();
  });

  it('should emit a hc_rpc_stubbed warn log with the last-4 suffix (never the full telegram_user_id)', async () => {
    const logger = buildLogger();
    const adapter = new StaffLookupStubAdapter(logger);

    await adapter.lookupByTelegramUserId({
      hotelId: 'hotel-1',
      telegramUserId: '123456789',
    });

    const record = logger.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record['msg']).toBe('telegram_inbound.hc_rpc_stubbed');
    expect(record['port']).toBe('staff_lookup');
    expect(record['telegramUserIdSuffix']).toBe('6789');
    expect(JSON.stringify(record)).not.toContain('123456789');
  });
});
