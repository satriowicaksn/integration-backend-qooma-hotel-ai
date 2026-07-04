/**
 * Service unit tests.
 *
 * Uses REAL `encrypt`/`decrypt` from `@shared/utils/crypto.ts` with an
 * ephemeral 64-hex key set in `beforeEach` (mirrors `crypto.test.ts` shape).
 * Q-A-03 workaround for `NODE_ENV=test` — env is stamped in the same block
 * that seeds the encryption key, then reset in `afterEach`.
 *
 * The PII-floor test (Item #4 gate) + round-trip mask stability test (Item #2
 * gate) are the non-negotiable coverage per PM B binding conditions.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { resetConfigCache } from '@core/config/env.js';
import { NotFoundError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { decrypt, encrypt } from '@shared/utils/crypto.js';
import { maskTokenForLog } from '@shared/utils/masking.js';

import type { WhatsappConfigRepository } from '../whatsapp-config.repository.js';
import { WhatsappConfigService } from '../whatsapp-config.service.js';
import type {
  WhatsappConfigPersistenceInput,
  WhatsappConfigUpsertInput,
} from '../whatsapp-config.types.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

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

const PLAINTEXT_ACCESS_TOKEN = 'super-secret-access-token-1234567';
const PLAINTEXT_WEBHOOK_VERIFY_TOKEN = 'meta-webhook-verify-9876';
const PLAINTEXT_PHONE_NUMBER = '+6281234567890';

const validUpsertInput: WhatsappConfigUpsertInput = {
  bsp: '1engage',
  phoneNumberId: '1234567890',
  phoneNumber: PLAINTEXT_PHONE_NUMBER,
  accessToken: PLAINTEXT_ACCESS_TOKEN,
  webhookUrl: 'https://example.com/webhook',
  webhookVerifyToken: PLAINTEXT_WEBHOOK_VERIFY_TOKEN,
};

interface RepositoryDouble {
  findByHotelId: jest.Mock;
  upsert: jest.Mock;
}

function createRepositoryDouble(): { repo: WhatsappConfigRepository; double: RepositoryDouble } {
  const double: RepositoryDouble = {
    findByHotelId: jest.fn(),
    upsert: jest.fn(),
  };
  return { repo: double as unknown as WhatsappConfigRepository, double };
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

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, BASE_ENV);
  resetConfigCache();
});

afterEach(() => {
  process.env = savedEnv;
  resetConfigCache();
  jest.restoreAllMocks();
});

describe('WhatsappConfigService.getForHotel', () => {
  it('should throw NotFoundError when no config exists for the hotel', async () => {
    const { repo, double } = createRepositoryDouble();
    double.findByHotelId.mockResolvedValue(null);
    const service = new WhatsappConfigService(repo, createLoggerSpy());

    await expect(service.getForHotel(HOTEL_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('should return a domain projection with masked accessToken when a config exists', async () => {
    const { repo, double } = createRepositoryDouble();
    const encryptedToken = encrypt(PLAINTEXT_ACCESS_TOKEN);
    double.findByHotelId.mockResolvedValue({
      hotelId: HOTEL_ID,
      bsp: '1engage',
      phoneNumberId: '1234567890',
      phoneNumber: PLAINTEXT_PHONE_NUMBER,
      accessTokenEnc: encryptedToken,
      webhookUrl: 'https://example.com/webhook',
      webhookVerifyToken: PLAINTEXT_WEBHOOK_VERIFY_TOKEN,
      verifiedAt: null,
      createdAt: new Date('2026-07-04T00:00:00Z'),
      updatedAt: new Date('2026-07-04T00:00:00Z'),
    });

    const service = new WhatsappConfigService(repo, createLoggerSpy());
    const result = await service.getForHotel(HOTEL_ID);

    expect(result.hotelId).toBe(HOTEL_ID);
    expect(result.accessToken).toBe(maskTokenForLog(PLAINTEXT_ACCESS_TOKEN));
    expect(result.webhookVerifyToken).toBe(maskTokenForLog(PLAINTEXT_WEBHOOK_VERIFY_TOKEN));
    expect(result.phoneNumber).toBe(PLAINTEXT_PHONE_NUMBER);
    expect(result.bsp).toBe('1engage');
    expect(result.verifiedAt).toBeNull();
  });

  it('should never expose the plaintext accessToken in the returned domain', async () => {
    const { repo, double } = createRepositoryDouble();
    double.findByHotelId.mockResolvedValue({
      hotelId: HOTEL_ID,
      bsp: '1engage',
      phoneNumberId: '1234567890',
      phoneNumber: PLAINTEXT_PHONE_NUMBER,
      accessTokenEnc: encrypt(PLAINTEXT_ACCESS_TOKEN),
      webhookUrl: 'https://example.com/webhook',
      webhookVerifyToken: PLAINTEXT_WEBHOOK_VERIFY_TOKEN,
      verifiedAt: new Date('2026-07-05T00:00:00Z'),
      createdAt: new Date('2026-07-04T00:00:00Z'),
      updatedAt: new Date('2026-07-04T00:00:00Z'),
    });

    const service = new WhatsappConfigService(repo, createLoggerSpy());
    const result = await service.getForHotel(HOTEL_ID);

    expect(JSON.stringify(result)).not.toContain(PLAINTEXT_ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(PLAINTEXT_WEBHOOK_VERIFY_TOKEN);
    expect(result.verifiedAt).toBeInstanceOf(Date);
  });
});

describe('WhatsappConfigService.upsertForHotel', () => {
  it('should encrypt the plaintext accessToken before calling the repository', async () => {
    const { repo, double } = createRepositoryDouble();
    double.upsert.mockImplementation((hotelId: string, input: WhatsappConfigPersistenceInput) =>
      Promise.resolve({
        hotelId,
        bsp: input.bsp,
        phoneNumberId: input.phoneNumberId,
        phoneNumber: input.phoneNumber,
        accessTokenEnc: input.accessTokenEnc,
        webhookUrl: input.webhookUrl,
        webhookVerifyToken: input.webhookVerifyToken,
        verifiedAt: null,
        createdAt: new Date('2026-07-04T00:00:00Z'),
        updatedAt: new Date('2026-07-04T00:00:00Z'),
      }),
    );
    const service = new WhatsappConfigService(repo, createLoggerSpy());

    await service.upsertForHotel(HOTEL_ID, validUpsertInput);

    expect(double.upsert).toHaveBeenCalledTimes(1);
    const [passedHotelId, passedInput] = double.upsert.mock.calls[0] as [
      string,
      WhatsappConfigPersistenceInput,
    ];
    expect(passedHotelId).toBe(HOTEL_ID);
    expect(passedInput.accessTokenEnc).not.toBe(PLAINTEXT_ACCESS_TOKEN);
    expect(passedInput.accessTokenEnc.startsWith('v1:')).toBe(true);
    expect(decrypt(passedInput.accessTokenEnc)).toBe(PLAINTEXT_ACCESS_TOKEN);
    expect(passedInput.webhookVerifyToken).toBe(PLAINTEXT_WEBHOOK_VERIFY_TOKEN);
    expect(passedInput.phoneNumber).toBe(PLAINTEXT_PHONE_NUMBER);
  });

  it('should default bsp to 1engage when the input omits it', async () => {
    const { repo, double } = createRepositoryDouble();
    double.upsert.mockImplementation((hotelId: string, input: WhatsappConfigPersistenceInput) =>
      Promise.resolve({
        hotelId,
        bsp: input.bsp,
        phoneNumberId: input.phoneNumberId,
        phoneNumber: input.phoneNumber,
        accessTokenEnc: input.accessTokenEnc,
        webhookUrl: input.webhookUrl,
        webhookVerifyToken: input.webhookVerifyToken,
        verifiedAt: null,
        createdAt: new Date('2026-07-04T00:00:00Z'),
        updatedAt: new Date('2026-07-04T00:00:00Z'),
      }),
    );
    const service = new WhatsappConfigService(repo, createLoggerSpy());
    const { bsp: _bsp, ...withoutBsp } = validUpsertInput;

    const result = await service.upsertForHotel(HOTEL_ID, withoutBsp);

    expect(result.bsp).toBe('1engage');
    const [, passedInput] = double.upsert.mock.calls[0] as [string, WhatsappConfigPersistenceInput];
    expect(passedInput.bsp).toBe('1engage');
  });

  it('should return a masked domain projection after upsert', async () => {
    const { repo, double } = createRepositoryDouble();
    double.upsert.mockImplementation((hotelId: string, input: WhatsappConfigPersistenceInput) =>
      Promise.resolve({
        hotelId,
        bsp: input.bsp,
        phoneNumberId: input.phoneNumberId,
        phoneNumber: input.phoneNumber,
        accessTokenEnc: input.accessTokenEnc,
        webhookUrl: input.webhookUrl,
        webhookVerifyToken: input.webhookVerifyToken,
        verifiedAt: null,
        createdAt: new Date('2026-07-04T00:00:00Z'),
        updatedAt: new Date('2026-07-04T00:00:00Z'),
      }),
    );
    const service = new WhatsappConfigService(repo, createLoggerSpy());

    const result = await service.upsertForHotel(HOTEL_ID, validUpsertInput);

    expect(result.accessToken).toBe(maskTokenForLog(PLAINTEXT_ACCESS_TOKEN));
    expect(result.webhookVerifyToken).toBe(maskTokenForLog(PLAINTEXT_WEBHOOK_VERIFY_TOKEN));
    expect(JSON.stringify(result)).not.toContain(PLAINTEXT_ACCESS_TOKEN);
  });

  it('should NEVER include the plaintext accessToken, webhookVerifyToken, or raw phoneNumber in the log payload (PII floor)', async () => {
    const { repo, double } = createRepositoryDouble();
    double.upsert.mockImplementation((hotelId: string, input: WhatsappConfigPersistenceInput) =>
      Promise.resolve({
        hotelId,
        bsp: input.bsp,
        phoneNumberId: input.phoneNumberId,
        phoneNumber: input.phoneNumber,
        accessTokenEnc: input.accessTokenEnc,
        webhookUrl: input.webhookUrl,
        webhookVerifyToken: input.webhookVerifyToken,
        verifiedAt: null,
        createdAt: new Date('2026-07-04T00:00:00Z'),
        updatedAt: new Date('2026-07-04T00:00:00Z'),
      }),
    );
    const logger = createLoggerSpy();
    const service = new WhatsappConfigService(repo, logger);

    await service.upsertForHotel(HOTEL_ID, validUpsertInput);

    expect(logger.info).toHaveBeenCalled();
    const serialized = JSON.stringify(logger.info.mock.calls[0]?.[0]);
    expect(serialized).not.toContain(PLAINTEXT_ACCESS_TOKEN);
    expect(serialized).not.toContain(PLAINTEXT_WEBHOOK_VERIFY_TOKEN);
    expect(serialized).not.toContain(PLAINTEXT_PHONE_NUMBER);
  });

  it('should emit the PII-floor log line BEFORE calling repo.upsert', async () => {
    const { repo, double } = createRepositoryDouble();
    const events: string[] = [];
    const logger = createLoggerSpy();
    logger.info.mockImplementation(() => {
      events.push('log');
    });
    double.upsert.mockImplementation(() => {
      events.push('upsert');
      return Promise.resolve({
        hotelId: HOTEL_ID,
        bsp: '1engage',
        phoneNumberId: '1234567890',
        phoneNumber: PLAINTEXT_PHONE_NUMBER,
        accessTokenEnc: encrypt(PLAINTEXT_ACCESS_TOKEN),
        webhookUrl: 'https://example.com/webhook',
        webhookVerifyToken: PLAINTEXT_WEBHOOK_VERIFY_TOKEN,
        verifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
    const service = new WhatsappConfigService(repo, logger);

    await service.upsertForHotel(HOTEL_ID, validUpsertInput);

    expect(events).toEqual(['log', 'upsert']);
  });

  it('should produce a stable mask across two independent encrypt-decrypt cycles of the same plaintext (round-trip stability)', () => {
    const firstCiphertext = encrypt(PLAINTEXT_ACCESS_TOKEN);
    const secondCiphertext = encrypt(PLAINTEXT_ACCESS_TOKEN);
    expect(firstCiphertext).not.toBe(secondCiphertext);

    const firstMasked = maskTokenForLog(decrypt(firstCiphertext));
    const secondMasked = maskTokenForLog(decrypt(secondCiphertext));

    expect(firstMasked).toBe(secondMasked);
    expect(firstMasked).toBe(maskTokenForLog(PLAINTEXT_ACCESS_TOKEN));
  });
});
