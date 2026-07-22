// Barrel — T97 (ADD-24) OTP delivery verification, integration side.

export type {
  OtpCallbackAction,
  OtpResendOutcome,
  OtpSkipReason,
  OtpTicketContext,
  OtpTicketContextUpsertInput,
  OtpVerifyResult,
} from './telegram-otp.types.js';

export type { HotelCoreOtpPort } from './ports/hotel-core-otp.port.js';
export type { TelegramSendPort } from './ports/telegram-send.port.js';
export type {
  GuestWaSendInput,
  GuestWaSendPort,
  GuestWaSendResult,
} from './ports/guest-wa-send.port.js';

// Adapters are NOT re-exported here — the composition layer (entrypoints)
// imports concrete adapter files directly per ESLint boundary rules.

export { OtpTicketContextRepository } from './telegram-otp.repository.js';

export {
  buildOtpCallbackData,
  buildOtpKeyboard,
  parseOtpCallbackData,
} from './telegram-otp.keyboard.js';
export type { ParsedOtpCallbackData } from './telegram-otp.keyboard.js';

export { TelegramOtpNotifyService } from './telegram-otp-notify.service.js';
export type { OtpTicketNotifyInput, TelegramOtpNotifyDeps } from './telegram-otp-notify.service.js';

export { TelegramOtpCallbackService } from './telegram-otp-callback.service.js';
export type { OtpClock, TelegramOtpCallbackDeps } from './telegram-otp-callback.service.js';
