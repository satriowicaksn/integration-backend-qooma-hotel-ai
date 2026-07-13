/**
 * `wa_configs` repository — Prisma-direct, no port interface (ADR-0001).
 *
 * Reads/writes the raw persisted row (ciphertext in `accessTokenEnc`); the
 * service is responsible for encrypting on the write path and decrypting +
 * masking on the read path. `upsert` keyed on `hotelId` (PK) — one config per
 * hotel per DDL §4.1.
 */

import type { PrismaClient, WaConfig } from '@prisma/client';

import type { WhatsappConfigPersistenceInput } from './whatsapp-config.types.js';

export class WhatsappConfigRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByHotelId(hotelId: string): Promise<WaConfig | null> {
    return this.db.waConfig.findUnique({ where: { hotelId } });
  }

  async findByPhoneNumberId(phoneNumberId: string): Promise<WaConfig | null> {
    return this.db.waConfig.findFirst({ where: { phoneNumberId } });
  }

  async upsert(hotelId: string, input: WhatsappConfigPersistenceInput): Promise<WaConfig> {
    return this.db.waConfig.upsert({
      where: { hotelId },
      create: {
        hotelId,
        bsp: input.bsp,
        phoneNumberId: input.phoneNumberId,
        phoneNumber: input.phoneNumber,
        accessTokenEnc: input.accessTokenEnc,
        webhookUrl: input.webhookUrl,
        webhookVerifyToken: input.webhookVerifyToken,
      },
      update: {
        bsp: input.bsp,
        phoneNumberId: input.phoneNumberId,
        phoneNumber: input.phoneNumber,
        accessTokenEnc: input.accessTokenEnc,
        webhookUrl: input.webhookUrl,
        webhookVerifyToken: input.webhookVerifyToken,
      },
    });
  }
}
