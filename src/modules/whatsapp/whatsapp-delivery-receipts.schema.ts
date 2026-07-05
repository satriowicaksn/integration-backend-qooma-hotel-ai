/**
 * zod schema + normalized extractor for the T15 Meta delivery-status branch.
 *
 * The Meta webhook envelope shape is inherited from T12 (`whatsapp-webhook-ingest.schema.ts`):
 * `entry[].changes[].value.statuses[]` carries status transitions. T15's
 * schema focuses on the `statuses` branch (T12 owns `messages`, T16 owns
 * template status). `.passthrough()` used on outer objects to survive Meta
 * spec drift; strict on the delivery-receipts DDL bounds.
 *
 * **Q-B-07 stamp** (optional future enhancement) — `delivery_receipts` DDL
 * (§4.6) has only a `status` CHECK constraint, NO UNIQUE on
 * `(dispatch_id, external_id, status)` triple. Multi-row per triple is
 * intended (status progression `sent → delivered → read` produces 3 rows).
 * Meta retry MAY create true duplicates; primitive accepts + docstrings the
 * trade-off. Q-B-07 potential future enhancement adds UNIQUE + ON CONFLICT
 * semantic at T15-followup after schema-add.
 */

import { z } from 'zod';

import type { WhatsappStatusEntry } from './whatsapp-delivery-receipts.types.js';

const EXTERNAL_ID_MAX = 80;
const PHONE_MAX = 32;
const TIMESTAMP_MAX = 32;

const DELIVERY_RECEIPT_STATUS = ['sent', 'delivered', 'read', 'failed'] as const;

const WhatsappStatusItemSchema = z
  .object({
    id: z.string().min(1).max(EXTERNAL_ID_MAX),
    status: z.enum(DELIVERY_RECEIPT_STATUS),
    timestamp: z.string().min(1).max(TIMESTAMP_MAX),
    recipient_id: z.string().min(1).max(PHONE_MAX).optional(),
  })
  .passthrough();

const WhatsappStatusesValueSchema = z
  .object({
    messaging_product: z.literal('whatsapp'),
    metadata: z
      .object({
        display_phone_number: z.string().min(1).max(PHONE_MAX),
        phone_number_id: z.string().min(1).max(PHONE_MAX),
      })
      .passthrough(),
    statuses: z.array(WhatsappStatusItemSchema).optional(),
    messages: z.array(z.unknown()).optional(),
  })
  .passthrough();

const WhatsappStatusesChangeSchema = z
  .object({
    field: z.string().min(1),
    value: WhatsappStatusesValueSchema,
  })
  .passthrough();

const WhatsappStatusesEntrySchema = z
  .object({
    id: z.string().min(1),
    changes: z.array(WhatsappStatusesChangeSchema).min(1),
  })
  .passthrough();

export const WhatsappDeliveryStatusesEnvelopeSchema = z
  .object({
    object: z.literal('whatsapp_business_account'),
    entry: z.array(WhatsappStatusesEntrySchema).min(1),
  })
  .passthrough();

export type WhatsappDeliveryStatusesEnvelopeDto = z.infer<
  typeof WhatsappDeliveryStatusesEnvelopeSchema
>;

/**
 * Extract normalized status entries from the Meta envelope. Returns `[]`
 * for envelopes carrying only `messages` (T12 concern) or template-status
 * branches (T16). Pure function; no side effects.
 */
export function extractStatuses(
  envelope: WhatsappDeliveryStatusesEnvelopeDto,
): WhatsappStatusEntry[] {
  const out: WhatsappStatusEntry[] = [];
  for (const entry of envelope.entry) {
    for (const change of entry.changes) {
      const statuses = change.value.statuses ?? [];
      for (const status of statuses) {
        out.push({
          externalId: status.id,
          status: status.status,
          timestamp: status.timestamp,
          ...(status.recipient_id !== undefined ? { recipientId: status.recipient_id } : {}),
        });
      }
    }
  }
  return out;
}
