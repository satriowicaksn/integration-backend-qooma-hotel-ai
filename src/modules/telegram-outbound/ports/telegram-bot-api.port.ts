// Vendor-agnostic Telegram Bot API ABI (spec §7 external deps row 331).
// Adapter: `adapters/telegram-bot-api.adapter.ts` (T97) uses `axios` to POST
// `https://api.telegram.org/bot<botToken>/<method>` and returns the integer
// `message_id` from Telegram converted to string per PM C ACK T20 binding #11.
//
// T97 (ADD-24) extends the surface with `reply_markup` inline keyboards,
// `reply_to_message_id` (group notes threaded onto the ticket message) and
// `answerCallbackQuery` for OTP action buttons.

import type {
  TelegramInlineKeyboardMarkup,
  TelegramParseMode,
} from '../telegram-outbound.types.js';

export interface TelegramBotSendMessageInput {
  readonly botToken: string;
  readonly chatId: string;
  readonly body: string;
  readonly parseMode?: TelegramParseMode;
  readonly replyMarkup?: TelegramInlineKeyboardMarkup;
  readonly replyToMessageId?: number;
}

export interface TelegramBotSendMessageResult {
  readonly messageId: string;
}

export interface TelegramBotAnswerCallbackInput {
  readonly botToken: string;
  readonly callbackQueryId: string;
  readonly text?: string;
}

export interface TelegramBotApiPort {
  sendMessage(input: TelegramBotSendMessageInput): Promise<TelegramBotSendMessageResult>;
  answerCallbackQuery(input: TelegramBotAnswerCallbackInput): Promise<void>;
}
