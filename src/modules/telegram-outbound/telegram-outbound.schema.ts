// zod schemas for T20 Telegram outbound RPC.
//
// Wire fields are snake_case per API-contract convention. Top-level
// `.strict()` per PM C ACK T20 binding #14 rejects unknown keys at
// contract boundary.
//
// **`parse_mode` enum** (binding #13): only `'HTML' | 'MarkdownV2'`.
// Telegram's legacy `'Markdown'` mode is intentionally rejected —
// MarkdownV2 is the current spec.
//
// **Body cap** (binding #12): 4096 chars matches Telegram Bot API limit.
// Reject at parse boundary so oversized bodies never reach the adapter.

import { z } from 'zod';

const TELEGRAM_BODY_MAX = 4096;

export const TelegramParseModeEnum = z.enum(['HTML', 'MarkdownV2']);

export const SendTelegramMessageRequestSchema = z
  .object({
    hotel_id: z.string().uuid(),
    chat_id: z.string().min(1).max(64),
    body: z.string().min(1).max(TELEGRAM_BODY_MAX),
    parse_mode: TelegramParseModeEnum.optional(),
  })
  .strict();

export type SendTelegramMessageRequestDto = z.infer<typeof SendTelegramMessageRequestSchema>;

export const SendTelegramMessageResponseSchema = z
  .object({
    message_id: z.string(),
    sent_at: z.string(),
  })
  .strict();

export type SendTelegramMessageResponseDto = z.infer<typeof SendTelegramMessageResponseSchema>;
