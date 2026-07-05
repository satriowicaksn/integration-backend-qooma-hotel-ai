/**
 * WhatsApp delivery receipts ingest service — receiver-only sync orchestrator
 * for the `statuses` branch of the shared Meta webhook stream (spec §2.3 +
 * §3.1 L106).
 *
 * Ctor `(repo, logger)`. Direct imports for pure helpers per ADR-0001.
 * Single-method sync (`ingestStatuses`) — no async worker leg needed
 * (receiver-only, no HC / no AI RPCs).
 *
 * **HMAC-agnostic**: signature verification lives at the T04 HMAC plugin
 * (router-layer preHandler); this service consumes `signatureValid` as a
 * trusted boolean parameter. T12 precedent extended to the statuses branch.
 *
 * **Router-boundary**: T15-followup router discriminates payload branch
 * (`messages` → T12, `statuses` → T15, template branch → T16) and persists
 * the `webhook_events` audit row ONCE via T12's
 * `WhatsappWebhookEventsRepository.persist` BEFORE calling this service. No
 * cross-service RPCs — receiver-only flow.
 *
 * **Orphans**: `externalId` not in `outbound_dispatch_queue` (late / spoofed
 * / foreign receipts) skipped + logged warn + counted in `orphanCount`. Never
 * throws per-status. Sync worker-discipline extended from T11 probe + T12
 * async patterns (T12 tolerated-deviation lesson pre-applied: outcome shape
 * is a discriminated union — no `as string` needed).
 */

import { ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { maskWaPhone } from '@shared/utils/masking.js';

import type { WhatsappDeliveryReceiptsRepository } from './whatsapp-delivery-receipts.repository.js';
import {
  WhatsappDeliveryStatusesEnvelopeSchema,
  extractStatuses,
} from './whatsapp-delivery-receipts.schema.js';
import type {
  DeliveryReceiptIngestOutcome,
  DeliveryReceiptStatus,
  WhatsappDeliveryReceiptsIngestResult,
  WhatsappStatusEntry,
} from './whatsapp-delivery-receipts.types.js';

const LOG_MODULE = 'whatsapp';
const LOG_INGEST = 'whatsapp_delivery_receipts.ingest';
const LOG_RECEIPT = 'whatsapp_delivery_receipts.receipt';
const LOG_ORPHAN = 'whatsapp_delivery_receipts.orphan';
const LOG_PERSIST_FAIL = 'whatsapp_delivery_receipts.persist_failed';

const ORPHAN_REASON = 'orphan_no_dispatch';

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export class WhatsappDeliveryReceiptsService {
  constructor(
    private readonly repo: WhatsappDeliveryReceiptsRepository,
    private readonly logger: Logger,
  ) {}

  async ingestStatuses(
    hotelId: string,
    envelope: unknown,
    signatureValid: boolean,
  ): Promise<WhatsappDeliveryReceiptsIngestResult> {
    const parsed = WhatsappDeliveryStatusesEnvelopeSchema.safeParse(envelope);
    if (!parsed.success) {
      throw new ValidationError('Invalid WhatsApp delivery statuses envelope', {
        issues: parsed.error.issues,
      });
    }

    const statuses = extractStatuses(parsed.data);

    this.logger.info({
      msg: LOG_INGEST,
      module: LOG_MODULE,
      hotelId,
      signatureValid,
      statusCount: statuses.length,
    });

    const receipts: DeliveryReceiptIngestOutcome[] = [];
    let orphanCount = 0;

    for (const entry of statuses) {
      const outcome = await this.processStatusEntry(hotelId, entry);
      receipts.push(outcome);
      if (!outcome.dispatched && outcome.error === ORPHAN_REASON) {
        orphanCount += 1;
      }
    }

    return { receipts, orphanCount };
  }

  private async processStatusEntry(
    hotelId: string,
    entry: WhatsappStatusEntry,
  ): Promise<DeliveryReceiptIngestOutcome> {
    this.logger.info({
      msg: LOG_RECEIPT,
      module: LOG_MODULE,
      hotelId,
      externalId: entry.externalId,
      status: entry.status,
      ...(entry.recipientId !== undefined ? { recipientId: maskWaPhone(entry.recipientId) } : {}),
    });

    let dispatch: { id: string } | null;
    try {
      dispatch = await this.repo.findDispatchByExternalId(hotelId, entry.externalId);
    } catch (err) {
      return this.buildFailure(entry, `dispatch_lookup: ${errorMessage(err)}`);
    }

    if (dispatch === null) {
      this.logger.warn({
        msg: LOG_ORPHAN,
        module: LOG_MODULE,
        hotelId,
        externalId: entry.externalId,
        status: entry.status,
      });
      return this.buildFailure(entry, ORPHAN_REASON);
    }

    try {
      const persisted = await this.repo.persist({
        hotelId,
        dispatchId: dispatch.id,
        externalId: entry.externalId,
        status: entry.status,
      });
      return {
        externalId: entry.externalId,
        status: entry.status,
        dispatched: true,
        receiptId: persisted.id,
      };
    } catch (err) {
      this.logger.error({
        msg: LOG_PERSIST_FAIL,
        module: LOG_MODULE,
        hotelId,
        externalId: entry.externalId,
        status: entry.status,
        error: errorMessage(err),
      });
      return this.buildFailure(entry, `persist: ${errorMessage(err)}`);
    }
  }

  private buildFailure(
    entry: { externalId: string; status: DeliveryReceiptStatus },
    error: string,
  ): DeliveryReceiptIngestOutcome {
    return {
      externalId: entry.externalId,
      status: entry.status,
      dispatched: false,
      error,
    };
  }
}
