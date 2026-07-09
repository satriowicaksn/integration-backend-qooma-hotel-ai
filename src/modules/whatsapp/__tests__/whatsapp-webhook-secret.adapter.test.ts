// Unit tests for T27 WhatsappWebhookSecretResolver.
// Mirrors T19-fu src/modules/telegram/__tests__/telegram-webhook-secret.adapter.test.ts
// verbatim so both providers' secret-resolver contracts stay aligned.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { WaConfig } from '@prisma/client';

import { resetConfigCache } from '@core/config/env.js';
import { NotFoundError } from '@core/errors/app-errors.js';

import { WhatsappWebhookSecretResolver } from '../adapters/whatsapp-webhook-secret.adapter.js';
import type { WhatsappConfigRepository } from '../whatsapp-config.repository.js';

const VALID_KEY = 'a'.repeat(64);
const BASE_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  API_BASE_URL: 'http://localhost:3000',
  CORS_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://app:app@localhost:5433/app?schema=public',
  REDIS_URL: 'redis://localhost:6380',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  JWT_REFRESH_SECRET: 'y'.repeat(32),
  ENCRYPTION_KEY: VALID_KEY,
  ENCRYPTION_KEY_VERSION: 'v1',
};

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const VERIFY_TOKEN = 'meta-verify-token-abc';

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

interface RepoMock {
  findByHotelId: jest.Mock<WhatsappConfigRepository['findByHotelId']>;
}

function buildRow(): WaConfig {
  return {
    hotelId: HOTEL_ID,
    bsp: '1engage',
    phoneNumberId: '1234567890',
    phoneNumber: '+6281234567890',
    accessTokenEnc: 'v1:aa:bb:cc',
    webhookUrl: 'https://example.com/webhook',
    webhookVerifyToken: VERIFY_TOKEN,
    verifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('WhatsappWebhookSecretResolver.resolveSecret', () => {
  it('should return the webhook_verify_token from the config repo at call time', async () => {
    const repo: RepoMock = {
      findByHotelId: jest
        .fn<WhatsappConfigRepository['findByHotelId']>()
        .mockResolvedValue(buildRow()),
    };
    const resolver = new WhatsappWebhookSecretResolver(repo as unknown as WhatsappConfigRepository);

    const secret = await resolver.resolveSecret({ hotelId: HOTEL_ID });

    expect(secret).toBe(VERIFY_TOKEN);
    expect(repo.findByHotelId).toHaveBeenCalledWith(HOTEL_ID);
  });

  it("should throw NotFoundError('wa_config', hotelId) when the hotel has no wa_config", async () => {
    const repo: RepoMock = {
      findByHotelId: jest.fn<WhatsappConfigRepository['findByHotelId']>().mockResolvedValue(null),
    };
    const resolver = new WhatsappWebhookSecretResolver(repo as unknown as WhatsappConfigRepository);

    await expect(resolver.resolveSecret({ hotelId: HOTEL_ID })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('should NEVER pass the resolved verify_token to any adapter-internal logger (binding #4 ctor-arity contract)', () => {
    // Contract test — the resolver has NO logger dependency by construction.
    // If a future refactor injects a logger, its signature must be verified
    // to never emit the resolved secret. Today the type surface enforces
    // this structurally: the ctor takes ONLY the repo.
    const ctorParamCount = WhatsappWebhookSecretResolver.length;
    expect(ctorParamCount).toBe(1);
  });
});
