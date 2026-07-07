// zod schemas for T22 QR provisioning primitive.
//
// `QrRegenerateRequestSchema` — request body accepted by the (future)
// `POST /api/integrations/qr/regenerate` route. `greetingText` is optional
// per spec §3.4; when absent the URL builder omits `?text=` entirely
// (PM C ACK T22 GAP #5 default). Length capped at 400 chars so a
// realistic greeting can never push the composed `wa.me/<phone>?text=`
// URL past the DDL 500-char ceiling on `wa_link` (§4.3).
//
// `QrRegenerateResponseSchema` — wire shape per spec §3.4 step 5 +
// MVP §5 L129 AC: `{ url, png_url, generated_at }`. Field names use
// snake_case per API-contract convention.
//
// **`png_url` semantics** (PM C ACK T22 binding #2): whatever the
// `ObjectStoragePort.uploadPng` adapter returns as `publicUrl`. Final
// choice between direct CDN URL vs proxied `/api/integrations/qr/
// download/{hotelId}` vs pre-signed URL is a T22-followup route-landing
// decision blocked on Q-C-10 resolution. Primitive-scope only enforces
// that it is a valid https URL.

import { z } from 'zod';

const GREETING_MAX_LENGTH = 400;

export const QrRegenerateRequestSchema = z
  .object({
    greetingText: z.string().max(GREETING_MAX_LENGTH).optional(),
  })
  .strict();

export type QrRegenerateRequestDto = z.infer<typeof QrRegenerateRequestSchema>;

export const QrRegenerateResponseSchema = z.object({
  url: z.string().url(),
  png_url: z.string().url(),
  generated_at: z.coerce.date(),
});

export type QrRegenerateResponseDto = z.infer<typeof QrRegenerateResponseSchema>;
