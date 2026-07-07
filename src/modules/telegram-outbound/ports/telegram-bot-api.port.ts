// Vendor-agnostic Telegram Bot API ABI (spec §7 external deps row 331).
// TYPE-ONLY per PM C ACK T20 binding. Adapter (T20-followup) uses
// `axios` (already installed) to POST
// `https://api.telegram.org/bot<botToken>/sendMessage` and returns the
// integer `message_id` from Telegram converted to string per binding #11.

import type { TelegramParseMode } from '../telegram-outbound.types.js';

export interface TelegramBotSendMessageInput {
  readonly botToken: string;
  readonly chatId: string;
  readonly body: string;
  readonly parseMode?: TelegramParseMode;
}

export interface TelegramBotSendMessageResult {
  readonly messageId: string;
}

export interface TelegramBotApiPort {
  sendMessage(input: TelegramBotSendMessageInput): Promise<TelegramBotSendMessageResult>;
}
