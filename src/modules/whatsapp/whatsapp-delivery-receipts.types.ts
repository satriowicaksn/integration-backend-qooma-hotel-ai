/**
 * Domain types for the T15 WhatsApp delivery receipts ingest primitive.
 *
 * T15 is the **statuses branch** handler of the shared Meta webhook stream
 * (spec §2.3 endpoint carries `messages` → T12, `statuses` → T15, template
 * status → T16). The primitive is receiver-only — no external HTTP callers,
 * no HC / no AI RPCs. See `whatsapp-delivery-receipts.service.ts` for the
 * router-boundary + HMAC-agnostic + orphan-outcome doctrine.
 *
 * **Q-B-07 stamp** (optional future enhancement, not applied in primitive) —
 * `delivery_receipts` DDL (§4.6) has only a status CHECK constraint, NO
 * UNIQUE on `(dispatch_id, external_id, status)` triple. Multi-row per triple
 * is native to the delivery status progression `sent → delivered → read`.
 * Meta retry on network timeout MAY produce true duplicates for the same
 * triple; Q-B-07 proposes a UNIQUE index + `ON CONFLICT DO NOTHING` upsert
 * semantic at T15-followup. Primitive accepts multi-row.
 *
 * Per-status outcome is encoded as a **discriminated union** (binding
 * condition #18) so consumers get compile-time enforcement of the
 * `receiptId`-when-dispatched invariant without any `as` casts.
 */

export type DeliveryReceiptStatus = 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Normalized status entry extracted from Meta's `entry[].changes[].value.statuses[]`.
 * `recipientId` is the WA phone that RECEIVED the message (E.164, no `+`);
 * masked via `maskWaPhone` in logs (PII floor).
 */
export interface WhatsappStatusEntry {
  readonly externalId: string;
  readonly status: DeliveryReceiptStatus;
  readonly timestamp: string;
  readonly recipientId?: string | undefined;
}

/**
 * Repository write shape — mirrors the `delivery_receipts` DDL (§4.6):
 *  - `dispatchId` NOT NULL FK to `outbound_dispatch_queue.id`
 *  - `externalId` NOT NULL VARCHAR(80)
 *  - `status` NOT NULL VARCHAR(20) with CHECK constraint
 */
export interface DeliveryReceiptPersistenceInput {
  readonly hotelId: string;
  readonly dispatchId: string;
  readonly externalId: string;
  readonly status: DeliveryReceiptStatus;
}

/**
 * Discriminated union — TypeScript proves `receiptId` is present when
 * `dispatched: true` and `error` is present when `dispatched: false`. No
 * `as string` / `as X` casts needed anywhere in service or tests.
 */
export type DeliveryReceiptIngestOutcome =
  | {
      readonly externalId: string;
      readonly status: DeliveryReceiptStatus;
      readonly dispatched: true;
      readonly receiptId: string;
    }
  | {
      readonly externalId: string;
      readonly status: DeliveryReceiptStatus;
      readonly dispatched: false;
      readonly error: string;
    };

/** Service return shape — rich outcome per status + orphan count aggregate. */
export interface WhatsappDeliveryReceiptsIngestResult {
  readonly receipts: DeliveryReceiptIngestOutcome[];
  readonly orphanCount: number;
}
