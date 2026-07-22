/**
 * Unit tests for TelegramBotApiAdapter — mocks axios (no real HTTP).
 * Verifies URL construction, payload shapes (reply_markup /
 * reply_to_message_id / parse_mode), envelope handling, and that thrown
 * errors NEVER leak the bot token (which Telegram embeds in the URL).
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import axios from 'axios';
import type { AxiosInstance } from 'axios';

import { ExternalServiceError } from '@core/errors/app-errors.js';

import { TelegramBotApiAdapter } from '../adapters/telegram-bot-api.adapter.js';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const BOT_TOKEN = '987654321:AABBccDDEEffGGhhIIjjKKllMMnnOOppQQ';
const CHAT_ID = '-1001234567890';

describe('TelegramBotApiAdapter', () => {
  let postMock: jest.MockedFunction<AxiosInstance['post']>;
  let adapter: TelegramBotApiAdapter;

  beforeEach(() => {
    postMock = jest.fn();
    mockedAxios.create.mockReturnValue({ post: postMock } as unknown as AxiosInstance);
    adapter = new TelegramBotApiAdapter();
  });

  describe('sendMessage', () => {
    it('should POST to https://api.telegram.org/bot<token>/sendMessage with chat_id + text', async () => {
      postMock.mockResolvedValueOnce({
        status: 200,
        data: { ok: true, result: { message_id: 42 } },
      });

      const result = await adapter.sendMessage({
        botToken: BOT_TOKEN,
        chatId: CHAT_ID,
        body: 'hello group',
      });

      expect(postMock).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        { chat_id: CHAT_ID, text: 'hello group' },
      );
      expect(result).toEqual({ messageId: '42' });
    });

    it('should serialize reply_markup, reply_to_message_id and parse_mode when provided', async () => {
      postMock.mockResolvedValueOnce({
        status: 200,
        data: { ok: true, result: { message_id: 1 } },
      });
      const markup = {
        inline_keyboard: [[{ text: 'Sudah diantar', callback_data: 'otp:done:t' }]],
      };

      await adapter.sendMessage({
        botToken: BOT_TOKEN,
        chatId: CHAT_ID,
        body: 'x',
        parseMode: 'HTML',
        replyMarkup: markup,
        replyToMessageId: 4242,
      });

      const payload = postMock.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(payload).toEqual({
        chat_id: CHAT_ID,
        text: 'x',
        parse_mode: 'HTML',
        reply_markup: markup,
        reply_to_message_id: 4242,
        allow_sending_without_reply: true,
      });
    });

    it('should throw ExternalServiceError WITHOUT the token when Telegram answers ok:false', async () => {
      postMock.mockResolvedValueOnce({
        status: 400,
        data: { ok: false, description: 'Bad Request: chat not found' },
      });

      const failure = adapter.sendMessage({ botToken: BOT_TOKEN, chatId: CHAT_ID, body: 'x' });
      await expect(failure).rejects.toThrow(ExternalServiceError);
      await adapter
        .sendMessage({ botToken: BOT_TOKEN, chatId: CHAT_ID, body: 'x' })
        .catch((err: ExternalServiceError) => {
          expect(JSON.stringify({ m: err.message, d: err.details })).not.toContain(BOT_TOKEN);
        });
    });

    it('should throw ExternalServiceError without the token on transport failure', async () => {
      postMock.mockRejectedValueOnce(
        Object.assign(new Error(`connect ECONNREFUSED https://api.telegram.org/bot${BOT_TOKEN}`), {
          code: 'ECONNREFUSED',
        }),
      );

      await adapter
        .sendMessage({ botToken: BOT_TOKEN, chatId: CHAT_ID, body: 'x' })
        .then(() => {
          throw new Error('expected rejection');
        })
        .catch((err: ExternalServiceError) => {
          expect(err).toBeInstanceOf(ExternalServiceError);
          expect(JSON.stringify({ m: err.message, d: err.details })).not.toContain(BOT_TOKEN);
        });
    });

    it('should throw when the 2xx envelope is missing message_id', async () => {
      postMock.mockResolvedValueOnce({ status: 200, data: { ok: true, result: {} } });
      await expect(
        adapter.sendMessage({ botToken: BOT_TOKEN, chatId: CHAT_ID, body: 'x' }),
      ).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('answerCallbackQuery', () => {
    it('should POST callback_query_id (+ optional text) to the answerCallbackQuery method', async () => {
      postMock.mockResolvedValueOnce({ status: 200, data: { ok: true, result: true } });

      await adapter.answerCallbackQuery({
        botToken: BOT_TOKEN,
        callbackQueryId: 'cbq-1',
        text: 'Dicatat.',
      });

      expect(postMock).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
        { callback_query_id: 'cbq-1', text: 'Dicatat.' },
      );
    });

    it('should omit text when not provided', async () => {
      postMock.mockResolvedValueOnce({ status: 200, data: { ok: true, result: true } });

      await adapter.answerCallbackQuery({ botToken: BOT_TOKEN, callbackQueryId: 'cbq-2' });

      expect(postMock.mock.calls[0]?.[1]).toEqual({ callback_query_id: 'cbq-2' });
    });
  });
});
