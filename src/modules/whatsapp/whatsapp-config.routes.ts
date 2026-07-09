// T26 — HTTP routes for WA config CRUD (spec §2.1 row 28 + ADR-0009).
// Mirrors T17-followup Telegram config route landing exactly. Thin
// layer: validate → call service → return masked view.
//
// Guard composition mirrors T17-followup: guards composed at API
// bootstrap so this plugin stays auth-agnostic.

import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';

import { AuthError, ValidationError } from '@core/errors/app-errors.js';

import { WhatsappConfigPutSchema } from './whatsapp-config.schema.js';
import type { WhatsappConfigService } from './whatsapp-config.service.js';

export interface WhatsappConfigRoutesOptions {
  readonly service: WhatsappConfigService;
  readonly guards: readonly preHandlerHookHandler[];
}

export const whatsappConfigRoutes: FastifyPluginAsync<WhatsappConfigRoutesOptions> = (
  fastify,
  opts,
) => {
  const preHandler = [...opts.guards] as preHandlerHookHandler[];

  fastify.get('/api/integrations/whatsapp', { preHandler }, async (req) => {
    const hotelId = requireHotelId(req.hotelId);
    return opts.service.getForHotel(hotelId);
  });

  fastify.put('/api/integrations/whatsapp', { preHandler }, async (req) => {
    const hotelId = requireHotelId(req.hotelId);
    const parsed = WhatsappConfigPutSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid whatsapp config payload', {
        issues: parsed.error.issues,
      });
    }
    return opts.service.upsertForHotel(hotelId, parsed.data);
  });

  return Promise.resolve();
};

function requireHotelId(candidate: string | undefined): string {
  if (candidate === undefined || candidate === '') {
    throw new AuthError('Tenant scope missing on request');
  }
  return candidate;
}
