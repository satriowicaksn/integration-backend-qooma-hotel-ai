// Domain types for T20 Telegram outbound dispatch primitive (spec §2.4).
// Wire types live in telegram-outbound.schema.ts (zod, source of truth).

export type TelegramParseMode = 'HTML' | 'MarkdownV2';

/** Telegram Bot API `InlineKeyboardButton` / `InlineKeyboardMarkup` wire
 *  shapes (subset). snake_case on purpose — these serialize verbatim into
 *  the `reply_markup` request field (T97 / ADD-24 OTP action buttons). */
export interface TelegramInlineKeyboardButton {
  readonly text: string;
  readonly callback_data: string;
}

export interface TelegramInlineKeyboardMarkup {
  readonly inline_keyboard: ReadonlyArray<ReadonlyArray<TelegramInlineKeyboardButton>>;
}

/** Input consumed by `TelegramDispatchService.sendMessage`.
 *  Caller (Hotel Core escalation worker) supplies a pre-resolved
 *  `chatId` — per-dept routing (T18) or `default_chat_id` fallback is a
 *  T20-followup composition-layer concern per PM C ACK T20 GAP #1. */
export interface SendTelegramMessageInput {
  readonly hotelId: string;
  readonly chatId: string;
  readonly body: string;
  readonly parseMode?: TelegramParseMode;
  readonly replyMarkup?: TelegramInlineKeyboardMarkup;
  readonly replyToMessageId?: number;
}

/** Input consumed by `TelegramDispatchService.answerCallbackQuery` (T97). */
export interface AnswerTelegramCallbackInput {
  readonly hotelId: string;
  readonly callbackQueryId: string;
  readonly text?: string;
}

/** Result returned by the service after a successful dispatch.
 *  `messageId` typed as string per PM C ACK T20 binding #11 (JS number
 *  precision safety for large Telegram integer IDs). */
export interface TelegramSendResult {
  readonly messageId: string;
  readonly sentAt: Date;
}

/** Narrow view returned by `TelegramConfigReadPort` — only the fields
 *  the dispatch flow needs (bot token ciphertext + username for optional
 *  logging in T20-followup). Reader-port pattern per T23 §1262 +
 *  PM C ACK T20 binding #1. */
export interface TelegramConfigForDispatch {
  readonly botTokenEnc: string;
  readonly botUsername: string;
}
