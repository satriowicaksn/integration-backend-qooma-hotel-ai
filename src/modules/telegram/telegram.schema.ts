// zod schemas = source of truth for wire types (request/response).
// Spec: docs/spec/04-integration-channels.md §2.1 + §4.2 DDL telegram_configs.

import { z } from 'zod';

export const TelegramConfigPutSchema = z
  .object({
    botToken: z.string().min(20).max(200),
    botUsername: z
      .string()
      .min(1)
      .max(40)
      .regex(/^[A-Za-z0-9_]+$/, 'botUsername must be alphanumeric or underscore'),
    defaultChatId: z.string().min(1).max(64).nullish(),
    gmTelegramId: z.string().min(1).max(64).nullish(),
    webhookUrl: z.string().url().max(500).nullish(),
  })
  .strict();

export type TelegramConfigPutDto = z.infer<typeof TelegramConfigPutSchema>;

export const TelegramConfigResponseSchema = z.object({
  hotelId: z.string().uuid(),
  botToken: z.string(),
  botUsername: z.string(),
  defaultChatId: z.string().nullable(),
  gmTelegramId: z.string().nullable(),
  webhookUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type TelegramConfigResponseDto = z.infer<typeof TelegramConfigResponseSchema>;
