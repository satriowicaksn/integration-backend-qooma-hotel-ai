/**
 * Repository call-shape unit tests. Prisma-mock stopgap per T10-a2 / T11 / T16
 * precedent; T12-INTEG follow-up parked awaiting Q-C-01 (`prisma-client.ts`
 * singleton).
 *
 * Repository has EXACTLY 3 methods per PM B ACK GAP T12-#5 D:
 * `persist`, `markProcessed`, `markFailed`. `findByPayloadMessageId` is
 * intentionally NOT part of the primitive (dedup at T12-followup after
 * Q-B-06 schema-add).
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PrismaClient, WebhookEvent } from '@prisma/client';

import { WhatsappWebhookEventsRepository } from '../whatsapp-webhook-events.repository.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const EVENT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const PROCESSED_AT = new Date('2026-07-05T16:30:00Z');

const sampleRow: WebhookEvent = {
  id: EVENT_ID,
  hotelId: HOTEL_ID,
  provider: 'whatsapp',
  receivedAt: new Date('2026-07-05T16:00:00Z'),
  signatureValid: true,
  payload: { object: 'whatsapp_business_account', entry: [] },
  processedAt: null,
  processError: null,
};

interface PrismaTestDouble {
  webhookEvent: {
    create: jest.Mock;
    update: jest.Mock;
  };
}

function createPrismaDouble(): { db: PrismaClient; double: PrismaTestDouble } {
  const double: PrismaTestDouble = {
    webhookEvent: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  return { db: double as unknown as PrismaClient, double };
}

describe('WhatsappWebhookEventsRepository.persist', () => {
  let db: PrismaClient;
  let double: PrismaTestDouble;
  let repo: WhatsappWebhookEventsRepository;

  beforeEach(() => {
    ({ db, double } = createPrismaDouble());
    repo = new WhatsappWebhookEventsRepository(db);
  });

  it('should call Prisma create with the persistence input translated to snake-free field names', async () => {
    double.webhookEvent.create.mockResolvedValue(sampleRow);
    const payload = { object: 'whatsapp_business_account', entry: [] };

    const result = await repo.persist({
      hotelId: HOTEL_ID,
      provider: 'whatsapp',
      signatureValid: true,
      payload,
    });

    expect(result).toBe(sampleRow);
    expect(double.webhookEvent.create).toHaveBeenCalledTimes(1);
    expect(double.webhookEvent.create).toHaveBeenCalledWith({
      data: {
        hotelId: HOTEL_ID,
        provider: 'whatsapp',
        signatureValid: true,
        payload,
      },
    });
  });

  it('should propagate the signatureValid=false flag verbatim (audit-trail path)', async () => {
    double.webhookEvent.create.mockResolvedValue({ ...sampleRow, signatureValid: false });
    const payload = { object: 'whatsapp_business_account', entry: [] };

    await repo.persist({ hotelId: HOTEL_ID, provider: 'whatsapp', signatureValid: false, payload });

    const arg = double.webhookEvent.create.mock.calls[0]?.[0] as {
      data: { signatureValid: boolean };
    };
    expect(arg.data.signatureValid).toBe(false);
  });
});

describe('WhatsappWebhookEventsRepository.markProcessed', () => {
  let db: PrismaClient;
  let double: PrismaTestDouble;
  let repo: WhatsappWebhookEventsRepository;

  beforeEach(() => {
    ({ db, double } = createPrismaDouble());
    repo = new WhatsappWebhookEventsRepository(db);
  });

  it('should call Prisma update keyed by eventId with processedAt set to the given Date', async () => {
    double.webhookEvent.update.mockResolvedValue({ ...sampleRow, processedAt: PROCESSED_AT });

    const result = await repo.markProcessed(EVENT_ID, PROCESSED_AT);

    expect(result.processedAt).toEqual(PROCESSED_AT);
    expect(double.webhookEvent.update).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      data: { processedAt: PROCESSED_AT },
    });
  });
});

describe('WhatsappWebhookEventsRepository.markFailed', () => {
  let db: PrismaClient;
  let double: PrismaTestDouble;
  let repo: WhatsappWebhookEventsRepository;

  beforeEach(() => {
    ({ db, double } = createPrismaDouble());
    repo = new WhatsappWebhookEventsRepository(db);
  });

  it('should call Prisma update keyed by eventId with processError set to the given JSON payload', async () => {
    const errorJson = { error: 'guest_upsert: 502 upstream' };
    double.webhookEvent.update.mockResolvedValue({ ...sampleRow, processError: errorJson });

    const result = await repo.markFailed(EVENT_ID, errorJson);

    expect(result.processError).toEqual(errorJson);
    expect(double.webhookEvent.update).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      data: { processError: errorJson },
    });
  });
});
