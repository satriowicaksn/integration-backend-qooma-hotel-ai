// Narrow view of the T20 TelegramDispatchService the OTP flows consume.
// Structural — the real `TelegramDispatchService` satisfies it as-is, so
// wiring passes the service instance without an adapter class.

import type {
  AnswerTelegramCallbackInput,
  SendTelegramMessageInput,
  TelegramSendResult,
} from '@modules/telegram-outbound/index.js';

export interface TelegramSendPort {
  sendMessage(input: SendTelegramMessageInput): Promise<TelegramSendResult>;
  answerCallbackQuery(input: AnswerTelegramCallbackInput): Promise<void>;
}
