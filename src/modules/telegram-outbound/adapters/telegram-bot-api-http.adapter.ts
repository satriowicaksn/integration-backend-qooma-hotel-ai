// HTTP adapter for the Telegram Bot API (spec §7 external deps row 331).
// POSTs `{baseUrl}/bot{botToken}/sendMessage` with the JSON body Telegram
// expects. Response shape: `{ ok: true, result: { message_id: <int>, ... } }`.
// Adapter converts the integer `message_id` to a string per T20 binding #11
// (JS-number precision safety for large IDs).
//
// **Discipline**:
// - Bot token is embedded ONLY in the URL path (opaque HTTPS transport).
//   Adapter does NOT log the token. The service's log line (T20 binding #3)
//   is the sole log emission per dispatch.
// - Any non-2xx or network error bubbles as-is; the service maps it to
//   `ExternalServiceError('telegram_bot_api', ...)` per T20 binding #9.

import type { AxiosInstance } from 'axios';

import { ThirdPartyUnreachableError } from '@core/errors/app-errors.js';

import type {
  TelegramBotApiPort,
  TelegramBotSendMessageInput,
  TelegramBotSendMessageResult,
} from '../ports/telegram-bot-api.port.js';

interface TelegramBotApiResponse {
  readonly ok: boolean;
  readonly result?: { readonly message_id?: number | string };
  readonly description?: string;
}

export class TelegramBotApiHttpAdapter implements TelegramBotApiPort {
  constructor(
    private readonly httpClient: AxiosInstance,
    private readonly baseUrl: string,
  ) {}

  async sendMessage(input: TelegramBotSendMessageInput): Promise<TelegramBotSendMessageResult> {
    const url = `${this.baseUrl}/bot${input.botToken}/sendMessage`;
    const body: Record<string, unknown> = {
      chat_id: input.chatId,
      text: input.body,
    };
    if (input.parseMode !== undefined) {
      body['parse_mode'] = input.parseMode;
    }
    const resp = await this.httpClient.post<TelegramBotApiResponse>(url, body);
    const messageId = resp.data.result?.message_id;
    if (messageId === undefined) {
      throw new ThirdPartyUnreachableError(
        `missing message_id in Telegram response: ${resp.data.description ?? 'no description'}`,
      );
    }
    return { messageId: String(messageId) };
  }
}
