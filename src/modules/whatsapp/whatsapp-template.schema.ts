/**
 * zod schemas for the T16 template-relay boundary.
 *
 * Two wire directions are validated here:
 *  1. **HC → us RPC input** (`HotelCoreSubmitRpcPayloadSchema` +
 *     `HotelCoreResubmitRpcPayloadSchema`) — Q-B-03 assumption A stamp:
 *     HC ships the full template definition per call.
 *  2. **Router-forwarded Meta status branch** (`TemplateStatusEventSchema`)
 *     — signature verified by the router-layer plane (T04 HMAC plugin +
 *     T12 webhook route), we structurally re-parse for defense-in-depth.
 *
 * All schemas are `.strict()` so unknown-field spec drift surfaces as
 * `ValidationError` at the service boundary.
 */

import { z } from 'zod';

const TEMPLATE_NAME_MAX = 512;
const WABA_ID_MAX = 80;
const LANGUAGE_CODE_MAX = 20;
const COMPONENT_TEXT_MAX = 1024;
const REASON_MAX = 500;

const WA_TEMPLATE_CATEGORY = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const;
const WA_TEMPLATE_STATUS = ['IN_REVIEW', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'] as const;
const WA_TEMPLATE_COMPONENT_TYPE = ['HEADER', 'BODY', 'FOOTER', 'BUTTONS'] as const;
const WA_TEMPLATE_HEADER_FORMAT = ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'] as const;

export const WaTemplateComponentSchema = z
  .object({
    type: z.enum(WA_TEMPLATE_COMPONENT_TYPE),
    text: z.string().max(COMPONENT_TEXT_MAX).optional(),
    format: z.enum(WA_TEMPLATE_HEADER_FORMAT).optional(),
    buttons: z
      .array(z.object({ type: z.string().min(1), text: z.string().min(1) }).strict())
      .optional(),
  })
  .strict();

/**
 * Q-B-03 assumption A stamp — HC ships the full template definition in the
 * RPC body. Refactor site if PO ratifies template_id-only:
 * `HotelCoreSubmitRpcPayloadSchema` shrinks to `{ templateId }`.
 */
export const HotelCoreSubmitRpcPayloadSchema = z
  .object({
    templateId: z.string().uuid(),
    wabaId: z.string().min(1).max(WABA_ID_MAX),
    accessToken: z.string().min(1),
    name: z.string().min(1).max(TEMPLATE_NAME_MAX),
    category: z.enum(WA_TEMPLATE_CATEGORY),
    language: z.string().min(1).max(LANGUAGE_CODE_MAX),
    components: z.array(WaTemplateComponentSchema).min(1),
  })
  .strict();

export type HotelCoreSubmitRpcPayload = z.infer<typeof HotelCoreSubmitRpcPayloadSchema>;

export const HotelCoreResubmitRpcPayloadSchema = HotelCoreSubmitRpcPayloadSchema.extend({
  metaTemplateId: z.string().min(1).max(WABA_ID_MAX),
}).strict();

export type HotelCoreResubmitRpcPayload = z.infer<typeof HotelCoreResubmitRpcPayloadSchema>;

/**
 * Router-forwarded status branch (Meta → us → HC). Structural check only —
 * signature verified upstream by T04 HMAC plugin at the router layer.
 */
export const TemplateStatusEventSchema = z
  .object({
    hotelId: z.string().uuid(),
    metaTemplateId: z.string().min(1).max(WABA_ID_MAX),
    templateName: z.string().min(1).max(TEMPLATE_NAME_MAX),
    status: z.enum(WA_TEMPLATE_STATUS),
    reason: z.string().max(REASON_MAX).optional(),
  })
  .strict();

export type TemplateStatusEventDto = z.infer<typeof TemplateStatusEventSchema>;
