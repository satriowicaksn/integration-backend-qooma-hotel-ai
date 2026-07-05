/**
 * `outbound_dispatch_queue` + `wa_configs` (cross-table read) repository —
 * sibling to T10/T11/T12/T15 pattern. Owns EXACTLY 4 methods per PM B ACK
 * binding condition #4:
 *  1. `findConfigForDispatch` — cross-table read on `wa_configs`; decrypts
 *     `accessTokenEnc` INTERNALLY via `@shared/utils/crypto` (T15 precedent
 *     for cross-table primitives). T10 primitive preserved byte-for-byte;
 *     this method never mutates or touches T10's `WhatsappConfigRepository`.
 *  2. `persistPending` — creates `outbound_dispatch_queue` row with
 *     `status='pending'`.
 *  3. `markSent` — updates to `status='sent'` + populates `external_id` +
 *     `sent_at` after Meta ack.
 *  4. `markFailed` — updates to `status='failed'` with JSON error payload.
 */

import { Prisma, type OutboundDispatch, type PrismaClient } from '@prisma/client';

import { decrypt } from '@shared/utils/crypto.js';

import type {
  OutboundDispatchConfig,
  OutboundDispatchPersistenceInput,
} from './whatsapp-outbound-dispatch.types.js';

export class WhatsappOutboundDispatchRepository {
  constructor(private readonly db: PrismaClient) {}

  async findConfigForDispatch(hotelId: string): Promise<OutboundDispatchConfig | null> {
    const row = await this.db.waConfig.findUnique({ where: { hotelId } });
    if (row === null) return null;
    return {
      bsp: row.bsp,
      phoneNumberId: row.phoneNumberId,
      accessTokenPlaintext: decrypt(row.accessTokenEnc),
    };
  }

  async persistPending(input: OutboundDispatchPersistenceInput): Promise<OutboundDispatch> {
    return this.db.outboundDispatch.create({
      data: {
        hotelId: input.hotelId,
        guestId: input.guestId,
        provider: input.provider,
        status: 'pending',
        body: input.body ?? null,
        templateName: input.templateName ?? null,
        variables: input.variables !== undefined ? Array.from(input.variables) : Prisma.JsonNull,
      },
    });
  }

  async markSent(dispatchId: string, externalId: string, sentAt: Date): Promise<OutboundDispatch> {
    return this.db.outboundDispatch.update({
      where: { id: dispatchId },
      data: {
        status: 'sent',
        externalId,
        sentAt,
      },
    });
  }

  async markFailed(
    dispatchId: string,
    lastError: Prisma.InputJsonValue,
  ): Promise<OutboundDispatch> {
    return this.db.outboundDispatch.update({
      where: { id: dispatchId },
      data: {
        status: 'failed',
        lastError,
      },
    });
  }
}
