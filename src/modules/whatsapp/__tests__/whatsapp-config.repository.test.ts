/**
 * Repository call-shape unit tests.
 *
 * Prisma client is mocked as a minimal test-double per GAP T10-#4 B — this is
 * the T17-a2 stopgap precedent. Real-DB integration tests are parked as
 * T10-INTEG follow-up, blocked on Q-C-01 (prisma singleton). No `.skip`.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PrismaClient, WaConfig } from '@prisma/client';

import { WhatsappConfigRepository } from '../whatsapp-config.repository.js';
import type { WhatsappConfigPersistenceInput } from '../whatsapp-config.types.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

const sampleRow: WaConfig = {
  hotelId: HOTEL_ID,
  bsp: '1engage',
  phoneNumberId: '1234567890',
  phoneNumber: '+6281234567890',
  accessTokenEnc: 'v1:aa:bb:cc',
  webhookUrl: 'https://example.com/webhook',
  webhookVerifyToken: 'verify-token-abc',
  verifiedAt: null,
  createdAt: new Date('2026-07-04T00:00:00Z'),
  updatedAt: new Date('2026-07-04T00:00:00Z'),
};

const sampleInput: WhatsappConfigPersistenceInput = {
  bsp: '1engage',
  phoneNumberId: '1234567890',
  phoneNumber: '+6281234567890',
  accessTokenEnc: 'v1:aa:bb:cc',
  webhookUrl: 'https://example.com/webhook',
  webhookVerifyToken: 'verify-token-abc',
};

interface PrismaTestDouble {
  waConfig: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    upsert: jest.Mock;
  };
}

function createPrismaDouble(): { db: PrismaClient; double: PrismaTestDouble } {
  const double: PrismaTestDouble = {
    waConfig: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
  };
  return { db: double as unknown as PrismaClient, double };
}

describe('WhatsappConfigRepository.findByHotelId', () => {
  let db: PrismaClient;
  let double: PrismaTestDouble;
  let repo: WhatsappConfigRepository;

  beforeEach(() => {
    ({ db, double } = createPrismaDouble());
    repo = new WhatsappConfigRepository(db);
  });

  it('should return the row when a config exists for the hotel', async () => {
    double.waConfig.findUnique.mockResolvedValue(sampleRow);
    const result = await repo.findByHotelId(HOTEL_ID);
    expect(result).toBe(sampleRow);
    expect(double.waConfig.findUnique).toHaveBeenCalledWith({ where: { hotelId: HOTEL_ID } });
  });

  it('should return null when no config exists for the hotel', async () => {
    double.waConfig.findUnique.mockResolvedValue(null);
    const result = await repo.findByHotelId(HOTEL_ID);
    expect(result).toBeNull();
  });
});

describe('WhatsappConfigRepository.existsByVerifyToken', () => {
  let db: PrismaClient;
  let double: PrismaTestDouble;
  let repo: WhatsappConfigRepository;

  beforeEach(() => {
    ({ db, double } = createPrismaDouble());
    repo = new WhatsappConfigRepository(db);
  });

  it('should return true when at least one config row matches the verify token', async () => {
    double.waConfig.findFirst.mockResolvedValue({ hotelId: HOTEL_ID });
    const result = await repo.existsByVerifyToken('verify-token-abc');
    expect(result).toBe(true);
    expect(double.waConfig.findFirst).toHaveBeenCalledWith({
      where: { webhookVerifyToken: 'verify-token-abc' },
      select: { hotelId: true },
    });
  });

  it('should return false when no config row matches the verify token', async () => {
    double.waConfig.findFirst.mockResolvedValue(null);
    const result = await repo.existsByVerifyToken('mismatch');
    expect(result).toBe(false);
  });

  it('should short-circuit to false without hitting the DB on an empty token', async () => {
    const result = await repo.existsByVerifyToken('');
    expect(result).toBe(false);
    expect(double.waConfig.findFirst).not.toHaveBeenCalled();
  });
});

describe('WhatsappConfigRepository.upsert', () => {
  let db: PrismaClient;
  let double: PrismaTestDouble;
  let repo: WhatsappConfigRepository;

  beforeEach(() => {
    ({ db, double } = createPrismaDouble());
    repo = new WhatsappConfigRepository(db);
  });

  it('should call Prisma upsert with matching create+update payloads keyed by hotelId', async () => {
    double.waConfig.upsert.mockResolvedValue(sampleRow);

    const result = await repo.upsert(HOTEL_ID, sampleInput);

    expect(result).toBe(sampleRow);
    expect(double.waConfig.upsert).toHaveBeenCalledTimes(1);
    const callArg = double.waConfig.upsert.mock.calls[0]?.[0] as {
      where: { hotelId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(callArg.where).toEqual({ hotelId: HOTEL_ID });
    expect(callArg.create).toEqual({ ...sampleInput, hotelId: HOTEL_ID, wabaId: null });
    expect(callArg.update).toEqual({ ...sampleInput });
  });
});
