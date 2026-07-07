// zod schema for the subset of the Telegram Bot API "Update" object that the
// inbound handler consumes. Telegram evolves its wire shape — top-level allows
// unknown fields (passthrough) so we don't reject future additions, but the
// message/chat/from subset is validated strictly enough to safely extract
// sender identity + text.
//
// Reference: https://core.telegram.org/bots/api#update

import { z } from 'zod';

export const TelegramUserSchema = z
  .object({
    id: z.number().int(),
    is_bot: z.boolean().optional(),
    first_name: z.string().optional(),
    username: z.string().optional(),
  })
  .passthrough();

export const TelegramChatSchema = z
  .object({
    id: z.number().int(),
    type: z.string().optional(),
  })
  .passthrough();

export const TelegramMessageSchema = z
  .object({
    message_id: z.number().int(),
    date: z.number().int(),
    chat: TelegramChatSchema,
    from: TelegramUserSchema.optional(),
    text: z.string().optional(),
  })
  .passthrough();

export const TelegramUpdateSchema = z
  .object({
    update_id: z.number().int(),
    message: TelegramMessageSchema.optional(),
  })
  .passthrough();

export type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;
export type TelegramMessage = z.infer<typeof TelegramMessageSchema>;
export type TelegramUser = z.infer<typeof TelegramUserSchema>;
export type TelegramChat = z.infer<typeof TelegramChatSchema>;
