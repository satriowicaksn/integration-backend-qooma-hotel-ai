/**
 * Telegram Bot API adapter (T97) — axios implementation of TelegramBotApiPort.
 *
 * POSTs `https://api.telegram.org/bot<token>/<method>`. The token is embedded
 * in the URL by Telegram's design, so the URL is NEVER logged and axios
 * transport errors are re-thrown with a synthetic message (an AxiosError can
 * carry `config.url` — we drop it). Response bodies are surfaced only via
 * Telegram's `description` field, which never echoes the token.
 */

import axios from 'axios';

import { ExternalServiceError } from '@core/errors/app-errors.js';

import type {
  TelegramBotAnswerCallbackInput,
  TelegramBotApiPort,
  TelegramBotSendMessageInput,
  TelegramBotSendMessageResult,
} from '../ports/telegram-bot-api.port.js';

const SERVICE = 'telegram_bot_api';
const DEFAULT_BASE_URL = 'https://api.telegram.org';
const REQUEST_TIMEOUT_MS = 10_000;

interface TelegramApiEnvelope<T> {
  ok?: boolean;
  result?: T;
  description?: string;
}

interface SendMessageResult {
  message_id?: number;
}

export class TelegramBotApiAdapter implements TelegramBotApiPort {
  private readonly http = axios.create({
    timeout: REQUEST_TIMEOUT_MS,
    validateStatus: () => true,
  });

  constructor(private readonly baseUrl: string = DEFAULT_BASE_URL) {}

  async sendMessage(input: TelegramBotSendMessageInput): Promise<TelegramBotSendMessageResult> {
    const payload: Record<string, unknown> = {
      chat_id: input.chatId,
      text: input.body,
      ...(input.parseMode !== undefined ? { parse_mode: input.parseMode } : {}),
      ...(input.replyMarkup !== undefined ? { reply_markup: input.replyMarkup } : {}),
      ...(input.replyToMessageId !== undefined
        ? { reply_to_message_id: input.replyToMessageId, allow_sending_without_reply: true }
        : {}),
    };

    const data = await this.invoke<SendMessageResult>(input.botToken, 'sendMessage', payload);
    const messageId = data.result?.message_id;
    if (messageId === undefined) {
      throw new ExternalServiceError(SERVICE, 'sendMessage response missing message_id');
    }
    return { messageId: String(messageId) };
  }

  async answerCallbackQuery(input: TelegramBotAnswerCallbackInput): Promise<void> {
    await this.invoke(input.botToken, 'answerCallbackQuery', {
      callback_query_id: input.callbackQueryId,
      ...(input.text !== undefined ? { text: input.text } : {}),
    });
  }

  private async invoke<T>(
    botToken: string,
    method: string,
    payload: Record<string, unknown>,
  ): Promise<TelegramApiEnvelope<T>> {
    const url = `${this.baseUrl}/bot${botToken}/${method}`;
    let res: { status: number; data: TelegramApiEnvelope<T> };
    try {
      res = await this.http.post<TelegramApiEnvelope<T>>(url, payload);
    } catch (err) {
      // Do NOT propagate the axios error itself — it can embed the URL
      // (and therefore the bot token) in `config`/`message`.
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : 'unknown';
      throw new ExternalServiceError(SERVICE, `${method} transport failure`, { body: code });
    }

    if (res.status < 200 || res.status >= 300 || res.data.ok !== true) {
      throw new ExternalServiceError(SERVICE, `${method} returned ${res.status}`, {
        status: res.status,
        body: res.data.description ?? null,
      });
    }
    return res.data;
  }
}
