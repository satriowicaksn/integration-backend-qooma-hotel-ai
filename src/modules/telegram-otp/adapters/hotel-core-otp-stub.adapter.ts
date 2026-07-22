// MVP stub for HotelCoreOtpPort — wired when HOTEL_CORE_BASE_URL /
// HOTEL_CORE_INTERNAL_SECRET are unset (dev without a running Core).
// Read-ish verbs return neutral values; state-mutating verbs throw so the
// callback handler surfaces a generic failure instead of faking outcomes.
// Every call logs `hc_rpc_stubbed` (T19 stub-adapter precedent).

import { ExternalServiceError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import type { HotelCoreOtpPort } from '../ports/hotel-core-otp.port.js';
import type { OtpResendOutcome, OtpVerifyResult } from '../telegram-otp.types.js';

export class HotelCoreOtpStubAdapter implements HotelCoreOtpPort {
  constructor(private readonly logger: Logger) {}

  async resolveTicketByTelegramMessage(): Promise<{ ticketId: string } | null> {
    this.warn('resolve_telegram');
    return Promise.resolve(null);
  }

  async storeTelegramMessage(): Promise<void> {
    this.warn('telegram_message');
    return Promise.resolve();
  }

  async ackDelivered(): Promise<void> {
    this.warn('ack_delivered');
    return Promise.resolve();
  }

  async markDelivered(): Promise<{ graceDeadline: Date }> {
    this.warn('mark_delivered');
    return Promise.reject(new ExternalServiceError('hotel-core', 'stubbed'));
  }

  async verifyCode(): Promise<{ result: OtpVerifyResult; attemptsLeft?: number }> {
    this.warn('verify');
    return Promise.reject(new ExternalServiceError('hotel-core', 'stubbed'));
  }

  async skip(): Promise<void> {
    this.warn('skip');
    return Promise.reject(new ExternalServiceError('hotel-core', 'stubbed'));
  }

  async resend(): Promise<OtpResendOutcome> {
    this.warn('resend');
    return Promise.reject(new ExternalServiceError('hotel-core', 'stubbed'));
  }

  private warn(action: string): void {
    this.logger.warn({
      msg: 'telegram_otp.hc_rpc_stubbed',
      module: 'telegram-otp',
      action,
    });
  }
}
