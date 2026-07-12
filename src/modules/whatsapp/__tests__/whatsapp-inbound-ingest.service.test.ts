/**
 * `WhatsappInboundIngestService` unit tests.
 *
 * All 3 boundaries mocked at class-shape level (events repo, HC guest port,
 * AI inbound port). No Prisma / no crypto / no env-key seeding needed at
 * this layer (T12 has no plaintext secrets in-flow — HMAC verify lives at
 * T04 plugin at router-layer wiring; primitive is signature-agnostic).
 */

import { describe, expect, it, jest } from '@jest/globals';

import { ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { maskWaPhone } from '@shared/utils/masking.js';

import type { AiInboundMessagePort } from '../ports/ai-inbound-message.port.js';
import type { HotelCoreGuestUpsertPort } from '../ports/hotel-core-guest-upsert.port.js';
import { WhatsappInboundIngestService } from '../whatsapp-inbound-ingest.service.js';
import type { WhatsappWebhookEventsRepository } from '../whatsapp-webhook-events.repository.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const EVENT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const WA_PHONE = '628123456789';
const WA_PHONE_ALT = '628999888777';

const validEnvelope = {
  object: 'whatsapp_business_account' as const,
  entry: [
    {
      id: 'entry-1',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp' as const,
            metadata: {
              display_phone_number: '15551234567',
              phone_number_id: 'phone-123',
            },
            contacts: [{ wa_id: WA_PHONE, profile: { name: 'Nanak' } }],
            messages: [
              {
                id: 'wamid.hello1',
                from: WA_PHONE,
                timestamp: '1728000000',
                type: 'text',
                text: { body: 'Halo' },
              },
            ],
          },
        },
      ],
    },
  ],
};

const receiptOnlyEnvelope = {
  object: 'whatsapp_business_account' as const,
  entry: [
    {
      id: 'entry-2',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp' as const,
            metadata: {
              display_phone_number: '15551234567',
              phone_number_id: 'phone-123',
            },
            statuses: [{ id: 'wamid.status1', status: 'delivered' }],
          },
        },
      ],
    },
  ],
};

const multiMessageEnvelope = {
  object: 'whatsapp_business_account' as const,
  entry: [
    {
      id: 'entry-1',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp' as const,
            metadata: {
              display_phone_number: '15551234567',
              phone_number_id: 'phone-123',
            },
            contacts: [{ wa_id: WA_PHONE, profile: { name: 'Nanak' } }, { wa_id: WA_PHONE_ALT }],
            messages: [
              {
                id: 'wamid.a',
                from: WA_PHONE,
                timestamp: '1728000000',
                type: 'text',
                text: { body: 'Halo' },
              },
              {
                id: 'wamid.b',
                from: WA_PHONE_ALT,
                timestamp: '1728000001',
                type: 'text',
                text: { body: 'Info kamar' },
              },
            ],
          },
        },
      ],
    },
  ],
};

interface RepoDouble {
  persist: jest.Mock;
  markProcessed: jest.Mock;
  markFailed: jest.Mock;
}
interface GuestPortDouble {
  upsertGuestByWaPhone: jest.Mock;
}
interface AiPortDouble {
  inboundWaMessage: jest.Mock;
}

function createRepoDouble(): { repo: WhatsappWebhookEventsRepository; double: RepoDouble } {
  const double: RepoDouble = {
    persist: jest.fn(),
    markProcessed: jest.fn(),
    markFailed: jest.fn(),
  };
  return { repo: double as unknown as WhatsappWebhookEventsRepository, double };
}
function createGuestPortDouble(): {
  port: HotelCoreGuestUpsertPort;
  double: GuestPortDouble;
} {
  const double: GuestPortDouble = { upsertGuestByWaPhone: jest.fn() };
  return { port: double as unknown as HotelCoreGuestUpsertPort, double };
}
function createAiPortDouble(): { port: AiInboundMessagePort; double: AiPortDouble } {
  const double: AiPortDouble = { inboundWaMessage: jest.fn() };
  return { port: double as unknown as AiInboundMessagePort, double };
}
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

