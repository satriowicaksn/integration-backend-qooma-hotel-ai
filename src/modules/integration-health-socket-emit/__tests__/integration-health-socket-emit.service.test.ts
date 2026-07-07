import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import { IntegrationHealthChangedEventSchema } from '../integration-health-socket-emit.schema.js';
import {
  HEALTH_CHANGED_EVENT_NAME,
  HealthChangedPublisherService,
  toWirePayload,
} from '../integration-health-socket-emit.service.js';
import type { HealthChangedEventPayload } from '../integration-health-socket-emit.types.js';
import type { SocketPublisherPort, SocketPublishRequest } from '../ports/socket-publisher.port.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const CHECKED_AT = new Date('2026-07-07T11:30:00Z');

const BASE_EVENT: HealthChangedEventPayload = {
  hotelId: HOTEL_ID,
  provider: 'whatsapp',
  previousStatus: 'healthy',
  newStatus: 'degraded',
  checkedAt: CHECKED_AT,
};

interface PublisherMock {
  publish: jest.Mock<(input: SocketPublishRequest) => Promise<void>>;
}

interface LoggerMock extends Logger {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

function buildLogger(): LoggerMock {
  return { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function buildService(): {
  service: HealthChangedPublisherService;
  publisher: PublisherMock;
  logger: LoggerMock;
} {
  const publisher: PublisherMock = {
    publish: jest.fn<(input: SocketPublishRequest) => Promise<void>>(),
  };
  const logger = buildLogger();
  const service = new HealthChangedPublisherService(
    publisher as unknown as SocketPublisherPort,
    logger,
  );
  return { service, publisher, logger };
}

describe('HEALTH_CHANGED_EVENT_NAME (binding #7)', () => {
  it('should equal the spec §5 canonical event name literal', () => {
    expect(HEALTH_CHANGED_EVENT_NAME).toBe('integration:health_changed');
  });
});

describe('toWirePayload (binding #2 case conversion)', () => {
  it('should convert camelCase input fields to snake_case wire fields', () => {
    const wire = toWirePayload(BASE_EVENT);
    expect(wire).toEqual({
      hotel_id: HOTEL_ID,
      provider: 'whatsapp',
      previous_status: 'healthy',
      new_status: 'degraded',
      checked_at: CHECKED_AT.toISOString(),
    });
  });

  it('should produce a payload that parses cleanly through IntegrationHealthChangedEventSchema', () => {
    const wire = toWirePayload(BASE_EVENT);
    expect(() => IntegrationHealthChangedEventSchema.parse(wire)).not.toThrow();
  });

  it('should preserve null previousStatus as null previous_status (first-ever probe)', () => {
    const wire = toWirePayload({ ...BASE_EVENT, previousStatus: null });
    expect(wire.previous_status).toBeNull();
  });
});

describe('HealthChangedPublisherService.publishAll — happy paths', () => {
  it('should return zero counts and never call the port when given an empty batch', async () => {
    const { service, publisher } = buildService();

    const summary = await service.publishAll([]);

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(summary).toEqual({ published: 0, failures: 0, errorCodes: [] });
  });

  it('should publish a single event with the canonical event name + wire payload', async () => {
    const { service, publisher } = buildService();
    publisher.publish.mockResolvedValue(undefined);

    const summary = await service.publishAll([BASE_EVENT]);

    expect(publisher.publish).toHaveBeenCalledWith({
      event: HEALTH_CHANGED_EVENT_NAME,
      payload: toWirePayload(BASE_EVENT),
    });
    expect(summary).toEqual({ published: 1, failures: 0, errorCodes: [] });
  });

  it('should publish every event in a multi-event batch without filtering (binding #17)', async () => {
    const { service, publisher } = buildService();
    publisher.publish.mockResolvedValue(undefined);
    const events: HealthChangedEventPayload[] = [
      BASE_EVENT,
      { ...BASE_EVENT, provider: 'telegram', newStatus: 'down' },
      { ...BASE_EVENT, provider: 'claude_api', previousStatus: null, newStatus: 'healthy' },
    ];

    const summary = await service.publishAll(events);

    expect(publisher.publish).toHaveBeenCalledTimes(3);
    expect(summary.published).toBe(3);
    expect(summary.failures).toBe(0);
  });
});

describe('HealthChangedPublisherService.publishAll — per-event resilience (binding #5/#6)', () => {
  it('should log a structured warn and keep going when the publisher throws for one event', async () => {
    const { service, publisher, logger } = buildService();
    publisher.publish
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('socket down'))
      .mockResolvedValueOnce(undefined);
    const events: HealthChangedEventPayload[] = [
      BASE_EVENT,
      { ...BASE_EVENT, provider: 'telegram' },
      { ...BASE_EVENT, provider: 'claude_api' },
    ];

    const summary = await service.publishAll(events);

    expect(publisher.publish).toHaveBeenCalledTimes(3);
    expect(summary.published).toBe(2);
    expect(summary.failures).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'integration_health_socket_emit.publish_failed',
        module: 'integration-health-socket-emit',
        hotelId: HOTEL_ID,
        provider: 'telegram',
        newStatus: 'degraded',
      }),
    );
  });

  it('should never surface err.message or stack in the log (binding #6 defense-in-depth)', async () => {
    const { service, publisher, logger } = buildService();
    publisher.publish.mockRejectedValue(new Error('sensitive upstream detail'));

    await service.publishAll([BASE_EVENT]);

    const logged = logger.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.stringify(logged)).not.toContain('sensitive upstream detail');
  });

  it('should surface a named error class name as errCode in summary', async () => {
    class SocketDropped extends Error {
      override name = 'SocketDropped';
    }
    const { service, publisher } = buildService();
    publisher.publish.mockRejectedValue(new SocketDropped('conn reset'));

    const summary = await service.publishAll([BASE_EVENT]);

    expect(summary.errorCodes).toEqual(['SocketDropped']);
  });

  it('should NOT throw when every publish fails (aggregate resilience per binding #5)', async () => {
    const { service, publisher } = buildService();
    publisher.publish.mockRejectedValue(new Error('down'));
    const events: HealthChangedEventPayload[] = [
      BASE_EVENT,
      { ...BASE_EVENT, provider: 'telegram' },
    ];

    const summary = await service.publishAll(events);

    expect(summary).toEqual({
      published: 0,
      failures: 2,
      errorCodes: ['unknown', 'unknown'],
    });
  });
});
