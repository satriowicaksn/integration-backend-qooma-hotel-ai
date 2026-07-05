/**
 * zod schema + normalized-message extractor for the T12 Meta inbound webhook
 * envelope (spec §3.1 3-leg flow entry point).
 *
 * The outer envelope uses `.passthrough()` to survive spec drift (Meta adds
 * fields periodically); inner objects that we structurally depend on use
 * `.strict()` so shape regressions surface as `ValidationError` at the sync
 * leg boundary.
 *
 * `extractInboundMessages(envelope)` is the pure helper the async worker leg
 * uses to normalize per-message payloads. Returns `[]` for envelopes that
 * carry only `statuses` (delivery receipts → T15 concern per GAP T12-#7 A) or
 * template status branches (T16, merged) — router discriminates at
 * T12-followup.
 *
 * **Q-B-06 D deferred stamp** — `WhatsappInboundIngestResponseSchema.isDuplicate`
 * remains in the wire contract as `boolean` so the router shape survives
 * schema-add. Primitive service always returns `false` (dedup logic lands at
 * T12-followup once `webhook_events.external_id` column is added per Q-B-06).
 */

import { z } from 'zod';

import type { WhatsappInboundMessage } from './whatsapp-webhook-ingest.types.js';

const MESSAGE_ID_MAX = 128;
const PHONE_MAX = 32;
const BODY_MAX = 4096;
const PROFILE_NAME_MAX = 200;
const HOTEL_ID_UUID_LENGTH = 36;

const WhatsappTextMessageSchema = z
  .object({
    id: z.string().min(1).max(MESSAGE_ID_MAX),
    from: z.string().min(1).max(PHONE_MAX),
    timestamp: z.string().min(1).max(32),
    type: z.string().min(1).max(32),
    text: z
      .object({
        body: z.string().max(BODY_MAX),
      })
      .strict()
      .optional(),
  })
  .passthrough();

const WhatsappContactSchema = z
  .object({
    wa_id: z.string().min(1).max(PHONE_MAX),
    profile: z
      .object({
        name: z.string().max(PROFILE_NAME_MAX),
      })
      .strict()
      .optional(),
  })
  .passthrough();

const WhatsappChangeValueSchema = z
  .object({
    messaging_product: z.literal('whatsapp'),
    metadata: z
      .object({
        display_phone_number: z.string().min(1).max(PHONE_MAX),
        phone_number_id: z.string().min(1).max(PHONE_MAX),
      })
      .passthrough(),
    contacts: z.array(WhatsappContactSchema).optional(),
    messages: z.array(WhatsappTextMessageSchema).optional(),
    statuses: z.array(z.unknown()).optional(),
  })
  .passthrough();

const WhatsappChangeSchema = z
  .object({
    field: z.string().min(1),
    value: WhatsappChangeValueSchema,
  })
  .passthrough();

const WhatsappEntrySchema = z
  .object({
    id: z.string().min(1),
    changes: z.array(WhatsappChangeSchema).min(1),
  })
  .passthrough();

export const WhatsappInboundEnvelopeSchema = z
  .object({
    object: z.literal('whatsapp_business_account'),
    entry: z.array(WhatsappEntrySchema).min(1),
  })
  .passthrough();

export type WhatsappInboundEnvelopeDto = z.infer<typeof WhatsappInboundEnvelopeSchema>;

/**
 * Sync-leg wire response for the router at T12-followup. Router returns
 * `{ eventId, isDuplicate }` to Meta after a fast persist.
 * `isDuplicate` is always `false` in primitive (Q-B-06 D stamp above);
 * T12-followup fills the semantics after Q-B-06 schema-add.
 */
export const WhatsappInboundIngestResponseSchema = z
  .object({
    eventId: z.string().uuid(),
    isDuplicate: z.boolean(),
  })
  .strict();

export type WhatsappInboundIngestResponseDto = z.infer<typeof WhatsappInboundIngestResponseSchema>;

/**
 * Extract normalized inbound messages from the Meta envelope. Returns `[]`
 * for envelopes carrying only `statuses` (delivery receipts — T15) or no
 * `messages` array (template-status branch — T16). Pure function; no side
 * effects.
 */
export function extractInboundMessages(
  envelope: WhatsappInboundEnvelopeDto,
): WhatsappInboundMessage[] {
  const out: WhatsappInboundMessage[] = [];
  for (const entry of envelope.entry) {
    for (const change of entry.changes) {
      const messages = change.value.messages ?? [];
      const contacts = change.value.contacts ?? [];
      const nameByPhone = new Map<string, string>();
      for (const contact of contacts) {
        if (contact.profile?.name !== undefined) {
          nameByPhone.set(contact.wa_id, contact.profile.name);
        }
      }
      for (const message of messages) {
        const profileName = nameByPhone.get(message.from);
        out.push({
          messageId: message.id,
          waPhone: message.from,
          body: message.text?.body ?? '',
          timestamp: message.timestamp,
          ...(profileName !== undefined ? { profileName } : {}),
        });
      }
    }
  }
  return out;
}

/** Hotel-id sanity guard — sync leg accepts a UUID string. */
export const HotelIdSchema = z.string().uuid().length(HOTEL_ID_UUID_LENGTH);
