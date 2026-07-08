// HTTP routes for Telegram config CRUD (spec §2.1 C1). Thin layer:
// validate → call service → return. Tenant scope comes from the signed
// JWT (`req.hotelId` populated by `jwtAuthGuard` per Q-C-04 resolution).
//
// Route landing convention (T17-followup):
// - guards are composed at the API bootstrap layer (`api.ts`) so the
//   plugin stays JWT-agnostic — makes it trivial to unit-test the routes
//   with a fake guard or omit auth for local scaffolding.

import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';

import { AuthError, ValidationError } from '@core/errors/app-errors.js';

import { TelegramConfigPutSchema } from './telegram.schema.js';
import type { TelegramConfigService } from './telegram.service.js';

export interface TelegramRoutesOptions {
  readonly service: TelegramConfigService;
  readonly guards: readonly preHandlerHookHandler[];
}

export const telegramRoutes: FastifyPluginAsync<TelegramRoutesOptions> = (fastify, opts) => {
  const preHandler = [...opts.guards] as preHandlerHookHandler[];

  fastify.get('/api/integrations/telegram', { preHandler }, async (req) => {
    const hotelId = requireHotelId(req.hotelId);
    return opts.service.get(hotelId);
  });

  fastify.put('/api/integrations/telegram', { preHandler }, async (req) => {
    const hotelId = requireHotelId(req.hotelId);
    // Zod is the source-of-truth schema; Fastify's built-in AJV path
    // expects JSON Schema, so we validate here. Sets the T##-followup
    // convention: `<Schema>.safeParse` inside the handler, throw
    // `ValidationError` on failure so the T08 error-handler renders the
    // canonical 400 envelope.
    const parsed = TelegramConfigPutSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid telegram config payload', {
        issues: parsed.error.issues,
      });
    }
    return opts.service.upsert(hotelId, parsed.data);
  });

  return Promise.resolve();
};

function requireHotelId(candidate: string | undefined): string {
  if (candidate === undefined || candidate === '') {
    // Defensive: jwtAuthGuard is expected to populate this. If a caller
    // wires the route without a JWT guard by mistake we prefer an
    // `AuthError` over a leaky `undefined` hotelId reaching the service.
    throw new AuthError('Tenant scope missing on request');
  }
  return candidate;
}
