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

  async existsByVerifyToken(token: string): Promise<boolean> {
    if (token.length === 0) return false;
    const row = await this.db.waConfig.findFirst({
      where: { webhookVerifyToken: token },
      select: { hotelId: true },
    });
    return row !== null;
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
        wabaId: input.wabaId ?? null,
        webhookUrl: input.webhookUrl ?? '',
        webhookVerifyToken: input.webhookVerifyToken ?? '',
      },
      update: {
        bsp: input.bsp,
        phoneNumberId: input.phoneNumberId,
        phoneNumber: input.phoneNumber,
        accessTokenEnc: input.accessTokenEnc,
        ...(input.wabaId !== undefined ? { wabaId: input.wabaId } : {}),
        ...(input.webhookUrl !== undefined ? { webhookUrl: input.webhookUrl } : {}),
        ...(input.webhookVerifyToken !== undefined
          ? { webhookVerifyToken: input.webhookVerifyToken }
          : {}),
      },
    });
  }
}
