/**
 * Internal RPC route for T28 WA outbound dispatch (ADR-0009, spec §2.4).
 * Guarded by `internalRpcAuthGuard` (T09; `X-Internal-Secret` header,
 * spec §4.11) — NOT JWT. HC calls this on behalf of the CRM.
 *
 * Composition:
 *   1. safeParse wire → 400 VALIDATION_ERROR on failure
 *   2. call T13 `WhatsappOutboundDispatchService.dispatchMessage` — service
 *      throws `NotFoundError('wa_config', hotelId)` when the caller hotel
 *      has no WA config row; returned outcome discriminates on `kind`.
 *   3. on `dispatched` or `meta_failed` outcomes → call T29
 *      `WhatsappConversationsService.upsertOnOutbound(...)` so the message
 *      appears in the conversation view with the correct status,
 *      externalMessageId (if any), and `dispatchId` FK. `rejected_dnd` and
 *      `quota_exhausted` DO NOT touch conversations — no send happened.
 *   4. wire response: `{ kind, dispatch_id?, external_message_id?, reason?,
 *      status?, body? }` (snake_case). Uses the discriminated union to
 *      avoid `as` casts.
 */

import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';

import { ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import type { WhatsappConversationsService } from './whatsapp-conversations.service.js';
import { DispatchRequestSchema, type DispatchRequestDto } from './whatsapp-dispatch.schema.js';
import type { WhatsappOutboundDispatchService } from './whatsapp-outbound-dispatch.service.js';
import type { OutboundDispatchOutcome } from './whatsapp-outbound-dispatch.types.js';

export interface WhatsappDispatchRoutesOptions {
  readonly dispatchService: WhatsappOutboundDispatchService;
  readonly conversationsService: WhatsappConversationsService;
  readonly guards: readonly preHandlerHookHandler[];
  readonly logger: Logger;
}

const LOG_MODULE = 'whatsapp';
const LOG_MSG_MESSAGES_UPSERT_FAILED = 'whatsapp_dispatch.messages_upsert_failed';

export const whatsappDispatchRoutes: FastifyPluginAsync<WhatsappDispatchRoutesOptions> = (
  fastify,
  opts,
) => {
  const preHandler = [...opts.guards] as preHandlerHookHandler[];

  fastify.post('/internal/wa/dispatch', { preHandler }, async (req) => {
    const parsed = DispatchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid dispatch payload', { issues: parsed.error.issues });
    }
    const dto = parsed.data;

    const outcome = await opts.dispatchService.dispatchMessage(toServiceRequest(dto));

    // Sequential messages upsert per PM ACK GAP T28-#1 (option a):
    // conversations upsert failure is logged but does NOT overturn the
    // dispatch outcome — HC already saw the message go out.
    if (outcome.kind === 'dispatched' || outcome.kind === 'meta_failed') {
      try {
        await opts.conversationsService.upsertOnOutbound({
          hotelId: dto.hotel_id,
          waConfigId: dto.wa_config_id ?? dto.hotel_id,
          guestWaPhone: dto.to_wa_phone,
          body: 'body' in dto ? dto.body : null,
          templateRef: 'template' in dto ? dto.template.name : null,
          templateVariables: 'template' in dto ? (dto.template.variables ?? null) : null,
          externalMessageId: outcome.kind === 'dispatched' ? outcome.externalId : null,
          dispatchId: outcome.dispatchId,
          status: outcome.kind === 'dispatched' ? 'sent' : 'failed',
          sentAt: outcome.kind === 'dispatched' ? new Date() : null,
        });
      } catch (err) {
        opts.logger.error({
          msg: LOG_MSG_MESSAGES_UPSERT_FAILED,
          module: LOG_MODULE,
          hotelId: dto.hotel_id,
          dispatchId: outcome.dispatchId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return toWireResponse(outcome);
  });

  return Promise.resolve();
};

function toServiceRequest(dto: DispatchRequestDto): Record<string, unknown> {
  const base = {
    hotelId: dto.hotel_id,
    guestId: dto.guest_id,
    recipientPhone: dto.to_wa_phone,
  };
  if ('template' in dto) {
    const variables = dto.template.variables;
    return {
      ...base,
      template: {
        name: dto.template.name,
        languageCode: dto.template.language_code,
        ...(variables !== undefined ? { variables } : {}),
      },
    };
  }
  return { ...base, body: dto.body };
}

function toWireResponse(outcome: OutboundDispatchOutcome): Record<string, unknown> {
  switch (outcome.kind) {
    case 'dispatched':
      return {
        kind: 'dispatched',
        dispatch_id: outcome.dispatchId,
        external_message_id: outcome.externalId,
      };
    case 'rejected_dnd':
      return { kind: 'rejected_dnd', reason: outcome.reason };
    case 'quota_exhausted':
      return { kind: 'quota_exhausted', reason: outcome.reason };
    case 'meta_failed':
      return {
        kind: 'meta_failed',
        dispatch_id: outcome.dispatchId,
        ...(outcome.status !== undefined ? { status: outcome.status } : {}),
        ...(outcome.body !== undefined ? { body: outcome.body } : {}),
      };
  }
}
