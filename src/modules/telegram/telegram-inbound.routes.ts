// HTTP route for T19-followup inbound webhook landing
// (spec 04-integration-channels.md §2.3 row 74 + §3.2 + §4.6-4.7).
//
// preHandler order (matters):
//   1. resolveTenantFromSlug  — populates req.hotelId from URL slug
//   2. verifyWebhookSignature — Telegram X-Telegram-Bot-Api-Secret-Token
//
// The signature guard MUST come AFTER tenancy so `resolveSecret` can read
// the per-hotel bot_token via `req.hotelId`. An unknown slug → 404 before
// any signature check.
//
// Handler discipline (spec §4.7): return 200 within 10s. Persist raw
// payload first, dispatch synchronously against stubbed HC ports (queue
// worker deferred per PLAN GAP #5). Errors during dispatch are logged
// but do NOT surface to Telegram — the signature was valid, the ack is
// warranted.

import type { FastifyPluginAsync, FastifyRequest, preHandlerHookHandler } from 'fastify';

import { ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { TelegramUpdateSchema } from './telegram-inbound.schema.js';
import type { TelegramInboundService } from './telegram-inbound.service.js';
import type { TelegramWebhookEventsRepository } from './telegram-webhook-events.repository.js';

export interface TelegramInboundRoutesOptions {
  readonly service: TelegramInboundService;
  readonly repo: TelegramWebhookEventsRepository;
  readonly tenantResolver: (req: FastifyRequest) => Promise<void>;
  readonly signatureGuard: (req: FastifyRequest) => Promise<void>;
  readonly logger: Logger;
}

export const telegramInboundRoutes: FastifyPluginAsync<TelegramInboundRoutesOptions> = (
  fastify,
  opts,
) => {
  const preHandler: preHandlerHookHandler[] = [
    (req, _reply, done) => {
      opts.tenantResolver(req).then(
        () => done(),
        (err: unknown) => done(err as Error),
      );
    },
    (req, _reply, done) => {
      opts.signatureGuard(req).then(
        () => done(),
        (err: unknown) => done(err as Error),
      );
    },
  ];

  fastify.post('/webhook/telegram/:hotel_slug', { preHandler }, async (req) => {
    const hotelId = requireHotelId(req.hotelId);
    const parsed = TelegramUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid Telegram update payload', {
        issues: parsed.error.issues,
      });
    }
    // Persist first (spec §4.6-4.7 idempotency floor). Repository owns
    // the JSON round-trip so we can hand off the parsed shape as-is.
    await opts.repo.persist({
      hotelId,
      signatureValid: true,
      payload: parsed.data,
    });
    // Dispatch synchronously; do NOT propagate downstream errors —
    // Telegram already sees a valid signature and expects a 200.
    try {
      await opts.service.handleUpdate(hotelId, parsed.data);
    } catch (err) {
      opts.logger.error({
        msg: 'telegram_inbound.dispatch_failed',
        module: 'telegram',
        hotelId,
        errCode: err instanceof Error ? err.name : 'unknown',
      });
    }
    return { ok: true };
  });

  return Promise.resolve();
};

function requireHotelId(candidate: string | undefined): string {
  if (candidate === undefined || candidate === '') {
    // Defensive: `resolveTenantFromSlug` would have thrown NotFoundError.
    // If we reach here without a hotelId, treat as validation error.
    throw new ValidationError('Tenant scope missing on request');
  }
  return candidate;
}
