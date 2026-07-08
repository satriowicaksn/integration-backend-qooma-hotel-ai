// Prisma-direct repository for `webhook_events` inbound persistence.
// Spec §4.6-4.7: persist the raw payload first, ack Telegram fast, dispatch
// async downstream. This primitive persists synchronously in the same
// request cycle (queue worker deferred per T19-followup PLAN GAP #5).

import type { Prisma, PrismaClient } from '@prisma/client';

export interface WebhookEventPersistInput {
  readonly hotelId: string;
  readonly signatureValid: boolean;
  readonly payload: unknown;
}

export interface PersistedWebhookEvent {
  readonly id: string;
  readonly receivedAt: Date;
}

export class TelegramWebhookEventsRepository {
  constructor(private readonly db: PrismaClient) {}

  async persist(input: WebhookEventPersistInput): Promise<PersistedWebhookEvent> {
    // JSON round-trip so Prisma receives a plain `InputJsonValue`-shape
    // regardless of whether callers hand us zod-parsed objects or raw
    // JS values.
    const payload = JSON.parse(JSON.stringify(input.payload)) as Prisma.InputJsonValue;
    const row = await this.db.webhookEvent.create({
      data: {
        hotelId: input.hotelId,
        provider: 'telegram',
        signatureValid: input.signatureValid,
        payload,
      },
    });
    return { id: row.id, receivedAt: row.receivedAt };
  }
}
