import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { resetConfigCache } from '@core/config/env.js';
import { ExternalServiceError, NotFoundError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { encrypt } from '@shared/utils/crypto.js';

import type {
  TelegramBotApiPort,
  TelegramBotSendMessageInput,
  TelegramBotSendMessageResult,
} from '../ports/telegram-bot-api.port.js';
import type { TelegramConfigReadPort } from '../ports/telegram-config-read.port.js';
import { TelegramDispatchService } from '../telegram-outbound.service.js';
import type {
  SendTelegramMessageInput,
  TelegramConfigForDispatch,
} from '../telegram-outbound.types.js';

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
const CHAT_ID_FULL = '-1001234567890'; // Telegram group id ends with `7890`
const BOT_TOKEN_PLAINTEXT = '987654321:AABBccDDEEffGGhhIIjjKKllMMnnOOppQQ';
const NOW = new Date('2026-07-07T14:30:00Z');

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

interface ConfigMock {
  getForHotel: jest.Mock<TelegramConfigReadPort['getForHotel']>;
}

interface BotApiMock {
  sendMessage: jest.Mock<
    (input: TelegramBotSendMessageInput) => Promise<TelegramBotSendMessageResult>
  >;
}

interface LoggerMock extends Logger {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

function buildLogger(): LoggerMock {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function buildService(): {
  service: TelegramDispatchService;
  config: ConfigMock;
  botApi: BotApiMock;
  logger: LoggerMock;
} {
  const config: ConfigMock = {
    getForHotel: jest.fn<TelegramConfigReadPort['getForHotel']>(),
  };
  const botApi: BotApiMock = {
    sendMessage:
      jest.fn<(input: TelegramBotSendMessageInput) => Promise<TelegramBotSendMessageResult>>(),
  };
  const logger = buildLogger();
  const service = new TelegramDispatchService(
    {
      config: config as unknown as TelegramConfigReadPort,
      botApi: botApi as unknown as TelegramBotApiPort,
    },
    logger,
    { now: () => NOW },
  );
  return { service, config, botApi, logger };
}

function buildConfigView(): TelegramConfigForDispatch {
  return {
    botTokenEnc: encrypt(BOT_TOKEN_PLAINTEXT),
    botUsername: 'qooma_demo_bot',
  };
}

const BASE_INPUT: SendTelegramMessageInput = {
  hotelId: HOTEL_ID,
  chatId: CHAT_ID_FULL,
  body: 'Escalation: ticket #42 pending 15+ min',
};

describe('TelegramDispatchService.sendMessage — happy path', () => {
  it('should decrypt at call time, invoke bot API with plaintext token, and return { messageId, sentAt }', async () => {
    const { service, config, botApi } = buildService();
    config.getForHotel.mockResolvedValue(buildConfigView());
    botApi.sendMessage.mockResolvedValue({ messageId: '5555555' });

    const result = await service.sendMessage(BASE_INPUT);

    expect(config.getForHotel).toHaveBeenCalledWith({ hotelId: HOTEL_ID });
    expect(botApi.sendMessage).toHaveBeenCalledWith({
      botToken: BOT_TOKEN_PLAINTEXT,
      chatId: CHAT_ID_FULL,
      body: BASE_INPUT.body,
    });
    expect(result).toEqual({ messageId: '5555555', sentAt: NOW });
  });

  it('should pass parseMode through to the bot API when provided', async () => {
    const { service, config, botApi } = buildService();
    config.getForHotel.mockResolvedValue(buildConfigView());
    botApi.sendMessage.mockResolvedValue({ messageId: '1' });

    await service.sendMessage({ ...BASE_INPUT, parseMode: 'MarkdownV2' });

    expect(botApi.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ parseMode: 'MarkdownV2' }),
    );
  });

  it('should omit parseMode from the bot API call when the input omits it', async () => {
    const { service, config, botApi } = buildService();
    config.getForHotel.mockResolvedValue(buildConfigView());
    botApi.sendMessage.mockResolvedValue({ messageId: '1' });

    await service.sendMessage(BASE_INPUT);

    const call = botApi.sendMessage.mock.calls[0]?.[0] as TelegramBotSendMessageInput;
    expect(call).not.toHaveProperty('parseMode');
  });
});

describe('TelegramDispatchService.sendMessage — PII discipline (bindings #3 / #4 / #5)', () => {
  it('should log chatIdSuffix (last 4 chars) and NEVER the full chatId (binding #4)', async () => {
    const { service, config, botApi, logger } = buildService();
    config.getForHotel.mockResolvedValue(buildConfigView());
    botApi.sendMessage.mockResolvedValue({ messageId: '77' });

    await service.sendMessage(BASE_INPUT);

    const record = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record['chatIdSuffix']).toBe(CHAT_ID_FULL.slice(-4));
    expect(JSON.stringify(record)).not.toContain(CHAT_ID_FULL);
  });

  it('should log bodyLength but NEVER the body content (binding #5)', async () => {
    const { service, config, botApi, logger } = buildService();
    const secretBody = 'CONFIDENTIAL escalation note: ticket #42 payload';
    config.getForHotel.mockResolvedValue(buildConfigView());
    botApi.sendMessage.mockResolvedValue({ messageId: '77' });

    await service.sendMessage({ ...BASE_INPUT, body: secretBody });

    const record = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record['bodyLength']).toBe(secretBody.length);
    expect(JSON.stringify(record)).not.toContain(secretBody);
  });

  it('should NEVER surface the decrypted botToken in the log line (binding #3)', async () => {
    const { service, config, botApi, logger } = buildService();
    config.getForHotel.mockResolvedValue(buildConfigView());
    botApi.sendMessage.mockResolvedValue({ messageId: '77' });

    await service.sendMessage(BASE_INPUT);

    const record = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.stringify(record)).not.toContain(BOT_TOKEN_PLAINTEXT);
    expect(JSON.stringify(record)).not.toContain(BOT_TOKEN_PLAINTEXT.split(':')[1] ?? '');
  });
});

describe('TelegramDispatchService.sendMessage — error mapping (binding #9)', () => {
  it('should throw NotFoundError when the reader port returns null for the hotel', async () => {
    const { service, config, botApi } = buildService();
    config.getForHotel.mockResolvedValue(null);

    await expect(service.sendMessage(BASE_INPUT)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.sendMessage(BASE_INPUT)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      details: { resource: 'telegram_config', id: HOTEL_ID },
    });
    expect(botApi.sendMessage).not.toHaveBeenCalled();
  });

  it('should throw ExternalServiceError when the bot API adapter throws', async () => {
    const { service, config, botApi } = buildService();
    config.getForHotel.mockResolvedValue(buildConfigView());
    botApi.sendMessage.mockRejectedValue(new Error('rate-limited'));

    await expect(service.sendMessage(BASE_INPUT)).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
