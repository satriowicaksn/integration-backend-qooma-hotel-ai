/**
 * Repository call-shape unit tests — Prisma client mocked as a minimal
 * test-double per T10-a2 / T16 stopgap precedent. T11-INTEG follow-up is
 * parked awaiting Q-C-01 (`prisma-client.ts` singleton).
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PrismaClient, WaConfig } from '@prisma/client';

import { WhatsappWebhookVerifyRepository } from '../whatsapp-webhook-verify.repository.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const VERIFIED_AT = new Date('2026-07-05T14:30:00Z');

const sampleRow: WaConfig = {
  hotelId: HOTEL_ID,
  bsp: '1engage',
  phoneNumberId: '1234567890',
  phoneNumber: '+6281234567890',
  accessTokenEnc: 'v1:aa:bb:cc',
  webhookUrl: 'https://example.com/webhook',
  webhookVerifyToken: 'verify-token-abc',
  verifiedAt: VERIFIED_AT,
  createdAt: new Date('2026-07-04T00:00:00Z'),
  updatedAt: new Date('2026-07-05T14:30:00Z'),
};

interface PrismaTestDouble {
  waConfig: {
    update: jest.Mock;
  };
}

function createPrismaDouble(): { db: PrismaClient; double: PrismaTestDouble } {
  const double: PrismaTestDouble = {
    waConfig: {
      update: jest.fn(),
    },
  };
  return { db: double as unknown as PrismaClient, double };
}

describe('WhatsappWebhookVerifyRepository.markVerified', () => {
  let db: PrismaClient;
  let double: PrismaTestDouble;
  let repo: WhatsappWebhookVerifyRepository;

  beforeEach(() => {
    ({ db, double } = createPrismaDouble());
    repo = new WhatsappWebhookVerifyRepository(db);
  });

  it('should call Prisma update keyed by hotelId with the verifiedAt Date', async () => {
    double.waConfig.update.mockResolvedValue(sampleRow);

    const result = await repo.markVerified(HOTEL_ID, VERIFIED_AT);

    expect(result).toBe(sampleRow);
    expect(double.waConfig.update).toHaveBeenCalledTimes(1);
    expect(double.waConfig.update).toHaveBeenCalledWith({
      where: { hotelId: HOTEL_ID },
      data: { verifiedAt: VERIFIED_AT },
    });
  });

  it('should pass through the row returned by Prisma unchanged', async () => {
    double.waConfig.update.mockResolvedValue({ ...sampleRow, verifiedAt: VERIFIED_AT });

    const result = await repo.markVerified(HOTEL_ID, VERIFIED_AT);

    expect(result.verifiedAt).toEqual(VERIFIED_AT);
    expect(result.hotelId).toBe(HOTEL_ID);
  });

  it('should propagate a Prisma-side rejection unchanged', async () => {
    const prismaError = new Error('record not found');
    double.waConfig.update.mockRejectedValue(prismaError);

    await expect(repo.markVerified(HOTEL_ID, VERIFIED_AT)).rejects.toBe(prismaError);
  });
});
