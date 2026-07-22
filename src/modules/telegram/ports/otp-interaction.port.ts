// T97 (ADD-24) — port for the OTP delivery-verification interactions that
// arrive over the Telegram webhook: inline-keyboard callback presses and
// 2-digit code replies. Implemented by `@modules/telegram-otp`
// (TelegramOtpCallbackService); the inbound service only routes.
//
// ANTI-CHEAT: `OtpReplyCodeInteraction.code` is the guest-supplied attempt.
// Implementations MUST forward it to Hotel Core only — never into a
// Telegram payload or a log line.

export const OTP_CALLBACK_DATA_PREFIX = 'otp:';

export interface OtpCallbackInteraction {
  readonly hotelId: string;
  readonly callbackQueryId: string;
  readonly data: string;
  readonly actorTelegramId: string;
  readonly chatId: string | null;
  readonly messageId: number | null;
}

export interface OtpReplyCodeInteraction {
  readonly hotelId: string;
  readonly chatId: string;
  readonly replyToMessageId: number;
  readonly code: string;
  readonly actorTelegramId: string;
}

export interface OtpInteractionPort {
  handleCallback(input: OtpCallbackInteraction): Promise<void>;
  handleReplyCode(input: OtpReplyCodeInteraction): Promise<void>;
}
