// HTTP route for T27 Meta-facing WhatsApp inbound webhook
// (spec 04-integration-channels.md §2.3 + §3.1 + §4.6-4.7).
//
// preHandler order (matters — T19-fu bindings #8 + #13):
//   1. resolveTenantFromSlug  — populates req.hotelId from URL slug.
//       Unknown slug → 404 BEFORE any signature check (anti-enumeration).
//   2. verifyWebhookSignature — Meta X-Hub-Signature-256, HMAC over raw
//       body with `webhook_verify_token` as the shared secret (Q-A-04
//       parked, MVP §4.2). Bad sig → 401 BEFORE persist.
//
// Handler discipline (spec §4.7): return 200 within 10s. Persist raw
// payload first, then invoke the T27 composition helper. Any error
// AFTER persist is logged but NEVER surfaces to Meta — the signature
// was valid, the ack is warranted.

import type { FastifyPluginAsync, FastifyRequest, preHandlerHookHandler } from 'fastify';

import { ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import type { WhatsappConversationsService } from './whatsapp-conversations.service.js';
import type { WhatsappInboundIngestService } from './whatsapp-inbound-ingest.service.js';
import { processInboundWebhook } from './whatsapp-inbound.jobs.js';
import { WhatsappInboundEnvelopeSchema } from './whatsapp-webhook-ingest.schema.js';

export interface WhatsappWebhookRoutesOptions {
  readonly ingestService: WhatsappInboundIngestService;
  readonly conversationsService: WhatsappConversationsService;
  readonly tenantResolver: (req: FastifyRequest) => Promise<void>;
  readonly signatureGuard: (req: FastifyRequest) => Promise<void>;
  readonly logger: Logger;
}

const LOG_MODULE = 'whatsapp';
const LOG_MSG_DISPATCH_FAILED = 'whatsapp_inbound.dispatch_failed';

export const whatsappWebhookRoutes: FastifyPluginAsync<WhatsappWebhookRoutesOptions> = (
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

  fastify.post('/webhook/whatsapp/:hotel_slug', { preHandler }, async (req) => {
    const hotelId = requireHotelId(req.hotelId);
    // Persist FIRST (spec §4.6-4.7). Sync leg only touches
    // webhook_events + returns eventId; per-message conversations
    // upsert + guest/AI orchestration happens BELOW.
    const ingest = await opts.ingestService.ingestSync(hotelId, true, req.body);

    // Compose T29 conversations upsert + T12 async orchestrator.
    // WA config PK is hotelId (see prisma/schema.prisma), so
    // waConfigId === hotelId.
    try {
      await processInboundWebhook(
        {
          eventId: ingest.eventId,
          hotelId,
          waConfigId: hotelId,
          envelope: WhatsappInboundEnvelopeSchema.parse(req.body),
        },
        {
          conversationsService: opts.conversationsService,
          ingestService: opts.ingestService,
          logger: opts.logger,
        },
      );
    } catch (err) {
      opts.logger.error({
        msg: LOG_MSG_DISPATCH_FAILED,
        module: LOG_MODULE,
        hotelId,
        eventId: ingest.eventId,
        errCode: err instanceof Error ? err.name : 'unknown',
      });
    }
    return { ok: true };
  });

  return Promise.resolve();
};

function requireHotelId(candidate: string | undefined): string {
  if (candidate === undefined || candidate === '') {
    throw new ValidationError('Tenant scope missing on request');
  }
  return candidate;
}