describe('WhatsappInboundIngestService.ingestSync — persist-always with signatureValid flag', () => {
  it('should persist with signatureValid=true and return { eventId, isDuplicate: false }', async () => {
    const { repo, double: repoDouble } = createRepoDouble();
    const { port: guestPort } = createGuestPortDouble();
    const { port: aiPort } = createAiPortDouble();
    repoDouble.persist.mockResolvedValue({ id: EVENT_ID });
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, createLoggerSpy());

    const result = await service.ingestSync(HOTEL_ID, true, validEnvelope);

    expect(result).toEqual({ eventId: EVENT_ID, isDuplicate: false });
    expect(repoDouble.persist).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      provider: 'whatsapp',
      signatureValid: true,
      payload: expect.any(Object),
    });
  });

  it('should persist with signatureValid=false when the router flagged the request as spoofed (audit-trail path)', async () => {
    const { repo, double: repoDouble } = createRepoDouble();
    const { port: guestPort } = createGuestPortDouble();
    const { port: aiPort } = createAiPortDouble();
    repoDouble.persist.mockResolvedValue({ id: EVENT_ID });
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, createLoggerSpy());

    const result = await service.ingestSync(HOTEL_ID, false, validEnvelope);

    expect(result.isDuplicate).toBe(false);
    const arg = repoDouble.persist.mock.calls[0]?.[0] as { signatureValid: boolean };
    expect(arg.signatureValid).toBe(false);
  });

  it('should throw ValidationError when the envelope fails schema parse', async () => {
    const { repo } = createRepoDouble();
    const { port: guestPort } = createGuestPortDouble();
    const { port: aiPort } = createAiPortDouble();
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, createLoggerSpy());

    await expect(service.ingestSync(HOTEL_ID, true, { object: 'other' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('should return isDuplicate=false always (Q-B-06 D placeholder)', async () => {
    const { repo, double: repoDouble } = createRepoDouble();
    const { port: guestPort } = createGuestPortDouble();
    const { port: aiPort } = createAiPortDouble();
    repoDouble.persist.mockResolvedValueOnce({ id: EVENT_ID });
    repoDouble.persist.mockResolvedValueOnce({ id: EVENT_ID });
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, createLoggerSpy());

    const first = await service.ingestSync(HOTEL_ID, true, validEnvelope);
    const second = await service.ingestSync(HOTEL_ID, true, validEnvelope);

    expect(first.isDuplicate).toBe(false);
    expect(second.isDuplicate).toBe(false);
  });
});

describe('WhatsappInboundIngestService.processEvent — worker discipline (never throws)', () => {
  it('should resolve guest via HC port, dispatch to AI port, and markProcessed when all downstream calls succeed', async () => {
    const { repo, double: repoDouble } = createRepoDouble();
    const { port: guestPort, double: guestDouble } = createGuestPortDouble();
    const { port: aiPort, double: aiDouble } = createAiPortDouble();
    guestDouble.upsertGuestByWaPhone.mockResolvedValue({ guestId: 'guest-1' });
    aiDouble.inboundWaMessage.mockResolvedValue({
      conversationId: 'conv-1',
      reply: 'Breakfast ends at 10:30.',
      stopReason: 'end_turn',
    });
    repoDouble.markProcessed.mockResolvedValue({});
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, createLoggerSpy());

    const outcomes = await service.processEvent(EVENT_ID, HOTEL_ID, validEnvelope);

    expect(outcomes).toMatchObject([
      { messageId: 'wamid.hello1', guestId: 'guest-1', dispatched: true, aiReply: 'Breakfast ends at 10:30.' },
    ]);
    expect(repoDouble.markProcessed).toHaveBeenCalledTimes(1);
    expect(repoDouble.markFailed).not.toHaveBeenCalled();
    const guestArg = guestDouble.upsertGuestByWaPhone.mock.calls[0]?.[0] as {
      hotelId: string;
      waPhone: string;
      name?: string;
    };
    expect(guestArg).toEqual({ hotelId: HOTEL_ID, waPhone: WA_PHONE, name: 'Nanak' });
    const aiArg = aiDouble.inboundWaMessage.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(aiArg).toMatchObject({
      hotelId: HOTEL_ID,
      agentSlug: 'reception',
      sourceId: 'wamid.hello1',
      messages: [{ role: 'user', content: 'Halo' }],
      context: { guestId: 'guest-1', channel: 'whatsapp', locale: 'id' },
    });
  });

  it('should mark the event processed with an empty outcome array when the envelope carries only delivery-receipt statuses (T15 branch)', async () => {
    const { repo, double: repoDouble } = createRepoDouble();
    const { port: guestPort, double: guestDouble } = createGuestPortDouble();
    const { port: aiPort, double: aiDouble } = createAiPortDouble();
    repoDouble.markProcessed.mockResolvedValue(undefined);
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, createLoggerSpy());

    const outcomes = await service.processEvent(EVENT_ID, HOTEL_ID, receiptOnlyEnvelope);

    expect(outcomes).toEqual([]);
    expect(guestDouble.upsertGuestByWaPhone).not.toHaveBeenCalled();
    expect(aiDouble.inboundWaMessage).not.toHaveBeenCalled();
    expect(repoDouble.markProcessed).toHaveBeenCalledTimes(1);
  });

  it('should record a per-message error + call markFailed when the HC guest-upsert port rejects', async () => {
    const { repo, double: repoDouble } = createRepoDouble();
    const { port: guestPort, double: guestDouble } = createGuestPortDouble();
    const { port: aiPort, double: aiDouble } = createAiPortDouble();
    guestDouble.upsertGuestByWaPhone.mockRejectedValue(new Error('HC 502'));
    repoDouble.markFailed.mockResolvedValue({});
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, createLoggerSpy());

    const outcomes = await service.processEvent(EVENT_ID, HOTEL_ID, validEnvelope);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.dispatched).toBe(false);
    expect(outcomes[0]?.error).toContain('guest_upsert');
    expect(outcomes[0]?.guestId).toBeUndefined();
    expect(aiDouble.inboundWaMessage).not.toHaveBeenCalled();
    expect(repoDouble.markFailed).toHaveBeenCalledTimes(1);
    expect(repoDouble.markProcessed).not.toHaveBeenCalled();
  });

  it('should record a per-message error including guestId + call markFailed when the AI port rejects after the guest is resolved', async () => {
    const { repo, double: repoDouble } = createRepoDouble();
    const { port: guestPort, double: guestDouble } = createGuestPortDouble();
    const { port: aiPort, double: aiDouble } = createAiPortDouble();
    guestDouble.upsertGuestByWaPhone.mockResolvedValue({ guestId: 'guest-1' });
    aiDouble.inboundWaMessage.mockRejectedValue(new Error('AI 503'));
    repoDouble.markFailed.mockResolvedValue({});
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, createLoggerSpy());

    const outcomes = await service.processEvent(EVENT_ID, HOTEL_ID, validEnvelope);

    expect(outcomes[0]?.dispatched).toBe(false);
    expect(outcomes[0]?.error).toContain('ai_inbound');
    expect(outcomes[0]?.guestId).toBe('guest-1');
    expect(repoDouble.markFailed).toHaveBeenCalledTimes(1);
  });

  it('should NEVER throw when the HC port rejects (worker discipline)', async () => {
    const { repo, double: repoDouble } = createRepoDouble();
    const { port: guestPort, double: guestDouble } = createGuestPortDouble();
    const { port: aiPort } = createAiPortDouble();
    guestDouble.upsertGuestByWaPhone.mockRejectedValue(new Error('HC 502'));
    repoDouble.markFailed.mockResolvedValue({});
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, createLoggerSpy());

    await expect(service.processEvent(EVENT_ID, HOTEL_ID, validEnvelope)).resolves.toBeInstanceOf(
      Array,
    );
  });

  it('should NEVER throw when a non-Error value is thrown (worker discipline)', async () => {
    const { repo, double: repoDouble } = createRepoDouble();
    const { port: guestPort, double: guestDouble } = createGuestPortDouble();
    const { port: aiPort } = createAiPortDouble();
    guestDouble.upsertGuestByWaPhone.mockRejectedValue('boom');
    repoDouble.markFailed.mockResolvedValue({});
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, createLoggerSpy());

    await expect(service.processEvent(EVENT_ID, HOTEL_ID, validEnvelope)).resolves.toBeInstanceOf(
      Array,
    );
    const outcomes = await service.processEvent(EVENT_ID, HOTEL_ID, validEnvelope);
    expect(outcomes[0]?.error).toContain('guest_upsert: boom');
  });

  it('should NOT throw when markProcessed itself fails (log + swallow — worker discipline)', async () => {
    const { repo, double: repoDouble } = createRepoDouble();
    const { port: guestPort, double: guestDouble } = createGuestPortDouble();
    const { port: aiPort, double: aiDouble } = createAiPortDouble();
    guestDouble.upsertGuestByWaPhone.mockResolvedValue({ guestId: 'guest-1' });
    aiDouble.inboundWaMessage.mockResolvedValue({
      conversationId: 'conv-1',
      reply: 'ok',
      stopReason: 'end_turn',
    });
    repoDouble.markProcessed.mockRejectedValue(new Error('DB down'));
    const logger = createLoggerSpy();
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, logger);

    await expect(service.processEvent(EVENT_ID, HOTEL_ID, validEnvelope)).resolves.toBeInstanceOf(
      Array,
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('should NOT throw when markFailed itself fails (log + swallow — worker discipline)', async () => {
    const { repo, double: repoDouble } = createRepoDouble();
    const { port: guestPort, double: guestDouble } = createGuestPortDouble();
    const { port: aiPort } = createAiPortDouble();
    guestDouble.upsertGuestByWaPhone.mockRejectedValue(new Error('HC 502'));
    repoDouble.markFailed.mockRejectedValue(new Error('DB down'));
    const logger = createLoggerSpy();
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, logger);

    await expect(service.processEvent(EVENT_ID, HOTEL_ID, validEnvelope)).resolves.toBeInstanceOf(
      Array,
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle a multi-message envelope with mixed success/failure and record per-message outcomes', async () => {
    const { repo, double: repoDouble } = createRepoDouble();
    const { port: guestPort, double: guestDouble } = createGuestPortDouble();
    const { port: aiPort, double: aiDouble } = createAiPortDouble();
    guestDouble.upsertGuestByWaPhone
      .mockResolvedValueOnce({ guestId: 'guest-1' })
      .mockRejectedValueOnce(new Error('HC 502'));
    aiDouble.inboundWaMessage.mockResolvedValue({
      conversationId: 'conv-1',
      reply: 'ok',
      stopReason: 'end_turn',
    });
    repoDouble.markFailed.mockResolvedValue({});
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, createLoggerSpy());

    const outcomes = await service.processEvent(EVENT_ID, HOTEL_ID, multiMessageEnvelope);

    expect(outcomes).toHaveLength(2);
    expect(outcomes[0]?.dispatched).toBe(true);
    expect(outcomes[1]?.dispatched).toBe(false);
    expect(repoDouble.markFailed).toHaveBeenCalledTimes(1);
    expect(repoDouble.markProcessed).not.toHaveBeenCalled();
  });

  it('should omit the name field on the HC guest-upsert call when no profile.name was in contacts', async () => {
    const { repo, double: repoDouble } = createRepoDouble();
    const { port: guestPort, double: guestDouble } = createGuestPortDouble();
    const { port: aiPort, double: aiDouble } = createAiPortDouble();
    guestDouble.upsertGuestByWaPhone.mockResolvedValue({ guestId: 'guest-2' });
    aiDouble.inboundWaMessage.mockResolvedValue({
      conversationId: 'conv-2',
      reply: 'ok',
      stopReason: 'end_turn',
    });
    repoDouble.markProcessed.mockResolvedValue({});
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, createLoggerSpy());

    const envelopeNoName = {
      ...validEnvelope,
      entry: [
        {
          ...(validEnvelope.entry[0] as { id: string }),
          id: 'entry-1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp' as const,
                metadata: {
                  display_phone_number: '15551234567',
                  phone_number_id: 'phone-123',
                },
                contacts: [{ wa_id: WA_PHONE }],
                messages: [
                  {
                    id: 'wamid.noName',
                    from: WA_PHONE,
                    timestamp: '1728000000',
                    type: 'text',
                    text: { body: 'Halo' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    await service.processEvent(EVENT_ID, HOTEL_ID, envelopeNoName);

    const guestArg = guestDouble.upsertGuestByWaPhone.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(guestArg)).not.toContain('name');
    expect(guestArg).toEqual({ hotelId: HOTEL_ID, waPhone: WA_PHONE });
  });
});

describe('WhatsappInboundIngestService — PII floor (maskWaPhone)', () => {
  it('should mask the waPhone in the per-message log line and NOT leak the plaintext phone', async () => {
    const { repo, double: repoDouble } = createRepoDouble();
    const { port: guestPort, double: guestDouble } = createGuestPortDouble();
    const { port: aiPort, double: aiDouble } = createAiPortDouble();
    guestDouble.upsertGuestByWaPhone.mockResolvedValue({ guestId: 'guest-1' });
    aiDouble.inboundWaMessage.mockResolvedValue({
      conversationId: 'conv-1',
      reply: 'ok',
      stopReason: 'end_turn',
    });
    repoDouble.markProcessed.mockResolvedValue({});
    const logger = createLoggerSpy();
    const service = new WhatsappInboundIngestService(repo, guestPort, aiPort, logger);

    await service.processEvent(EVENT_ID, HOTEL_ID, validEnvelope);

    const perMessageLog = logger.info.mock.calls.find((call) => {
      const entry = call[0] as { msg?: string };
      return entry?.msg === 'whatsapp_inbound_ingest.message';
    });
    expect(perMessageLog).toBeDefined();
    const logged = perMessageLog?.[0] as Record<string, unknown>;
    expect(logged.waPhone).toBe(maskWaPhone(WA_PHONE));
    const serialized = JSON.stringify(logged);
    expect(serialized).not.toContain(WA_PHONE);
    expect(JSON.stringify(logged).length).toBeLessThan(500);
  });
});
