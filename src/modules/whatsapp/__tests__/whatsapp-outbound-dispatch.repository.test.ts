/**
 * Repository call-shape unit tests. Prisma-mock stopgap per T10/T11/T12/T15/T16
 * precedent (6× now); T13-INTEG follow-up parked awaiting Q-C-01 + T14.
 *
 * Repository has EXACTLY 4 methods per PM B ACK binding condition #4:
 * `findConfigForDispatch` (cross-table decrypt) + `persistPending` +
 * `markSent` + `markFailed`. Cross-table by design (reads `wa_configs`,
 * writes `outbound_dispatch_queue` — T15 precedent).
 *
 * `findConfigForDispatch` decrypts internally via `@shared/utils/crypto`;
 * tests use a real ephemeral 64-hex key so `decrypt(encrypt(x)) === x` is
 * verified end-to-end (Q-A-03 test-env pattern per T10/T15 cross-slot norm).
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { OutboundDispatch, PrismaClient, WaConfig } from '@prisma/client';

import { resetConfigCache } from '@core/config/env.js';

import { encrypt } from '@shared/utils/crypto.js';

import { WhatsappOutboundDispatchRepository } from '../whatsapp-outbound-dispatch.repository.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const GUEST_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const DISPATCH_ID = '00000000-0000-4000-8000-000000000001';
const PLAINTEXT_ACCESS_TOKEN = 'super-secret-access-token-1234567';
const EXTERNAL_ID = 'wamid.abc123';

const BASE_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  API_BASE_URL: 'http://localhost:3000',
  CORS_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://app:app@localhost:5433/app?schema=public',
  REDIS_URL: 'redis://localhost:6380',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  JWT_REFRESH_SECRET: 'y'.repeat(32),
  ENCRYPTION_KEY: 'a'.repeat(64),
  ENCRYPTION_KEY_VERSION: 'v1',
};

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, BASE_ENV);
  resetConfigCache();
});

afterEach(() => {
  process.env = savedEnv;
  resetConfigCache();
});

interface PrismaTestDouble {
  waConfig: { findUnique: jest.Mock };
  outboundDispatch: { create: jest.Mock; update: jest.Mock };
}

function createPrismaDouble(): { db: PrismaClient; double: PrismaTestDouble } {
  const double: PrismaTestDouble = {
    waConfig: { findUnique: jest.fn() },
    outboundDispatch: { create: jest.fn(), update: jest.fn() },
  };
  return { db: double as unknown as PrismaClient, double };
}

function buildWaConfigRow(): WaConfig {
  return {
    hotelId: HOTEL_ID,
    bsp: '1engage',
    phoneNumberId: 'phone-123',
    phoneNumber: '+6281234567890',
    accessTokenEnc: encrypt(PLAINTEXT_ACCESS_TOKEN),
    webhookUrl: 'https://example.com/webhook',
    webhookVerifyToken: 'verify-token',
    verifiedAt: null,
    createdAt: new Date('2026-07-04T00:00:00Z'),
    updatedAt: new Date('2026-07-04T00:00:00Z'),
  };
}

function buildDispatchRow(overrides: Partial<OutboundDispatch> = {}): OutboundDispatch {
  return {
    id: DISPATCH_ID,
    hotelId: HOTEL_ID,
    provider: 'whatsapp',
    guestId: GUEST_ID,
    templateName: null,
    body: 'Halo',
    variables: null,
    scheduledFor: new Date('2026-07-05T15:00:00Z'),
    attempts: 0,
    status: 'pending',
    sentAt: null,
    externalId: null,
    lastError: null,
    ...overrides,
  };
}

describe('WhatsappOutboundDispatchRepository.findConfigForDispatch', () => {
  it('should return null when no wa_configs row exists for the hotel', async () => {
    const { db, double } = createPrismaDouble();
    double.waConfig.findUnique.mockResolvedValue(null);
    const repo = new WhatsappOutboundDispatchRepository(db);

    const result = await repo.findConfigForDispatch(HOTEL_ID);

    expect(result).toBeNull();
    expect(double.waConfig.findUnique).toHaveBeenCalledWith({ where: { hotelId: HOTEL_ID } });
  });

  it('should decrypt the accessTokenEnc via crypto helper and return plaintext credentials', async () => {
    const { db, double } = createPrismaDouble();
    const row = buildWaConfigRow();
    double.waConfig.findUnique.mockResolvedValue(row);
    const repo = new WhatsappOutboundDispatchRepository(db);

    const result = await repo.findConfigForDispatch(HOTEL_ID);

    expect(result).toEqual({
      bsp: '1engage',
      phoneNumberId: 'phone-123',
      accessTokenPlaintext: PLAINTEXT_ACCESS_TOKEN,
    });
  });

  it('should read the wa_configs row using hotelId PK lookup (tenant guard via PK)', async () => {
    const { db, double } = createPrismaDouble();
    double.waConfig.findUnique.mockResolvedValue(buildWaConfigRow());
    const repo = new WhatsappOutboundDispatchRepository(db);

    await repo.findConfigForDispatch(HOTEL_ID);

    const call = double.waConfig.findUnique.mock.calls[0]?.[0] as { where: { hotelId: string } };
    expect(call.where.hotelId).toBe(HOTEL_ID);
  });
});

describe('WhatsappOutboundDispatchRepository.persistPending', () => {
  it('should call Prisma create with status=pending and body populated when the dispatch is a text send', async () => {
    const { db, double } = createPrismaDouble();
    const row = buildDispatchRow();
    double.outboundDispatch.create.mockResolvedValue(row);
    const repo = new WhatsappOutboundDispatchRepository(db);

    const result = await repo.persistPending({
      hotelId: HOTEL_ID,
      guestId: GUEST_ID,
      provider: 'whatsapp',
      body: 'Halo',
    });

    expect(result).toBe(row);
    expect(double.outboundDispatch.create).toHaveBeenCalledTimes(1);
    const arg = double.outboundDispatch.create.mock.calls[0]?.[0] as {
      data: {
        hotelId: string;
        guestId: string;
        provider: string;
        status: string;
        body: string | null;
        templateName: string | null;
      };
    };
    expect(arg.data.status).toBe('pending');
    expect(arg.data.body).toBe('Halo');
    expect(arg.data.templateName).toBeNull();
  });

  it('should call Prisma create with templateName + variables populated when the dispatch is a template send', async () => {
    const { db, double } = createPrismaDouble();
    double.outboundDispatch.create.mockResolvedValue(buildDispatchRow({ templateName: 'welcome' }));
    const repo = new WhatsappOutboundDispatchRepository(db);

    await repo.persistPending({
      hotelId: HOTEL_ID,
      guestId: GUEST_ID,
      provider: 'whatsapp',
      templateName: 'welcome',
      variables: ['Nanak'],
    });

    const arg = double.outboundDispatch.create.mock.calls[0]?.[0] as {
      data: { templateName: string | null; body: string | null; variables: unknown };
    };
    expect(arg.data.templateName).toBe('welcome');
    expect(arg.data.body).toBeNull();
    expect(arg.data.variables).toEqual(['Nanak']);
  });
});

describe('WhatsappOutboundDispatchRepository.markSent', () => {
  it('should call Prisma update with status=sent and populated externalId + sentAt', async () => {
    const { db, double } = createPrismaDouble();
    const sentAt = new Date('2026-07-05T16:00:00Z');
    double.outboundDispatch.update.mockResolvedValue(
      buildDispatchRow({ status: 'sent', externalId: EXTERNAL_ID, sentAt }),
    );
    const repo = new WhatsappOutboundDispatchRepository(db);

    await repo.markSent(DISPATCH_ID, EXTERNAL_ID, sentAt);

    expect(double.outboundDispatch.update).toHaveBeenCalledWith({
      where: { id: DISPATCH_ID },
      data: { status: 'sent', externalId: EXTERNAL_ID, sentAt },
    });
  });
});

describe('WhatsappOutboundDispatchRepository.markFailed', () => {
  it('should call Prisma update with status=failed and JSON lastError payload', async () => {
    const { db, double } = createPrismaDouble();
    const errorPayload = { message: 'Meta 500', status: 500 };
    double.outboundDispatch.update.mockResolvedValue(
      buildDispatchRow({ status: 'failed', lastError: errorPayload }),
    );
    const repo = new WhatsappOutboundDispatchRepository(db);

    await repo.markFailed(DISPATCH_ID, errorPayload);

    expect(double.outboundDispatch.update).toHaveBeenCalledWith({
      where: { id: DISPATCH_ID },
      data: { status: 'failed', lastError: errorPayload },
    });
  });
});
