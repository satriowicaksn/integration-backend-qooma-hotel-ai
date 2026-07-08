// zod schemas for T18 per-dept Telegram routing write-through.
//
// Wire fields snake_case per API-contract convention. `.strict()` rejects
// unknown top-level keys. `.refine` guards against an empty PUT body —
// at least one routing field MUST be present (nothing to update
// otherwise). Both IDs are `z.string().min(1).max(64)` matching Telegram
// numeric-ID length envelope (parity with T20 `chat_id` schema).

import { z } from 'zod';

const TELEGRAM_ID_MAX = 64;

export const UpdateDepartmentTelegramRoutingRequestSchema = z
  .object({
    telegram_chat_id: z.string().min(1).max(TELEGRAM_ID_MAX).optional(),
    supervisor_telegram_id: z.string().min(1).max(TELEGRAM_ID_MAX).optional(),
  })
  .strict()
  .refine((v) => v.telegram_chat_id !== undefined || v.supervisor_telegram_id !== undefined, {
    message: 'at least one of telegram_chat_id or supervisor_telegram_id is required',
  });

export type UpdateDepartmentTelegramRoutingRequestDto = z.infer<
  typeof UpdateDepartmentTelegramRoutingRequestSchema
>;

export const UpdateDepartmentTelegramRoutingResponseSchema = z
  .object({
    updated: z.literal(true),
    updated_at: z.string(),
  })
  .strict();

export type UpdateDepartmentTelegramRoutingResponseDto = z.infer<
  typeof UpdateDepartmentTelegramRoutingResponseSchema
>;
