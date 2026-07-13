// Unit tests for the T27 inbound-webhook composition helper.
// Mocks both T29 conversations service + T12 ingest service; verifies:
//  - per-message conversations.upsertOnInbound with correct fields
//  - PII floor (raw body never in the module's own log payloads)
//  - conversations upsert failure is logged + swallowed
//  - ingestService.processEvent errors bubble to caller

import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import type { WhatsappConversationsService } from '../whatsapp-conversations.service.js';
import type { WhatsappInboundIngestService } from '../whatsapp-inbound-ingest.service.js';
import { processInboundWebhook } from '../whatsapp-inbound.jobs.js';
import type { WhatsappOutboundDispatchService } from '../whatsapp-outbound-dispatch.service.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const EVENT_ID = 'dddddddd-eeee-ffff-0000-111111111111';
const SECRET_BODY = 'private guest message that must never appear in any log';

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

interface ConversationsDouble {
  upsertOnInbound: jest.Mock;
}
interface IngestDouble {
  processEvent: jest.Mock;
}
interface DispatchDouble {
  dispatchMessage: jest.Mock;
}

function buildDeps(overrides: {
  upsertOnInbound?: jest.Mock;
  processEvent?: jest.Mock;
  logger?: ReturnType<typeof createLoggerSpy>;
  dispatchDouble?: DispatchDouble;
}): {
  conversationsDouble: ConversationsDouble;
  ingestDouble: IngestDouble;
  dispatchDouble: DispatchDouble | undefined;
  logger: ReturnType<typeof createLoggerSpy>;
  deps: {
    conversationsService: WhatsappConversationsService;
    ingestService: WhatsappInboundIngestService;
    dispatchService?: WhatsappOutboundDispatchService | undefined;
    logger: Logger;
  };
} {
  const conversationsDouble: ConversationsDouble = {
    upsertOnInbound:
      overrides.upsertOnInbound ??
      jest.fn(() => Promise.resolve({ conversation: {}, message: {} })),
  };
  const ingestDouble: IngestDouble = {
    processEvent: overrides.processEvent ?? jest.fn(() => Promise.resolve([])),
  };
  const logger = overrides.logger ?? createLoggerSpy();
  return {
    conversationsDouble,
    ingestDouble,
    dispatchDouble: overrides.dispatchDouble,
    logger,
    deps: {
      conversationsService: conversationsDouble as unknown as WhatsappConversationsService,
      ingestService: ingestDouble as unknown as WhatsappInboundIngestService,
      dispatchService:
        overrides.dispatchDouble !== undefined
          ? (overrides.dispatchDouble as unknown as WhatsappOutboundDispatchService)
          : undefined,
      logger,
    },
  };
}

function envelope(
  messages: Array<{ from: string; body: string; id: string }>,
): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '+62999', phone_number_id: 'pnid' },
              messages: messages.map((m) => ({
                id: m.id,
                from: m.from,
                timestamp: '1720000000',
                type: 'text',
                text: { body: m.body },
              })),
            },
          },
        ],
      },
    ],
  };
}

