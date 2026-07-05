/**
 * zod schema for the T13 outbound-dispatch RPC request. Uses `z.union` so
 * exactly ONE of `body` or `template` is present at the TYPE level — matches
 * spec §2.4 RPC signature `send_wa_message(hotelId, guestId, body, template?,
 * variables?)` where `body` and `template` are mutually exclusive dispatch
 * modes. Consumers narrow via `'body' in req` / `'template' in req` in TS,
 * eliminating `undefined` uncertainty at the T06 BSP send boundary.
 *
 * Q-B-08/09 assumption stamps live in `whatsapp-outbound-dispatch.types.ts` —
 * schema layer only shapes the request wire contract.
 */

import { z } from 'zod';

const PHONE_MAX = 32;
const TEMPLATE_NAME_MAX = 128;
const LANGUAGE_CODE_MAX = 16;
const BODY_MAX = 4096;
const VARIABLE_MAX = 512;

const OutboundDispatchTemplateSchema = z
  .object({
    name: z.string().min(1).max(TEMPLATE_NAME_MAX),
    languageCode: z.string().min(1).max(LANGUAGE_CODE_MAX),
    variables: z.array(z.string().max(VARIABLE_MAX)).optional(),
  })
  .strict();

const BaseFieldsShape = {
  hotelId: z.string().uuid(),
  guestId: z.string().uuid(),
  recipientPhone: z.string().min(1).max(PHONE_MAX),
};

const OutboundDispatchTextRequestSchema = z
  .object({
    ...BaseFieldsShape,
    body: z.string().min(1).max(BODY_MAX),
  })
  .strict();

const OutboundDispatchTemplateRequestSchema = z
  .object({
    ...BaseFieldsShape,
    template: OutboundDispatchTemplateSchema,
  })
  .strict();

/**
 * Union — exactly ONE of `body` or `template`. Both-present + both-absent
 * shapes fail parse because neither branch of the union will accept them
 * (each branch is `.strict()` so extra keys reject).
 */
export const OutboundDispatchRequestSchema = z.union([
  OutboundDispatchTextRequestSchema,
  OutboundDispatchTemplateRequestSchema,
]);

export type OutboundDispatchRequestDto = z.infer<typeof OutboundDispatchRequestSchema>;
