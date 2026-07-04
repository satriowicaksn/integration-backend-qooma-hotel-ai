// Prisma-direct repository (ADR-0001: no wrap-interface for Prisma).
// PrismaClient injected via ctor so unit-testable with plain-object mock.

import type { PrismaClient, TelegramConfig } from '@prisma/client';

import type { TelegramConfigDomain } from './telegram.types.js';

export interface TelegramConfigUpsertInput {
  readonly botTokenEnc: string;
  readonly botUsername: string;
  readonly defaultChatId: string | null;
  readonly gmTelegramId: string | null;
  readonly webhookUrl: string | null;
}

export class TelegramConfigRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByHotelId(hotelId: string): Promise<TelegramConfigDomain | null> {
    const row = await this.db.telegramConfig.findUnique({ where: { hotelId } });
    return row ? toDomain(row) : null;
  }

  async upsert(hotelId: string, input: TelegramConfigUpsertInput): Promise<TelegramConfigDomain> {
    const row = await this.db.telegramConfig.upsert({
      where: { hotelId },
      create: {
        hotelId,
        botTokenEnc: input.botTokenEnc,
        botUsername: input.botUsername,
        defaultChatId: input.defaultChatId,
        gmTelegramId: input.gmTelegramId,
        webhookUrl: input.webhookUrl,
      },
      update: {
        botTokenEnc: input.botTokenEnc,
        botUsername: input.botUsername,
        defaultChatId: input.defaultChatId,
        gmTelegramId: input.gmTelegramId,
        webhookUrl: input.webhookUrl,
      },
    });
    return toDomain(row);
  }
}

function toDomain(row: TelegramConfig): TelegramConfigDomain {
  return {
    hotelId: row.hotelId,
    botTokenEnc: row.botTokenEnc,
    botUsername: row.botUsername,
    defaultChatId: row.defaultChatId,
    gmTelegramId: row.gmTelegramId,
    webhookUrl: row.webhookUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
