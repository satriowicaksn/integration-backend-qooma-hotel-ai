/**
 * WhatsApp inbound webhook ingest service — 2-leg orchestrator per spec
 * `MVP §4.7` (persist-fast-return-200) + `04 §7 L351` (async retry from
 * `webhook_events` queue).
 *
 * Ctor `(eventsRepo, guestPort, aiPort, logger)`. Direct imports for pure
 * helpers per ADR-0001 (no wrap-on-wrap). Both ports are TYPE-ONLY at this
 * primitive (Q-B-04/05 unratified); adapters land at T12-followup.
 */

import { ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { maskWaPhone } from '@shared/utils/masking.js';

import type { AiInboundMessagePort } from './ports/ai-inbound-message.port.js';
import type { HotelCoreGuestUpsertPort } from './ports/hotel-core-guest-upsert.port.js';
import type { WhatsappWebhookEventsRepository } from './whatsapp-webhook-events.repository.js';
import {
  WhatsappInboundEnvelopeSchema,
  extractInboundMessages,
} from './whatsapp-webhook-ingest.schema.js';
import type {
  WhatsappInboundEnvelopeDto,
  WhatsappInboundIngestResponseDto,
} from './whatsapp-webhook-ingest.schema.js';
import type { IngestOutcome, WebhookEventProvider } from './whatsapp-webhook-ingest.types.js';

const PROVIDER: WebhookEventProvider = 'whatsapp';
const LOG_MODULE = 'whatsapp';
const LOG_INGEST_SYNC = 'whatsapp_inbound_ingest.persist';
const LOG_PROCESS_EVENT = 'whatsapp_inbound_ingest.process';
const LOG_PROCESS_MESSAGE = 'whatsapp_inbound_ingest.message';

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export class WhatsappInboundIngestService {
  constructor(
    private readonly eventsRepo: WhatsappWebhookEventsRepository,
    private readonly guestPort: HotelCoreGuestUpsertPort,
    private readonly aiPort: AiInboundMessagePort,
    private readonly logger: Logger,
  ) {}

  /**
   * Sync leg — persists the raw payload to `webhook_events` and returns the
   * event id. Called by the T12-followup router as the fast path so the
   * response can hit Meta within the 10s timeout budget (`MVP §4.7`).
   *
   * **HMAC-agnostic**: signature verification lives at the T04 HMAC plugin
   * (router-layer preHandler); this service consumes `signatureValid` as a
   * trusted boolean parameter. GAP T12-#1 (Q-A-04 vs MVP §4.2 secret-choice)
   * is decided at wiring time — this primitive is genuinely agnostic.
   *
   * **Persist-always**: the `webhook_events.signature_valid` column (DDL
   * §4.4 L226 `NOT NULL`) mandates audit-trail for spoofed requests too; the
   * flag is stored, the service does not gate persistence on it.
   *
   * Throws **only** `ValidationError` on schema parse failure — no other
   * throw path.
   *
   * `isDuplicate` in the response is always `false` in primitive (Q-B-06 D
   * deferred stamp — dedup lands at T12-followup after schema-add).
   */
  async ingestSync(
    hotelId: string,
    signatureValid: boolean,
    envelope: unknown,
  ): Promise<WhatsappInboundIngestResponseDto> {
    const parsed = WhatsappInboundEnvelopeSchema.safeParse(envelope);
    if (!parsed.success) {
      throw new ValidationError('Invalid WhatsApp inbound webhook envelope', {
        issues: parsed.error.issues,
      });
    }

    const event = await this.eventsRepo.persist({
      hotelId,
      provider: PROVIDER,
      signatureValid,
      payload: parsed.data,
    });

    this.logger.info({
      msg: LOG_INGEST_SYNC,
      module: LOG_MODULE,
      hotelId,
      eventId: event.id,
      signatureValid,
      messageCount: extractInboundMessages(parsed.data).length,
    });

    return { eventId: event.id, isDuplicate: false };
  }

  /**
   * Async leg — called by the T12-followup worker for each unprocessed
   * `webhook_events` row. Extracts normalized messages via
   * `extractInboundMessages`, resolves each guest via the HC RPC, dispatches
   * each to the AI RPC, and marks the event `processed` on success or
   * `failed` on any downstream error.
   *
   * **Never throws — worker discipline.** All failure paths return rich
   * `IngestOutcome[]` with `error` fields set + call `markFailed`.
   * Router / worker at T12-followup reads outcomes for observability; retry
   * is via `webhook_events` queue per spec §7 L351. This mirrors the T11
   * probe-semantics precedent applied to a worker-called method.
   *
   * Empty-messages branch (delivery receipts → T15, template status → T16
   * per GAP T12-#7 A) → marks processed with `[]`, does not touch HC or AI.
   */
  async processEvent(
    eventId: string,
    hotelId: string,
    envelope: WhatsappInboundEnvelopeDto,
  ): Promise<IngestOutcome[]> {
    const messages = extractInboundMessages(envelope);

    this.logger.info({
      msg: LOG_PROCESS_EVENT,
      module: LOG_MODULE,
      hotelId,
      eventId,
      messageCount: messages.length,
    });

    if (messages.length === 0) {
      await this.markProcessedSafely(eventId);
      return [];
    }

    const outcomes: IngestOutcome[] = [];
    let anyFailure = false;
    let firstError: string | undefined;

    for (const message of messages) {
      const outcome = await this.processSingleMessage(hotelId, message);
      outcomes.push(outcome);
      if (!outcome.dispatched) {
        anyFailure = true;
        if (firstError === undefined && outcome.error !== undefined) {
          firstError = outcome.error;
        }
      }
    }

    if (anyFailure) {
      // Invariant: `processSingleMessage` always sets `error` when `dispatched: false`
      // (both catch blocks). `firstError` therefore defined whenever `anyFailure` is.
      await this.markFailedSafely(eventId, firstError as string);
    } else {
      await this.markProcessedSafely(eventId);
    }

    return outcomes;
  }

  private async processSingleMessage(
    hotelId: string,
    message: { messageId: string; waPhone: string; body: string; profileName?: string | undefined },
  ): Promise<IngestOutcome> {
    this.logger.info({
      msg: LOG_PROCESS_MESSAGE,
      module: LOG_MODULE,
      hotelId,
      messageId: message.messageId,
      waPhone: maskWaPhone(message.waPhone),
    });

    let guestId: string;
    try {
      const upsertInput = {
        hotelId,
        waPhone: message.waPhone,
        ...(message.profileName !== undefined ? { name: message.profileName } : {}),
      };
      const upsertResult = await this.guestPort.upsertGuestByWaPhone(upsertInput);
      guestId = upsertResult.guestId;
    } catch (err) {
      return {
        messageId: message.messageId,
        dispatched: false,
        error: `guest_upsert: ${errorMessage(err)}`,
      };
    }

    try {
      await this.aiPort.inboundWaMessage({
        hotelId,
        guestId,
        body: message.body,
        messageId: message.messageId,
      });
    } catch (err) {
      return {
        messageId: message.messageId,
        guestId,
        dispatched: false,
        error: `ai_inbound: ${errorMessage(err)}`,
      };
    }

    return {
      messageId: message.messageId,
      guestId,
      dispatched: true,
    };
  }

  private async markProcessedSafely(eventId: string): Promise<void> {
    try {
      await this.eventsRepo.markProcessed(eventId, new Date());
    } catch (err) {
      this.logger.error({
        msg: 'whatsapp_inbound_ingest.mark_processed_failed',
        module: LOG_MODULE,
        eventId,
        error: errorMessage(err),
      });
    }
  }

  private async markFailedSafely(eventId: string, error: string): Promise<void> {
    try {
      await this.eventsRepo.markFailed(eventId, { error });
    } catch (err) {
      this.logger.error({
        msg: 'whatsapp_inbound_ingest.mark_failed_failed',
        module: LOG_MODULE,
        eventId,
        error: errorMessage(err),
      });
    }
  }
}
