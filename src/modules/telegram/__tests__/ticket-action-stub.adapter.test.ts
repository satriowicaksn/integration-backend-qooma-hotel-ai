import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import { TicketActionStubAdapter } from '../adapters/ticket-action-stub.adapter.js';

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

const INPUT = {
  hotelId: 'hotel-1',
  ticketId: 'ticket-42',
  staffId: 'staff-abc-987654',
};

describe('TicketActionStubAdapter', () => {
  it('should return { status: not_found } for take() and log hc_rpc_stubbed', async () => {
    const logger = buildLogger();
    const adapter = new TicketActionStubAdapter(logger);

    const result = await adapter.take(INPUT);

    expect(result).toEqual({ status: 'not_found' });
    const record = logger.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record['action']).toBe('take');
    expect(record['port']).toBe('ticket_action');
    expect(record['staffIdSuffix']).toBe('7654');
    expect(JSON.stringify(record)).not.toContain('staff-abc-987654');
  });

  it('should return { status: not_found } for release() and log the action verb', async () => {
    const logger = buildLogger();
    const adapter = new TicketActionStubAdapter(logger);

    const result = await adapter.release(INPUT);

    expect(result).toEqual({ status: 'not_found' });
    expect(logger.warn.mock.calls[0]?.[0]).toMatchObject({ action: 'release' });
  });

  it('should return { status: not_found } for markDone() and log the action verb', async () => {
    const logger = buildLogger();
    const adapter = new TicketActionStubAdapter(logger);

    const result = await adapter.markDone(INPUT);

    expect(result).toEqual({ status: 'not_found' });
    expect(logger.warn.mock.calls[0]?.[0]).toMatchObject({ action: 'markDone' });
  });
});
