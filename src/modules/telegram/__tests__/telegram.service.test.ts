import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { resetConfigCache } from '@core/config/env.js';
import { NotFoundError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { decrypt, encrypt } from '@shared/utils/crypto.js';
import { maskTokenForLog } from '@shared/utils/masking.js';

import type { TelegramConfigRepository } from '../telegram.repository.js';
import { TelegramConfigService } from '../telegram.service.js';
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
const BOT_TOKEN_PLAINTEXT = '123456789:AAABBBcccDDDEeeFFFgggHHHiiiJJJkkk';

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
  upsert: jest.Mock<TelegramConfigRepository['upsert']>;
}

interface LoggerMock extends Logger {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

function buildRepoMock(): RepoMock {
  return {
    findByHotelId: jest.fn<TelegramConfigRepository['findByHotelId']>(),
    upsert: jest.fn<TelegramConfigRepository['upsert']>(),
  };
}

function buildLoggerMock(): LoggerMock {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function buildService(): {
  service: TelegramConfigService;
  repo: RepoMock;
  logger: LoggerMock;
} {
  const repo = buildRepoMock();
  const logger = buildLoggerMock();
  const service = new TelegramConfigService(repo as unknown as TelegramConfigRepository, logger);
  return { service, repo, logger };
}

function buildDomain(overrides: Partial<TelegramConfigDomain> = {}): TelegramConfigDomain {
  return {
    hotelId: HOTEL_ID,
    botTokenEnc: encrypt(BOT_TOKEN_PLAINTEXT),
    botUsername: 'qooma_demo_bot',
    defaultChatId: null,
    gmTelegramId: null,
    webhookUrl: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

describe('TelegramConfigService.get', () => {
  it('should return view with masked bot_token when config exists', async () => {
    const { service, repo } = buildService();
    const domain = buildDomain();
    repo.findByHotelId.mockResolvedValue(domain);

    const view = await service.get(HOTEL_ID);

    expect(repo.findByHotelId).toHaveBeenCalledWith(HOTEL_ID);
    expect(view.botToken).toBe(maskTokenForLog(BOT_TOKEN_PLAINTEXT));
    expect(view.hotelId).toBe(HOTEL_ID);
    expect(view.botUsername).toBe('qooma_demo_bot');
    expect(view.createdAt).toEqual(domain.createdAt);
    expect(view.updatedAt).toEqual(domain.updatedAt);
  });

  it('should throw NotFoundError when repository returns null', async () => {
    const { service, repo } = buildService();
    repo.findByHotelId.mockResolvedValue(null);

    await expect(service.get(HOTEL_ID)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.get(HOTEL_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      details: { resource: 'telegram_config', id: HOTEL_ID },
    });
  });

  it('should never expose plaintext or ciphertext in returned view', async () => {
    const { service, repo } = buildService();
    const domain = buildDomain();
    repo.findByHotelId.mockResolvedValue(domain);

    const view = await service.get(HOTEL_ID);

    expect(view.botToken).not.toBe(BOT_TOKEN_PLAINTEXT);
    expect(view.botToken).not.toContain(domain.botTokenEnc);
    expect(view.botToken.startsWith('***')).toBe(true);
  });

  it('should preserve optional fields when populated', async () => {
    const { service, repo } = buildService();
    const domain = buildDomain({
      defaultChatId: '-100123456',
      gmTelegramId: '789',
      webhookUrl: 'https://example.com/webhook',
    });
    repo.findByHotelId.mockResolvedValue(domain);

    const view = await service.get(HOTEL_ID);

    expect(view.defaultChatId).toBe('-100123456');
    expect(view.gmTelegramId).toBe('789');
    expect(view.webhookUrl).toBe('https://example.com/webhook');
  });
});

describe('TelegramConfigService.upsert', () => {
  it('should encrypt bot_token before persisting', async () => {
    const { service, repo } = buildService();
    repo.upsert.mockImplementation((hotelId, input) =>
      Promise.resolve(buildDomain({ hotelId, botTokenEnc: input.botTokenEnc })),
    );

    await service.upsert(HOTEL_ID, {
      botToken: BOT_TOKEN_PLAINTEXT,
      botUsername: 'qooma_demo_bot',
    });

    expect(repo.upsert).toHaveBeenCalledTimes(1);
    const [receivedHotelId, receivedInput] = repo.upsert.mock.calls[0] ?? [];
    expect(receivedHotelId).toBe(HOTEL_ID);
    expect(receivedInput?.botTokenEnc).not.toBe(BOT_TOKEN_PLAINTEXT);
    expect(receivedInput?.botTokenEnc).toContain(':');
    expect(decrypt(receivedInput?.botTokenEnc ?? '')).toBe(BOT_TOKEN_PLAINTEXT);
  });

  it('should return view with masked bot_token, not plaintext or ciphertext', async () => {
    const { service, repo } = buildService();
    repo.upsert.mockImplementation((hotelId, input) =>
      Promise.resolve(buildDomain({ hotelId, botTokenEnc: input.botTokenEnc })),
    );

    const view = await service.upsert(HOTEL_ID, {
      botToken: BOT_TOKEN_PLAINTEXT,
      botUsername: 'qooma_demo_bot',
    });

    expect(view.botToken).toBe(maskTokenForLog(BOT_TOKEN_PLAINTEXT));
    expect(view.botToken).not.toBe(BOT_TOKEN_PLAINTEXT);
  });

  it('should log masked bot_token BEFORE encrypt (PII floor)', async () => {
    const { service, repo, logger } = buildService();
    repo.upsert.mockImplementation((hotelId, input) =>
      Promise.resolve(buildDomain({ hotelId, botTokenEnc: input.botTokenEnc })),
    );

    await service.upsert(HOTEL_ID, {
      botToken: BOT_TOKEN_PLAINTEXT,
      botUsername: 'qooma_demo_bot',
    });

    expect(logger.info).toHaveBeenCalledTimes(1);
    const loggedPayload = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(loggedPayload).toMatchObject({
      msg: 'telegram_config.upsert',
      module: 'telegram',
      hotelId: HOTEL_ID,
      botToken: maskTokenForLog(BOT_TOKEN_PLAINTEXT),
      botUsername: 'qooma_demo_bot',
    });
    expect(loggedPayload['botToken']).not.toBe(BOT_TOKEN_PLAINTEXT);
    expect(JSON.stringify(loggedPayload)).not.toContain(BOT_TOKEN_PLAINTEXT);
  });

  it('should coerce nullish optional fields to null on persist', async () => {
    const { service, repo } = buildService();
    repo.upsert.mockImplementation((hotelId, input) =>
      Promise.resolve(buildDomain({ hotelId, botTokenEnc: input.botTokenEnc })),
    );

    await service.upsert(HOTEL_ID, {
      botToken: BOT_TOKEN_PLAINTEXT,
      botUsername: 'qooma_demo_bot',
    });

    const [, receivedInput] = repo.upsert.mock.calls[0] ?? [];
    expect(receivedInput?.defaultChatId).toBeNull();
    expect(receivedInput?.gmTelegramId).toBeNull();
    expect(receivedInput?.webhookUrl).toBeNull();
  });

  it('should pass through optional fields when provided', async () => {
    const { service, repo } = buildService();
    repo.upsert.mockImplementation((hotelId, input) =>
      Promise.resolve(
        buildDomain({
          hotelId,
          botTokenEnc: input.botTokenEnc,
          defaultChatId: input.defaultChatId,
          gmTelegramId: input.gmTelegramId,
          webhookUrl: input.webhookUrl,
        }),
      ),
    );

    const view = await service.upsert(HOTEL_ID, {
      botToken: BOT_TOKEN_PLAINTEXT,
      botUsername: 'qooma_demo_bot',
      defaultChatId: '-100999',
      gmTelegramId: '42',
      webhookUrl: 'https://example.com/tg-webhook',
    });

    const [, receivedInput] = repo.upsert.mock.calls[0] ?? [];
    expect(receivedInput?.defaultChatId).toBe('-100999');
    expect(receivedInput?.gmTelegramId).toBe('42');
    expect(receivedInput?.webhookUrl).toBe('https://example.com/tg-webhook');
    expect(view.defaultChatId).toBe('-100999');
    expect(view.gmTelegramId).toBe('42');
    expect(view.webhookUrl).toBe('https://example.com/tg-webhook');
  });

  it('should round-trip: view.botToken from upsert matches view.botToken from get', async () => {
    const { service, repo } = buildService();
    let storedDomain: TelegramConfigDomain | null = null;
    repo.upsert.mockImplementation((hotelId, input) => {
      storedDomain = buildDomain({ hotelId, botTokenEnc: input.botTokenEnc });
      return Promise.resolve(storedDomain);
    });
    repo.findByHotelId.mockImplementation(() => Promise.resolve(storedDomain));

    const upsertView = await service.upsert(HOTEL_ID, {
      botToken: BOT_TOKEN_PLAINTEXT,
      botUsername: 'qooma_demo_bot',
    });
    const getView = await service.get(HOTEL_ID);

    expect(getView.botToken).toBe(upsertView.botToken);
    expect(getView.botToken).toBe(maskTokenForLog(BOT_TOKEN_PLAINTEXT));
  });
});
