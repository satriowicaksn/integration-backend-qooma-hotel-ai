/**
 * `webhook_events` repository (spec §4.4 DDL) — sibling to T10 `whatsapp-config.repository`
 * and T11 `whatsapp-webhook-verify.repository` per byte-for-byte discipline.
 *
 * **EXACTLY 3 methods** per PM B ACK GAP T12-#5 D:
 *  - `persist(input)` — write raw audit row with `signatureValid` flag
 *  - `markProcessed(eventId)` — worker success path
 *  - `markFailed(eventId, processError)` — worker failure path
 *
 * `findByPayloadMessageId` was intentionally dropped — dedup (Q-B-06) lives at
 * T12-followup after the `external_id` column is added to `webhook_events`
 * per spec §4.6. Persisting blindly is safe in primitive because Meta's retry
 * only surfaces on 5xx / timeout, and the async worker at T12-followup will
 * skip already-processed rows once dedup schema lands.
 */

import type { Prisma, PrismaClient, WebhookEvent } from '@prisma/client';

import type { WebhookEventPersistenceInput } from './whatsapp-webhook-ingest.types.js';

export class WhatsappWebhookEventsRepository {
  constructor(private readonly db: PrismaClient) {}

  async persist(input: WebhookEventPersistenceInput): Promise<WebhookEvent> {
    return this.db.webhookEvent.create({
      data: {
        hotelId: input.hotelId,
        provider: input.provider,
        signatureValid: input.signatureValid,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
  }

  async markProcessed(eventId: string, processedAt: Date): Promise<WebhookEvent> {
    return this.db.webhookEvent.update({
      where: { id: eventId },
      data: { processedAt },
    });
  }

  async markFailed(eventId: string, processError: Prisma.InputJsonValue): Promise<WebhookEvent> {
    return this.db.webhookEvent.update({
      where: { id: eventId },
      data: { processError },
    });
  }
}
