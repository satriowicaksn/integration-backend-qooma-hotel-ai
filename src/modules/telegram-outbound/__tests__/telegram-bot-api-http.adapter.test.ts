import { describe, expect, it, jest } from '@jest/globals';
import type { AxiosInstance } from 'axios';

import { TelegramBotApiHttpAdapter } from '../adapters/telegram-bot-api-http.adapter.js';

const BASE_URL = 'https://mock.telegram.example';
const BOT_TOKEN = '987654321:AABBccDDEEffGGhh';
const CHAT_ID = '-1001234567890';

interface AxiosMock {
  post: jest.Mock;
}

function buildHttpClient(): AxiosMock {
  return { post: jest.fn() };
}

describe('TelegramBotApiHttpAdapter.sendMessage — happy path', () => {
  it('should POST to /bot<token>/sendMessage with snake_case Bot-API body and return message_id as string', async () => {
    const httpClient = buildHttpClient();
    httpClient.post.mockResolvedValue({ data: { ok: true, result: { message_id: 42 } } });
    const adapter = new TelegramBotApiHttpAdapter(httpClient as unknown as AxiosInstance, BASE_URL);

    const result = await adapter.sendMessage({
      botToken: BOT_TOKEN,
      chatId: CHAT_ID,
      body: 'Escalation test',
    });

    expect(httpClient.post).toHaveBeenCalledWith(`${BASE_URL}/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: 'Escalation test',
    });
    expect(result).toEqual({ messageId: '42' });
  });

  it('should pass parse_mode through when provided (binding #13 enum-honored at service layer)', async () => {
    const httpClient = buildHttpClient();
    httpClient.post.mockResolvedValue({ data: { ok: true, result: { message_id: 1 } } });
    const adapter = new TelegramBotApiHttpAdapter(httpClient as unknown as AxiosInstance, BASE_URL);

    await adapter.sendMessage({
      botToken: BOT_TOKEN,
      chatId: CHAT_ID,
      body: '**bold**',
      parseMode: 'MarkdownV2',
    });

    expect(httpClient.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ parse_mode: 'MarkdownV2' }),
    );
  });

  it('should omit parse_mode from the body when the input omits it', async () => {
    const httpClient = buildHttpClient();
    httpClient.post.mockResolvedValue({ data: { ok: true, result: { message_id: 1 } } });
    const adapter = new TelegramBotApiHttpAdapter(httpClient as unknown as AxiosInstance, BASE_URL);

    await adapter.sendMessage({
      botToken: BOT_TOKEN,
      chatId: CHAT_ID,
      body: 'plain',
    });

    const body = httpClient.post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body).not.toHaveProperty('parse_mode');
  });

  it('should coerce a stringified numeric message_id to string (JS precision safety per T20 binding #11)', async () => {
    const httpClient = buildHttpClient();
    httpClient.post.mockResolvedValue({
      data: { ok: true, result: { message_id: '9007199254740993' } },
    });
    const adapter = new TelegramBotApiHttpAdapter(httpClient as unknown as AxiosInstance, BASE_URL);

    const result = await adapter.sendMessage({
      botToken: BOT_TOKEN,
      chatId: CHAT_ID,
      body: 'x',
    });

    expect(result.messageId).toBe('9007199254740993');
  });
});

describe('TelegramBotApiHttpAdapter.sendMessage — error passthrough (service maps to ExternalServiceError)', () => {
  it('should throw when the Telegram response omits result.message_id', async () => {
    const httpClient = buildHttpClient();
    httpClient.post.mockResolvedValue({
      data: { ok: false, description: 'chat not found' },
    });
    const adapter = new TelegramBotApiHttpAdapter(httpClient as unknown as AxiosInstance, BASE_URL);

    await expect(
      adapter.sendMessage({ botToken: BOT_TOKEN, chatId: CHAT_ID, body: 'x' }),
    ).rejects.toThrow(/message_id/);
  });

  it('should propagate axios errors verbatim (service wraps in ExternalServiceError)', async () => {
    const httpClient = buildHttpClient();
    httpClient.post.mockRejectedValue(new Error('ECONNRESET'));
    const adapter = new TelegramBotApiHttpAdapter(httpClient as unknown as AxiosInstance, BASE_URL);

    await expect(
      adapter.sendMessage({ botToken: BOT_TOKEN, chatId: CHAT_ID, body: 'x' }),
    ).rejects.toThrow(/ECONNRESET/);
  });
});
