/**
 * Internal RPC route `POST /internal/telegram/dispatch` (spec §2.4 row 88,
 * T97/ADD-24). Guarded by `internalRpcAuthGuard` (`X-Internal-Secret`) —
 * Hotel Core's escalation worker calls this to ping dept groups.
 *
 * Plain dispatch (backward-compatible surface): `{ hotel_id, chat_id, body,
 * parse_mode? }` → `TelegramDispatchService.sendMessage`.
 *
 * OTP dispatch (ADD-24): `requires_otp: true` + `ticket_id` routes through
 * the injected `OtpNotifyHandler`, which attaches the 4-button inline
 * keyboard, registers the posted `message_id` with Hotel Core, and persists
 * the local resend context. The handler is a structural interface so this
 * module never imports `@modules/telegram-otp` internals.
 */

import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';

import { ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { SendTelegramMessageRequestSchema } from './telegram-outbound.schema.js';
import type { TelegramDispatchService } from './telegram-outbound.service.js';
import type { TelegramParseMode, TelegramSendResult } from './telegram-outbound.types.js';

export interface OtpNotifyInput {
  readonly hotelId: string;
  readonly chatId: string;
  readonly body: string;
  readonly parseMode?: TelegramParseMode;
  readonly ticketId: string;
  readonly guestWaPhone?: string;
  readonly guestId?: string;
}

export interface OtpNotifyHandler {
  notifyTicket(input: OtpNotifyInput): Promise<TelegramSendResult>;
}

export interface TelegramOutboundRoutesOptions {
  readonly dispatchService: TelegramDispatchService;
  readonly otpNotifier: OtpNotifyHandler;
  readonly guards: readonly preHandlerHookHandler[];
  readonly logger: Logger;
}

export const telegramOutboundRoutes: FastifyPluginAsync<TelegramOutboundRoutesOptions> = (
  fastify,
  opts,
) => {
  const preHandler = [...opts.guards] as preHandlerHookHandler[];

  fastify.post('/internal/telegram/dispatch', { preHandler }, async (req) => {
    const parsed = SendTelegramMessageRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid telegram dispatch payload', {
        issues: parsed.error.issues,
      });
    }
    const dto = parsed.data;

    const result =
      dto.requires_otp === true && dto.ticket_id !== undefined
        ? await opts.otpNotifier.notifyTicket({
            hotelId: dto.hotel_id,
            chatId: dto.chat_id,
            body: dto.body,
            ...(dto.parse_mode !== undefined ? { parseMode: dto.parse_mode } : {}),
            ticketId: dto.ticket_id,
            ...(dto.guest_wa_phone !== undefined ? { guestWaPhone: dto.guest_wa_phone } : {}),
            ...(dto.guest_id !== undefined ? { guestId: dto.guest_id } : {}),
          })
        : await opts.dispatchService.sendMessage({
            hotelId: dto.hotel_id,
            chatId: dto.chat_id,
            body: dto.body,
            ...(dto.parse_mode !== undefined ? { parseMode: dto.parse_mode } : {}),
          });

    return {
      message_id: result.messageId,
      sent_at: result.sentAt.toISOString(),
    };
  });

  return Promise.resolve();
};
