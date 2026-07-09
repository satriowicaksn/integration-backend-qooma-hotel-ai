/**
 * Wire schema for T28 `POST /internal/wa/dispatch` (snake_case boundary,
 * ADR-0009). HC caller ships either a `body` text send or a `template`
 * template send — never both, never neither (XOR at zod level).
 *
 * Boundary translation: this schema keeps snake_case; the route handler
 * maps into the T13 service's camelCase RPC DTO before invoking the
 * dispatch service.
 */

import { z } from 'zod';

const PHONE_MAX = 32;
const TEMPLATE_NAME_MAX = 128;
const LANGUAGE_CODE_MAX = 16;
const BODY_MAX = 4096;
const VARIABLE_MAX = 512;
const CORRELATION_ID_MAX = 128;

const TemplateShape = z
  .object({
    name: z.string().min(1).max(TEMPLATE_NAME_MAX),
    language_code: z.string().min(1).max(LANGUAGE_CODE_MAX),
    variables: z.array(z.string().max(VARIABLE_MAX)).optional(),
  })
  .strict();

const BaseShape = {
  hotel_id: z.string().uuid(),
  guest_id: z.string().uuid(),
  wa_config_id: z.string().uuid().optional(),
  to_wa_phone: z.string().min(1).max(PHONE_MAX),
  correlation_id: z.string().min(1).max(CORRELATION_ID_MAX).optional(),
};

const TextRequestSchema = z
  .object({
    ...BaseShape,
    body: z.string().min(1).max(BODY_MAX),
  })
  .strict();

const TemplateRequestSchema = z
  .object({
    ...BaseShape,
    template: TemplateShape,
  })
  .strict();

/**
 * Union — exactly ONE of `body` / `template`. Both-present and
 * both-absent shapes fail parse because each branch is `.strict()`.
 */
export const DispatchRequestSchema = z.union([TextRequestSchema, TemplateRequestSchema]);

export type DispatchRequestDto = z.infer<typeof DispatchRequestSchema>;
