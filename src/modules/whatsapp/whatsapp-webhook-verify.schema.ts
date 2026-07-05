/**
 * zod schema for the T11 verify-webhook response wire contract (spec §5 AC
 * L119). Request body is empty — the route triggers on session at
 * T11-followup, `hotel_id` derives from the JWT, and the primitive is
 * called with the resolved id. Only the response envelope needs a schema
 * at this boundary.
 */

import { z } from 'zod';

const REASON_MAX = 500;

const WEBHOOK_VERIFICATION_OUTCOME = ['verified', 'unreachable', 'invalid_response'] as const;

export const WhatsappVerifyWebhookResponseSchema = z
  .object({
    hotelId: z.string().uuid(),
    verified: z.boolean(),
    verifiedAt: z.date().nullable(),
    outcome: z.enum(WEBHOOK_VERIFICATION_OUTCOME),
    statusCode: z.number().int().nonnegative().optional(),
    reason: z.string().max(REASON_MAX).optional(),
  })
  .strict();

export type WhatsappVerifyWebhookResponseDto = z.infer<typeof WhatsappVerifyWebhookResponseSchema>;
