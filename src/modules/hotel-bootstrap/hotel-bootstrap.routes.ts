import { randomBytes } from 'node:crypto';

import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';

import { ValidationError } from '@core/errors/app-errors.js';

import type { WhatsappConfigRepository } from '@modules/whatsapp/whatsapp-config.repository.js';

const BootstrapBodySchema = z.object({
  hotel_id: z.string().uuid(),
});

const DEFAULT_BSP = '1engage';

export interface HotelBootstrapRoutesOptions {
  readonly waConfigRepo: WhatsappConfigRepository;
  readonly guards: preHandlerHookHandler[];
}

export const hotelBootstrapRoutes: FastifyPluginAsync<HotelBootstrapRoutesOptions> = (
  fastify,
  opts,
) => {
  fastify.post('/internal/hotels/bootstrap', { preHandler: opts.guards }, async (req, reply) => {
    const parsed = BootstrapBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('hotel bootstrap body failed validation', {
        issues: parsed.error.issues,
      });
    }
    const { hotel_id: hotelId } = parsed.data;

    const existing = await opts.waConfigRepo.findByHotelId(hotelId);
    if (existing !== null) {
      return reply.code(200).send({ ok: true, created: false });
    }

    const verifyToken = randomBytes(32).toString('hex');
    await opts.waConfigRepo.upsert(hotelId, {
      bsp: DEFAULT_BSP,
      phoneNumberId: '',
      phoneNumber: '',
      accessTokenEnc: '',
      webhookUrl: '',
      webhookVerifyToken: verifyToken,
    });
    return reply.code(201).send({ ok: true, created: true });
  });

  return Promise.resolve();
};
