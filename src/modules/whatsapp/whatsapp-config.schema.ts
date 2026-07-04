/**
 * zod schemas for the WA config CRUD wire contract
 * (spec 04-integration-channels §2.1 + §4.1 DDL bounds).
 *
 * `WhatsappConfigPutSchema` enforces DDL length caps + E.164 for `phoneNumber`
 * so validation lives at the boundary. `WhatsappConfigResponseSchema` describes
 * the GET/PUT read-back shape — sensitive fields are strings post-mask, not
 * plaintext. Route-level wiring against Fastify is deferred to T10-followup;
 * these schemas already hold the shape the routes will consume.
 */

import { z } from 'zod';

const BSP_VENDORS = ['1engage'] as const;

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

const PHONE_NUMBER_ID_MAX = 80;
const PHONE_NUMBER_MAX = 20;
const WEBHOOK_URL_MAX = 500;
const WEBHOOK_VERIFY_TOKEN_MAX = 80;

export const WhatsappConfigPutSchema = z
  .object({
    bsp: z.enum(BSP_VENDORS).default('1engage'),
    phoneNumberId: z.string().min(1).max(PHONE_NUMBER_ID_MAX),
    phoneNumber: z.string().regex(E164_REGEX).max(PHONE_NUMBER_MAX),
    accessToken: z.string().min(1),
    webhookUrl: z.string().url().max(WEBHOOK_URL_MAX),
    webhookVerifyToken: z.string().min(1).max(WEBHOOK_VERIFY_TOKEN_MAX),
  })
  .strict();

export type WhatsappConfigPutDto = z.infer<typeof WhatsappConfigPutSchema>;

export const WhatsappConfigResponseSchema = z
  .object({
    hotelId: z.string().uuid(),
    bsp: z.enum(BSP_VENDORS),
    phoneNumberId: z.string(),
    phoneNumber: z.string(),
    accessToken: z.string(),
    webhookUrl: z.string(),
    webhookVerifyToken: z.string(),
    verifiedAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict();

export type WhatsappConfigResponseDto = z.infer<typeof WhatsappConfigResponseSchema>;
