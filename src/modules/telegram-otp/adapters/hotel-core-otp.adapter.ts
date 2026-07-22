/**
 * HTTP adapter — Integration → Hotel Core `/internal` OTP RPC (ADD-24).
 *
 * Auth: `X-Internal-Secret` shared-secret header (spec §4.11 pattern).
 * Timeout: 10s. No retries — every verb is state-mutating on Core's side
 * (verify decrements attempts, resend decrements the resend budget), so a
 * blind retry could burn guest attempts.
 *
 * ANTI-CHEAT LOGGING: response bodies are NEVER logged (resend's carries
 * the code); log lines hold action + status + duration only.
 */

import axios from 'axios';

import { ExternalServiceError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import type { HotelCoreOtpPort } from '../ports/hotel-core-otp.port.js';
import type { OtpResendOutcome, OtpSkipReason, OtpVerifyResult } from '../telegram-otp.types.js';

const SERVICE = 'hotel-core';
const TIMEOUT_MS = 10_000;
const RESEND_LIMIT_MARKER = 'OTP_RESEND_LIMIT';

const VERIFY_RESULTS: readonly OtpVerifyResult[] = [
  'verified',
  'wrong_code',
  'locked',
  'already_closed',
  'not_required',
];

export interface HotelCoreOtpAdapterConfig {
  readonly baseUrl: string;
  readonly internalSecret: string;
}

interface RpcResponse {
  readonly status: number;
  readonly data: Record<string, unknown>;
}

function is2xx(status: number): boolean {
  return status >= 200 && status < 300;
}

export class HotelCoreOtpAdapter implements HotelCoreOtpPort {
  private readonly http = axios.create({ timeout: TIMEOUT_MS, validateStatus: () => true });

  constructor(
    private readonly config: HotelCoreOtpAdapterConfig,
    private readonly logger: Logger,
  ) {}

  async resolveTicketByTelegramMessage(input: {
    hotelId: string;
    telegramMessageId: number;
  }): Promise<{ ticketId: string } | null> {
    const res = await this.post('resolve_telegram', '/internal/tickets/resolve-telegram', {
      hotel_id: input.hotelId,
      telegram_message_id: input.telegramMessageId,
    });
    if (res.status === 404) return null;
    this.assertOk(res, 'resolve_telegram');
    const ticketId = res.data['ticket_id'];
    if (typeof ticketId !== 'string') {
      throw new ExternalServiceError(SERVICE, 'resolve-telegram response missing ticket_id');
    }
    return { ticketId };
  }

  async storeTelegramMessage(input: {
    ticketId: string;
    telegramMessageId: number;
  }): Promise<void> {
    const res = await this.post(
      'telegram_message',
      `/internal/tickets/${input.ticketId}/telegram-message`,
      { telegram_message_id: input.telegramMessageId },
    );
    this.assertOk(res, 'telegram_message');
  }

  async ackDelivered(input: { ticketId: string }): Promise<void> {
    const res = await this.post(
      'ack_delivered',
      `/internal/tickets/${input.ticketId}/otp/ack-delivered`,
      {},
    );
    this.assertOk(res, 'ack_delivered');
  }

  async markDelivered(input: {
    ticketId: string;
    actorTelegramId?: string;
  }): Promise<{ graceDeadline: Date }> {
    const res = await this.post(
      'mark_delivered',
      `/internal/tickets/${input.ticketId}/otp/mark-delivered`,
      input.actorTelegramId !== undefined ? { actor_telegram_id: input.actorTelegramId } : {},
    );
    this.assertOk(res, 'mark_delivered');
    const deadline = res.data['grace_deadline'];
    const parsed = typeof deadline === 'string' ? new Date(deadline) : new Date(NaN);
    if (Number.isNaN(parsed.getTime())) {
      throw new ExternalServiceError(SERVICE, 'mark-delivered response missing grace_deadline');
    }
    return { graceDeadline: parsed };
  }

  async verifyCode(input: {
    ticketId: string;
    code: string;
    actorTelegramId?: string;
  }): Promise<{ result: OtpVerifyResult; attemptsLeft?: number }> {
    const res = await this.post('verify', `/internal/tickets/${input.ticketId}/otp/verify`, {
      code: input.code,
      ...(input.actorTelegramId !== undefined ? { actor_telegram_id: input.actorTelegramId } : {}),
    });
    this.assertOk(res, 'verify');
    const result = res.data['result'];
    if (typeof result !== 'string' || !(VERIFY_RESULTS as readonly string[]).includes(result)) {
      throw new ExternalServiceError(SERVICE, 'verify response carries unknown result');
    }
    const attemptsLeft = res.data['attempts_left'];
    return {
      result: result as OtpVerifyResult,
      ...(typeof attemptsLeft === 'number' ? { attemptsLeft } : {}),
    };
  }

  async skip(input: { ticketId: string; reason: OtpSkipReason; note?: string }): Promise<void> {
    const res = await this.post('skip', `/internal/tickets/${input.ticketId}/otp/skip`, {
      reason: input.reason,
      ...(input.note !== undefined ? { note: input.note } : {}),
    });
    this.assertOk(res, 'skip');
  }

  async resend(input: { ticketId: string }): Promise<OtpResendOutcome> {
    const res = await this.post('resend', `/internal/tickets/${input.ticketId}/otp/resend`, {});
    if (is2xx(res.status)) {
      const otpCode = res.data['otp_code'];
      if (typeof otpCode !== 'string' || otpCode === '') {
        throw new ExternalServiceError(SERVICE, 'resend response missing otp_code');
      }
      return { kind: 'ok', otpCode };
    }
    if (res.status === 409) {
      return JSON.stringify(res.data).includes(RESEND_LIMIT_MARKER)
        ? { kind: 'limit_reached' }
        : { kind: 'not_applicable' };
    }
    throw new ExternalServiceError(SERVICE, `resend returned ${res.status}`, {
      status: res.status,
    });
  }

  private async post(
    action: string,
    path: string,
    body: Record<string, unknown>,
  ): Promise<RpcResponse> {
    const url = `${this.config.baseUrl}${path}`;
    const start = Date.now();
    let res: { status: number; data: unknown };
    try {
      res = await this.http.post(url, body, {
        headers: {
          'content-type': 'application/json',
          'x-internal-secret': this.config.internalSecret,
        },
      });
    } catch (err) {
      throw new ExternalServiceError(SERVICE, `${action} transport failure`, {
        body: err instanceof Error ? err.message : String(err),
      });
    }
    this.logger.info({
      msg: 'external_call',
      module: 'telegram-otp',
      service: SERVICE,
      action,
      status: res.status,
      duration_ms: Date.now() - start,
    });
    const data =
      typeof res.data === 'object' && res.data !== null
        ? (res.data as Record<string, unknown>)
        : {};
    return { status: res.status, data };
  }

  private assertOk(res: RpcResponse, action: string): void {
    if (!is2xx(res.status)) {
      throw new ExternalServiceError(SERVICE, `${action} returned ${res.status}`, {
        status: res.status,
      });
    }
  }
}
