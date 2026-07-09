// T27 inbound-webhook composition helper.
//
// This module composes the two T29 conversations upserts (per-message
// insert with `direction=inbound`, `status=received`, `unreadCount+=1`,
// preview truncated to 200 chars) around the existing T12 async
// orchestrator (`ingestService.processEvent` → HC guest upsert stub →
// AI inbound stub). Called from the sync webhook route AFTER the
// webhook_events row is already persisted; keeps the T12 primitive
// intact per PLAN "primitive called, not modified".
//
// **PII floor** (T27 PLAN CRITICAL binding + PM C REJECT-partial #11):
// - message `body` is NEVER in any log payload here.
// - only `bodyLength` + last-4 `waPhone` surface via masking.
//
// Not a Bull processor today (worker.ts still uses the interval-based
// cron pattern from T21-fu / T24-fu-B). Sync callers use it directly;
// a future Bull wrapper can queue this same function.

import type { Logger } from '@core/logger/logger.js';

import { maskWaPhone } from '@shared/utils/masking.js';

import type { WhatsappConversationsService } from './whatsapp-conversations.service.js';
import type { WhatsappInboundIngestService } from './whatsapp-inbound-ingest.service.js';
import {
  type WhatsappInboundEnvelopeDto,
  extractInboundMessages,
} from './whatsapp-webhook-ingest.schema.js';
import type { IngestOutcome } from './whatsapp-webhook-ingest.types.js';

export interface ProcessInboundWebhookInput {
  readonly eventId: string;
  readonly hotelId: string;
  readonly waConfigId: string;
  readonly envelope: WhatsappInboundEnvelopeDto;
}

export interface ProcessInboundWebhookDeps {
  readonly conversationsService: WhatsappConversationsService;
  readonly ingestService: WhatsappInboundIngestService;
  readonly logger: Logger;
}

const LOG_MODULE = 'whatsapp';
const LOG_MSG_UPSERT_FAILED = 'whatsapp_inbound.conversations_upsert_failed';
const LOG_MSG_MESSAGE = 'whatsapp_inbound.per_message';

/**
 * Compose per-message conversations upsert with T12's guest+AI async
 * orchestrator.
 *
 * Errors on the conversations upsert are logged + swallowed (webhook_
 * events row already contains the raw payload for retry / diagnosis).
 * Errors inside `processEvent` bubble up to the caller so a Bull retry
 * wrapper can back off. The route handler catches any bubble to keep
 * the Meta ack path 200.
 */
export async function processInboundWebhook(
  input: ProcessInboundWebhookInput,
  deps: ProcessInboundWebhookDeps,
): Promise<IngestOutcome[]> {
  const messages = extractInboundMessages(input.envelope);
  const receivedAt = new Date();

  for (const message of messages) {
    deps.logger.info({
      msg: LOG_MSG_MESSAGE,
      module: LOG_MODULE,
      hotelId: input.hotelId,
      messageId: message.messageId,
      waPhone: maskWaPhone(message.waPhone),
      bodyLength: message.body.length,
    });
    try {
      await deps.conversationsService.upsertOnInbound({
        hotelId: input.hotelId,
        waConfigId: input.waConfigId,
        guestWaPhone: message.waPhone,
        body: message.body,
        externalMessageId: message.messageId,
        webhookEventId: input.eventId,
        receivedAt,
      });
    } catch (err) {
      deps.logger.error({
        msg: LOG_MSG_UPSERT_FAILED,
        module: LOG_MODULE,
        hotelId: input.hotelId,
        messageId: message.messageId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return deps.ingestService.processEvent(input.eventId, input.hotelId, input.envelope);
}
