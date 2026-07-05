/**
 * Repository call-shape unit tests. Prisma-mock stopgap per T10/T11/T12/T16
 * precedent (5× cross-primitive); T15-INTEG follow-up parked awaiting
 * Q-C-01 (`prisma-client.ts` singleton) + T13 (which populates
 * `outbound_dispatch_queue.external_id` for the correlation lookup).
 *
 * Repository has EXACTLY 2 methods per PM B ACK binding condition #4:
 * `findDispatchByExternalId` + `persist`. Cross-table by design.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DeliveryReceipt, OutboundDispatch, PrismaClient } from '@prisma/client';

import { WhatsappDeliveryReceiptsRepository } from '../whatsapp-delivery-receipts.repository.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const HOTEL_ID_OTHER = '99999999-8888-7777-6666-555555555555';
const EXTERNAL_ID = 'wamid.abc123';
const DISPATCH_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const RECEIPT_ID = 'ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb';

const sampleDispatch: OutboundDispatch = {
  id: DISPATCH_ID,
  hotelId: HOTEL_ID,
  provider: 'whatsapp',
  guestId: null,
  templateName: null,
  body: 'Hello',
  variables: null,
  scheduledFor: new Date('2026-07-05T15:00:00Z'),
  attempts: 1,
  status: 'sent',
  sentAt: new Date('2026-07-05T15:00:05Z'),
  externalId: EXTERNAL_ID,
  lastError: null,
};

const sampleReceipt: DeliveryReceipt = {
  id: RECEIPT_ID,
  hotelId: HOTEL_ID,
  dispatchId: DISPATCH_ID,
  externalId: EXTERNAL_ID,
  status: 'delivered',
  receivedAt: new Date('2026-07-05T15:01:00Z'),
};

interface PrismaTestDouble {
  outboundDispatch: {
    findFirst: jest.Mock;
  };
  deliveryReceipt: {
    create: jest.Mock;
  };
}

function createPrismaDouble(): { db: PrismaClient; double: PrismaTestDouble } {
  const double: PrismaTestDouble = {
    outboundDispatch: { findFirst: jest.fn() },
    deliveryReceipt: { create: jest.fn() },
  };
  return { db: double as unknown as PrismaClient, double };
}

describe('WhatsappDeliveryReceiptsRepository.findDispatchByExternalId', () => {
  let db: PrismaClient;
  let double: PrismaTestDouble;
  let repo: WhatsappDeliveryReceiptsRepository;

  beforeEach(() => {
    ({ db, double } = createPrismaDouble());
    repo = new WhatsappDeliveryReceiptsRepository(db);
  });

  it('should call Prisma findFirst with BOTH hotelId AND externalId in the where clause (tenant guard)', async () => {
    double.outboundDispatch.findFirst.mockResolvedValue(sampleDispatch);

    const result = await repo.findDispatchByExternalId(HOTEL_ID, EXTERNAL_ID);

    expect(result).toBe(sampleDispatch);
    expect(double.outboundDispatch.findFirst).toHaveBeenCalledTimes(1);
    expect(double.outboundDispatch.findFirst).toHaveBeenCalledWith({
      where: { hotelId: HOTEL_ID, externalId: EXTERNAL_ID },
    });
  });

  it('should return null when no dispatch row matches the (hotelId, externalId) filter', async () => {
    double.outboundDispatch.findFirst.mockResolvedValue(null);

    const result = await repo.findDispatchByExternalId(HOTEL_ID, EXTERNAL_ID);

    expect(result).toBeNull();
  });

  it('should NOT hijack a foreign hotel dispatch — filter includes hotelId (cross-tenant safety)', async () => {
    double.outboundDispatch.findFirst.mockResolvedValue(null);

    await repo.findDispatchByExternalId(HOTEL_ID_OTHER, EXTERNAL_ID);

    const call = double.outboundDispatch.findFirst.mock.calls[0]?.[0] as {
      where: { hotelId: string; externalId: string };
    };
    expect(call.where.hotelId).toBe(HOTEL_ID_OTHER);
    expect(call.where.externalId).toBe(EXTERNAL_ID);
  });
});

describe('WhatsappDeliveryReceiptsRepository.persist', () => {
  let db: PrismaClient;
  let double: PrismaTestDouble;
  let repo: WhatsappDeliveryReceiptsRepository;

  beforeEach(() => {
    ({ db, double } = createPrismaDouble());
    repo = new WhatsappDeliveryReceiptsRepository(db);
  });

  it('should call Prisma create with the persistence input mapped to the delivery_receipts data payload', async () => {
    double.deliveryReceipt.create.mockResolvedValue(sampleReceipt);

    const result = await repo.persist({
      hotelId: HOTEL_ID,
      dispatchId: DISPATCH_ID,
      externalId: EXTERNAL_ID,
      status: 'delivered',
    });

    expect(result).toBe(sampleReceipt);
    expect(double.deliveryReceipt.create).toHaveBeenCalledWith({
      data: {
        hotelId: HOTEL_ID,
        dispatchId: DISPATCH_ID,
        externalId: EXTERNAL_ID,
        status: 'delivered',
      },
    });
  });

  it('should propagate a Prisma-side rejection unchanged (caller decides recovery)', async () => {
    const prismaError = new Error('FK violation');
    double.deliveryReceipt.create.mockRejectedValue(prismaError);

    await expect(
      repo.persist({
        hotelId: HOTEL_ID,
        dispatchId: DISPATCH_ID,
        externalId: EXTERNAL_ID,
        status: 'delivered',
      }),
    ).rejects.toBe(prismaError);
  });
});
