import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import { SocketPublisherStubAdapter } from '../adapters/socket-publisher-stub.adapter.js';
import type { HealthChangedEventWirePayload } from '../integration-health-socket-emit.types.js';

interface LoggerMock extends Logger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}

function buildLogger(): LoggerMock {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
}

const PAYLOAD: HealthChangedEventWirePayload = {
  hotel_id: 'hotel-1',
  provider: 'whatsapp',
  previous_status: 'healthy',
  new_status: 'down',
  checked_at: '2026-07-09T00:00:00.000Z',
};

describe('SocketPublisherStubAdapter', () => {
  it('should resolve without throwing', async () => {
    const adapter = new SocketPublisherStubAdapter(buildLogger());
    await expect(
      adapter.publish({ event: 'integration:health_changed', payload: PAYLOAD }),
    ).resolves.toBeUndefined();
  });

  it('should emit publish_stubbed warn with event + hotel + provider + newStatus', async () => {
    const logger = buildLogger();
    const adapter = new SocketPublisherStubAdapter(logger);
    await adapter.publish({ event: 'integration:health_changed', payload: PAYLOAD });
    const record = logger.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record['msg']).toBe('integration_health_socket_emit.publish_stubbed');
    expect(record['event']).toBe('integration:health_changed');
    expect(record['hotelId']).toBe('hotel-1');
    expect(record['provider']).toBe('whatsapp');
    expect(record['newStatus']).toBe('down');
  });
});
