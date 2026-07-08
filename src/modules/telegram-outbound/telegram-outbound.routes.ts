// HTTP route for T20 outbound dispatch RPC (spec §2.4 row 84 +
// §4.11 internal RPC auth). Thin layer: zod validate → call service →
// map snake_case wire ↔ camelCase domain.
//
// Route landing convention mirrors T17-followup (`telegram.routes.ts`):
// guards composed at API bootstrap so this plugin stays auth-agnostic.

import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';

import { ValidationError } from '@core/errors/app-errors.js';

import { SendTelegramMessageRequestSchema } from './telegram-outbound.schema.js';
import type { TelegramDispatchService } from './telegram-outbound.service.js';
import type { SendTelegramMessageInput } from './telegram-outbound.types.js';

export interface TelegramOutboundRoutesOptions {
  readonly service: TelegramDispatchService;
  readonly guards: readonly preHandlerHookHandler[];
}

export const telegramOutboundRoutes: FastifyPluginAsync<TelegramOutboundRoutesOptions> = (
  fastify,
  opts,
) => {
  const preHandler = [...opts.guards] as preHandlerHookHandler[];

  fastify.post('/rpc/send_telegram_message', { preHandler }, async (req) => {
    const parsed = SendTelegramMessageRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid send_telegram_message payload', {
        issues: parsed.error.issues,
      });
    }
    const dto = parsed.data;
    const input: SendTelegramMessageInput = {
      hotelId: dto.hotel_id,
      chatId: dto.chat_id,
      body: dto.body,
      ...(dto.parse_mode !== undefined ? { parseMode: dto.parse_mode } : {}),
    };
    const result = await opts.service.sendMessage(input);
    return {
      message_id: result.messageId,
      sent_at: result.sentAt.toISOString(),
    };
  });

  return Promise.resolve();
};
