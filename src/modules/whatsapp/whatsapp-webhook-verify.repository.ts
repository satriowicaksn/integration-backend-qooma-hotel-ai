/**
 * Repository for the `wa_configs.verified_at` timestamp write — sibling to
 * T10's `WhatsappConfigRepository` (which owns `findByHotelId` + `upsert`).
 *
 * Placement rationale (PM B ACK GAP T11-#2 A): T10 primitive is byte-for-byte
 * protected under T10-a2 / T16 discipline; adding a method there would erode
 * that discipline. A single-purpose sibling file for the `markVerified`
 * write preserves T10 + follows SRP. Same Prisma table, distinct concern.
 */

import type { PrismaClient, WaConfig } from '@prisma/client';

export class WhatsappWebhookVerifyRepository {
  constructor(private readonly db: PrismaClient) {}

  async markVerified(hotelId: string, verifiedAt: Date): Promise<WaConfig> {
    return this.db.waConfig.update({
      where: { hotelId },
      data: { verifiedAt },
    });
  }
}
