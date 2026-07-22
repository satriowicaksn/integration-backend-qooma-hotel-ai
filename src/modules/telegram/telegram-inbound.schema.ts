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

// T97 (ADD-24): the subset of `reply_to_message` needed to resolve which
// ticket-notification message a 2-digit OTP reply targets.
export const TelegramReplyToMessageSchema = z
  .object({
    message_id: z.number().int(),
  })
  .passthrough();

export const TelegramMessageSchema = z
  .object({
    message_id: z.number().int(),
    date: z.number().int(),
    chat: TelegramChatSchema,
    from: TelegramUserSchema.optional(),
    text: z.string().optional(),
    reply_to_message: TelegramReplyToMessageSchema.optional(),
  })
  .passthrough();

// T97 (ADD-24): callback_query subset for the OTP inline-keyboard presses.
// `message` is the group message that carried the keyboard (Telegram omits
// it for very old messages), `data` is our compact `otp:<action>:<ticket>`.
export const TelegramCallbackQuerySchema = z
  .object({
    id: z.string().min(1),
    from: TelegramUserSchema,
    message: z
      .object({
        message_id: z.number().int(),
        chat: TelegramChatSchema,
      })
      .passthrough()
      .optional(),
    data: z.string().optional(),
  })
  .passthrough();

export const TelegramUpdateSchema = z
  .object({
    update_id: z.number().int(),
    message: TelegramMessageSchema.optional(),
    callback_query: TelegramCallbackQuerySchema.optional(),
  })
  .passthrough();

export type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;
export type TelegramMessage = z.infer<typeof TelegramMessageSchema>;
export type TelegramUser = z.infer<typeof TelegramUserSchema>;
export type TelegramChat = z.infer<typeof TelegramChatSchema>;
export type TelegramCallbackQuery = z.infer<typeof TelegramCallbackQuerySchema>;
