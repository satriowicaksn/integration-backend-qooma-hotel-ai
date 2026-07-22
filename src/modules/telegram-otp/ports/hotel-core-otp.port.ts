// Cross-service RPC port — Integration → Hotel Core `/internal` OTP surface
// (ADD-24). Wire bodies are snake_case; the adapter owns the mapping.
//
// `resend` is the ONLY method whose result carries the code — callers use it
// exclusively to dispatch a WA message to the guest, never toward Telegram.

import type { OtpResendOutcome, OtpSkipReason, OtpVerifyResult } from '../telegram-otp.types.js';

export interface HotelCoreOtpPort {
  /** `POST /internal/tickets/resolve-telegram` — 404 maps to null. */
  resolveTicketByTelegramMessage(input: {
    hotelId: string;
    telegramMessageId: number;
  }): Promise<{ ticketId: string } | null>;

  /** `POST /internal/tickets/:id/telegram-message` */
  storeTelegramMessage(input: { ticketId: string; telegramMessageId: number }): Promise<void>;

  /** `POST /internal/tickets/:id/otp/ack-delivered` */
  ackDelivered(input: { ticketId: string }): Promise<void>;

  /** `POST /internal/tickets/:id/otp/mark-delivered` */
  markDelivered(input: {
    ticketId: string;
    actorTelegramId?: string;
  }): Promise<{ graceDeadline: Date }>;

  /** `POST /internal/tickets/:id/otp/verify` */
  verifyCode(input: {
    ticketId: string;
    code: string;
    actorTelegramId?: string;
  }): Promise<{ result: OtpVerifyResult; attemptsLeft?: number }>;

  /** `POST /internal/tickets/:id/otp/skip` */
  skip(input: { ticketId: string; reason: OtpSkipReason; note?: string }): Promise<void>;

  /** `POST /internal/tickets/:id/otp/resend` — non-2xx resend-limit maps to
   *  `{ kind: 'limit_reached' }` instead of throwing. */
  resend(input: { ticketId: string }): Promise<OtpResendOutcome>;
}
