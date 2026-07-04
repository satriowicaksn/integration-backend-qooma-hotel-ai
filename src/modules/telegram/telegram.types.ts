// Internal domain + public view types for Telegram config CRUD (C1).
// Wire-shape schemas live in telegram.schema.ts (zod, source of truth).

export interface TelegramConfigDomain {
  readonly hotelId: string;
  readonly botTokenEnc: string;
  readonly botUsername: string;
  readonly defaultChatId: string | null;
  readonly gmTelegramId: string | null;
  readonly webhookUrl: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TelegramConfigView {
  readonly hotelId: string;
  readonly botToken: string;
  readonly botUsername: string;
  readonly defaultChatId: string | null;
  readonly gmTelegramId: string | null;
  readonly webhookUrl: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
