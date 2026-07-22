// Prisma-direct repository for `otp_ticket_context` (T97 / ADD-24).
// Stores the dept-group message linkage + guest WA coordinates captured at
// notification time so the [Kirim ulang kode] callback can dispatch without
// asking Core for guest PII. Never stores any code value.

import type { PrismaClient } from '@prisma/client';

import type { OtpTicketContext, OtpTicketContextUpsertInput } from './telegram-otp.types.js';

export class OtpTicketContextRepository {
  constructor(private readonly db: PrismaClient) {}

  async upsert(input: OtpTicketContextUpsertInput): Promise<void> {
    const data = {
      hotelId: input.hotelId,
      chatId: input.chatId,
      telegramMessageId: input.telegramMessageId,
      guestWaPhone: input.guestWaPhone ?? null,
      guestId: input.guestId ?? null,
    };
    await this.db.otpTicketContext.upsert({
      where: { ticketId: input.ticketId },
      create: { ticketId: input.ticketId, ...data },
      update: data,
    });
  }

  async findByTicketId(ticketId: string): Promise<OtpTicketContext | null> {
    const row = await this.db.otpTicketContext.findUnique({ where: { ticketId } });
    if (row === null) return null;
    return {
      ticketId: row.ticketId,
      hotelId: row.hotelId,
      chatId: row.chatId,
      telegramMessageId: row.telegramMessageId,
      guestWaPhone: row.guestWaPhone,
      guestId: row.guestId,
    };
  }
}
