// HTTP routes for T22-followup QR provisioning (spec §3.4 + §2.2 rows
// 46-47). Two routes behind gm_admin:
//   POST /api/integrations/qr/regenerate  — rebuild + persist QR state
//   GET  /api/integrations/qr/download    — stream the PNG bytes
//
// Guard composition mirrors T17/T24-followup: guards injected at
// api-server bootstrap so this plugin stays auth-agnostic. `hotelId`
// arrives on `req.hotelId` per Q-C-04 (JWT plugin populates it).
//
// The `phoneNumber` input to the primitive service is sourced from
// slot-B's `WhatsappConfigRepository` (spec §3.4 step 1 assumes the
// hotel has a configured WA phone). If the WA config row is missing we
// surface `NotFoundError('wa_config', hotelId)`.

import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';

import { AuthError, NotFoundError, ValidationError } from '@core/errors/app-errors.js';

import type { ObjectStoragePort } from './ports/object-storage.port.js';
import { QrRegenerateRequestSchema } from './qr-provisioning.schema.js';
import type { QrService } from './qr-provisioning.service.js';

export interface WhatsappPhoneLookupPort {
  lookupPhone(input: { hotelId: string }): Promise<string | null>;
}

export interface QrProvisioningRoutesOptions {
  readonly service: QrService;
  readonly storage: ObjectStoragePort;
  readonly waPhoneLookup: WhatsappPhoneLookupPort;
  readonly guards: readonly preHandlerHookHandler[];
}

export const qrProvisioningRoutes: FastifyPluginAsync<QrProvisioningRoutesOptions> = (
  fastify,
  opts,
) => {
  const preHandler = [...opts.guards] as preHandlerHookHandler[];

  fastify.post('/api/integrations/qr/regenerate', { preHandler }, async (req) => {
    const hotelId = requireHotelId(req.hotelId);
    const parsed = QrRegenerateRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError('Invalid QR regenerate payload', {
        issues: parsed.error.issues,
      });
    }
    const phoneNumber = await opts.waPhoneLookup.lookupPhone({ hotelId });
    if (phoneNumber === null) {
      throw new NotFoundError('wa_config', hotelId);
    }
    const result = await opts.service.regenerate({
      hotelId,
      phoneNumber,
      ...(parsed.data.greetingText !== undefined ? { greetingText: parsed.data.greetingText } : {}),
    });
    return {
      url: result.url,
      png_url: result.pngUrl,
      generated_at: result.generatedAt.toISOString(),
    };
  });

  fastify.get('/api/integrations/qr/download', { preHandler }, async (req, reply) => {
    const hotelId = requireHotelId(req.hotelId);
    const descriptor = await opts.service.getForDownload(hotelId);
    const key = deriveKeyFromUrl(descriptor.pngUrl);
    const stream = await opts.storage.getPngStream({ key });
    if (stream === null) {
      throw new NotFoundError('qr_png_bytes', hotelId);
    }
    void reply.type('image/png');
    return reply.send(stream);
  });

  return Promise.resolve();
};

function requireHotelId(candidate: string | undefined): string {
  if (candidate === undefined || candidate === '') {
    throw new AuthError('Tenant scope missing on request');
  }
  return candidate;
}

/** Extracts `qr/{hotelId}.png` from a `publicUrl` produced by the
 *  storage adapter. Both the real S3 adapter and the stub emit URLs
 *  whose last path segment is the encoded key. */
function deriveKeyFromUrl(publicUrl: string): string {
  const segments = publicUrl.split('/');
  const last = segments[segments.length - 1] ?? '';
  const decoded = decodeURIComponent(last);
  return decoded.startsWith('qr/') ? decoded : `qr/${decoded}`;
}
