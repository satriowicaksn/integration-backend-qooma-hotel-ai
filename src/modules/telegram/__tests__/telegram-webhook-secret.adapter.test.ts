import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { resetConfigCache } from '@core/config/env.js';
import { NotFoundError } from '@core/errors/app-errors.js';

import { encrypt } from '@shared/utils/crypto.js';

import { TelegramWebhookSecretResolver } from '../adapters/telegram-webhook-secret.adapter.js';
import type { TelegramConfigRepository } from '../telegram.repository.js';
import type { TelegramConfigDomain } from '../telegram.types.js';

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
const BOT_TOKEN = '987654321:AABBccDDEEffGGhh';

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
  findByHotelId: jest.Mock<TelegramConfigRepository['findByHotelId']>;
}

function buildDomain(): TelegramConfigDomain {
  return {
    hotelId: HOTEL_ID,
    botTokenEnc: encrypt(BOT_TOKEN),
    botUsername: 'qooma_demo_bot',
    defaultChatId: null,
    gmTelegramId: null,
    webhookUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('TelegramWebhookSecretResolver.resolveSecret', () => {
  it('should decrypt bot_token at call time and return the plaintext', async () => {
    const repo: RepoMock = {
      findByHotelId: jest
        .fn<TelegramConfigRepository['findByHotelId']>()
        .mockResolvedValue(buildDomain()),
    };
    const resolver = new TelegramWebhookSecretResolver(repo as unknown as TelegramConfigRepository);

    const secret = await resolver.resolveSecret({ hotelId: HOTEL_ID });

    expect(secret).toBe(BOT_TOKEN);
    expect(repo.findByHotelId).toHaveBeenCalledWith(HOTEL_ID);
  });

  it('should throw NotFoundError when the hotel has no telegram_config', async () => {
    const repo: RepoMock = {
      findByHotelId: jest.fn<TelegramConfigRepository['findByHotelId']>().mockResolvedValue(null),
    };
    const resolver = new TelegramWebhookSecretResolver(repo as unknown as TelegramConfigRepository);

    await expect(resolver.resolveSecret({ hotelId: HOTEL_ID })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
