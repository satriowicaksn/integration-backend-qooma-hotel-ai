// Domain types for T97 (ADD-24) OTP delivery verification — integration side.
// The 2-digit code lifecycle (generation, attempt counting, resend limits,
// grace timer) is OWNED BY HOTEL CORE; this module relays interactions and
// renders outcomes. The code value only ever transits Core → WA dispatch.

export type OtpCallbackAction = 'done' | 'nocode' | 'declined' | 'resend';

export type OtpVerifyResult =
  | 'verified'
  | 'wrong_code'
  | 'locked'
  | 'already_closed'
  | 'not_required';

export type OtpSkipReason = 'guest_declined' | 'other';

export interface OtpTicketContext {
  readonly ticketId: string;
  readonly hotelId: string;
  readonly chatId: string;
  readonly telegramMessageId: number;
  readonly guestWaPhone: string | null;
  readonly guestId: string | null;
}

export interface OtpTicketContextUpsertInput {
  readonly ticketId: string;
  readonly hotelId: string;
  readonly chatId: string;
  readonly telegramMessageId: number;
  readonly guestWaPhone?: string;
  readonly guestId?: string;
}

export type OtpResendOutcome =
  | { readonly kind: 'ok'; readonly otpCode: string }
  | { readonly kind: 'limit_reached' }
  | { readonly kind: 'not_applicable' };