describe('processInboundWebhook', () => {
  it('should call conversations.upsertOnInbound once per inbound message with the correct field mapping', async () => {
    const { conversationsDouble, ingestDouble, deps } = buildDeps({});
    const env = envelope([{ from: '+6281234567890', body: SECRET_BODY, id: 'wamid.1' }]);

    await processInboundWebhook(
      { eventId: EVENT_ID, hotelId: HOTEL_ID, waConfigId: HOTEL_ID, envelope: env as never },
      deps,
    );

    expect(conversationsDouble.upsertOnInbound).toHaveBeenCalledTimes(1);
    const arg = conversationsDouble.upsertOnInbound.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg['hotelId']).toBe(HOTEL_ID);
    expect(arg['waConfigId']).toBe(HOTEL_ID);
    expect(arg['guestWaPhone']).toBe('+6281234567890');
    expect(arg['body']).toBe(SECRET_BODY);
    expect(arg['externalMessageId']).toBe('wamid.1');
    expect(arg['webhookEventId']).toBe(EVENT_ID);
    expect(ingestDouble.processEvent).toHaveBeenCalledTimes(1);
  });

  it('should NEVER include the raw message body in any log payload emitted by the module (PII floor)', async () => {
    const logger = createLoggerSpy();
    const { deps } = buildDeps({ logger });
    const env = envelope([{ from: '+6281234567890', body: SECRET_BODY, id: 'wamid.1' }]);

    await processInboundWebhook(
      { eventId: EVENT_ID, hotelId: HOTEL_ID, waConfigId: HOTEL_ID, envelope: env as never },
      deps,
    );

    for (const method of ['info', 'warn', 'error', 'debug'] as const) {
      for (const call of logger[method].mock.calls) {
        expect(JSON.stringify(call[0])).not.toContain(SECRET_BODY);
      }
    }
  });

  it('should log an error but STILL call ingestService.processEvent when conversations.upsertOnInbound throws', async () => {
    const upsertOnInbound = jest.fn(() => Promise.reject(new Error('db exploded')));
    const processEvent = jest.fn(() => Promise.resolve([]));
    const logger = createLoggerSpy();
    const { conversationsDouble, ingestDouble, deps } = buildDeps({
      upsertOnInbound,
      processEvent,
      logger,
    });
    const env = envelope([{ from: '+6281234567890', body: 'hi', id: 'wamid.1' }]);

    await processInboundWebhook(
      { eventId: EVENT_ID, hotelId: HOTEL_ID, waConfigId: HOTEL_ID, envelope: env as never },
      deps,
    );

    expect(conversationsDouble.upsertOnInbound).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'whatsapp_inbound.conversations_upsert_failed' }),
    );
    expect(ingestDouble.processEvent).toHaveBeenCalled();
  });

  it('should bubble ingestService.processEvent rejections to the caller (worker retry surface)', async () => {
    const processEvent = jest.fn(() => Promise.reject(new Error('downstream boom')));
    const { deps } = buildDeps({ processEvent });
    const env = envelope([{ from: '+6281234567890', body: 'hi', id: 'wamid.1' }]);

    await expect(
      processInboundWebhook(
        { eventId: EVENT_ID, hotelId: HOTEL_ID, waConfigId: HOTEL_ID, envelope: env as never },
        deps,
      ),
    ).rejects.toThrow('downstream boom');
  });

  it('should still call ingestService.processEvent on an empty-messages envelope (delivery-status only)', async () => {
    const { ingestDouble, deps } = buildDeps({});
    const env = envelope([]);

    await processInboundWebhook(
      { eventId: EVENT_ID, hotelId: HOTEL_ID, waConfigId: HOTEL_ID, envelope: env as never },
      deps,
    );

    expect(ingestDouble.processEvent).toHaveBeenCalledTimes(1);
  });

  it('should call dispatchService.dispatchMessage for each dispatched outcome with aiReply', async () => {
    const dispatchDouble: DispatchDouble = {
      dispatchMessage: jest.fn(() =>
        Promise.resolve({ kind: 'dispatched', dispatchId: 'disp-1', externalId: 'ext-1' }),
      ),
    };
    const processEvent = jest.fn(() =>
      Promise.resolve([
        {
          messageId: 'wamid.1',
          guestId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          dispatched: true,
          aiReply: 'Hello from AI',
        },
      ]),
    );
    const { deps } = buildDeps({ processEvent, dispatchDouble });
    const env = envelope([{ from: '+6281234567890', body: 'hi', id: 'wamid.1' }]);

    await processInboundWebhook(
      { eventId: EVENT_ID, hotelId: HOTEL_ID, waConfigId: HOTEL_ID, envelope: env as never },
      deps,
    );

    expect(dispatchDouble.dispatchMessage).toHaveBeenCalledTimes(1);
    const arg = dispatchDouble.dispatchMessage.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg['hotelId']).toBe(HOTEL_ID);
    expect(arg['guestId']).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(arg['recipientPhone']).toBe('+6281234567890');
    expect(arg['body']).toBe('Hello from AI');
  });

  it('should NOT call dispatchService.dispatchMessage when dispatchService is not provided', async () => {
    const processEvent = jest.fn(() =>
      Promise.resolve([
        {
          messageId: 'wamid.1',
          guestId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          dispatched: true,
          aiReply: 'Hello from AI',
        },
      ]),
    );
    const { deps } = buildDeps({ processEvent });
    const env = envelope([{ from: '+6281234567890', body: 'hi', id: 'wamid.1' }]);

    await expect(
      processInboundWebhook(
        { eventId: EVENT_ID, hotelId: HOTEL_ID, waConfigId: HOTEL_ID, envelope: env as never },
        deps,
      ),
    ).resolves.toBeDefined();
  });

  it('should NOT call dispatchService.dispatchMessage for outcomes with dispatched: false', async () => {
    const dispatchDouble: DispatchDouble = {
      dispatchMessage: jest.fn(() =>
        Promise.resolve({ kind: 'dispatched', dispatchId: 'disp-1', externalId: 'ext-1' }),
      ),
    };
    const processEvent = jest.fn(() =>
      Promise.resolve([
        { messageId: 'wamid.1', dispatched: false, error: 'guest_upsert: timeout' },
      ]),
    );
    const { deps } = buildDeps({ processEvent, dispatchDouble });
    const env = envelope([{ from: '+6281234567890', body: 'hi', id: 'wamid.1' }]);

    await processInboundWebhook(
      { eventId: EVENT_ID, hotelId: HOTEL_ID, waConfigId: HOTEL_ID, envelope: env as never },
      deps,
    );

    expect(dispatchDouble.dispatchMessage).not.toHaveBeenCalled();
  });

  it('should log an error and NOT throw when dispatchService.dispatchMessage rejects', async () => {
    const dispatchDouble: DispatchDouble = {
      dispatchMessage: jest.fn(() => Promise.reject(new Error('BSP down'))),
    };
    const processEvent = jest.fn(() =>
      Promise.resolve([
        {
          messageId: 'wamid.1',
          guestId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          dispatched: true,
          aiReply: 'Hello from AI',
        },
      ]),
    );
    const logger = createLoggerSpy();
    const { deps } = buildDeps({ processEvent, dispatchDouble, logger });
    const env = envelope([{ from: '+6281234567890', body: 'hi', id: 'wamid.1' }]);

    await expect(
      processInboundWebhook(
        { eventId: EVENT_ID, hotelId: HOTEL_ID, waConfigId: HOTEL_ID, envelope: env as never },
        deps,
      ),
    ).resolves.toBeDefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'whatsapp_inbound.ai_reply_dispatch_failed' }),
    );
  });
});
