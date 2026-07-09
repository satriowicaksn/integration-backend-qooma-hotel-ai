// Route-level unit test for T26 WA config routes using fastify.inject
// with fully-mocked service + fake guard that stamps req.hotelId. Skips
// the real JWT stack (integration test covers that).
//
// PII floor: the mocked service still receives the plaintext accessToken
// (that is the whole point of the PUT); the test asserts the RESPONSE
// body never contains the plaintext, mirroring the service-layer
// contract that only the masked view is returned.

import { describe, expect, it, jest } from '@jest/globals';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';

import { AuthError, NotFoundError } from '@core/errors/app-errors.js';

import { registerErrorHandler } from '@plugins/error-handler.plugin.js';

import { whatsappConfigRoutes } from '../whatsapp-config.routes.js';
import type { WhatsappConfigService } from '../whatsapp-config.service.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const PLAINTEXT_ACCESS_TOKEN = 'super-secret-plaintext-access-token';
const PLAINTEXT_WEBHOOK_VERIFY_TOKEN = 'meta-verify-token';

const validPutPayload = {
  bsp: '1engage' as const,
  phoneNumberId: '1234567890',
  phoneNumber: '+6281234567890',
  accessToken: PLAINTEXT_ACCESS_TOKEN,
  webhookUrl: 'https://example.com/webhook',
  webhookVerifyToken: PLAINTEXT_WEBHOOK_VERIFY_TOKEN,
};

const maskedDomain = {
  hotelId: HOTEL_ID,
  bsp: '1engage' as const,
  phoneNumberId: '1234567890',
  phoneNumber: '+6281234567890',
  accessToken: '***oken',
  webhookUrl: 'https://example.com/webhook',
  webhookVerifyToken: '***oken',
  verifiedAt: null,
  createdAt: new Date('2026-07-08T00:00:00.000Z'),
  updatedAt: new Date('2026-07-08T00:00:00.000Z'),
};

interface ServiceDouble {
  getForHotel: jest.Mock;
  upsertForHotel: jest.Mock;
}

function createServiceDouble(): {
  service: WhatsappConfigService;
  double: ServiceDouble;
} {
  const double: ServiceDouble = {
    getForHotel: jest.fn(),
    upsertForHotel: jest.fn(),
  };
  return { service: double as unknown as WhatsappConfigService, double };
}

async function buildApp(opts: {
  service: WhatsappConfigService;
  hotelIdOverride?: string | undefined;
}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);

  const fakeGuard = (req: FastifyRequest, _reply: unknown, done: () => void): void => {
    (req as { hotelId?: string }).hotelId =
      opts.hotelIdOverride === undefined ? HOTEL_ID : opts.hotelIdOverride;
    done();
  };

  await app.register(whatsappConfigRoutes, {
    service: opts.service,
    guards: [fakeGuard],
  });
  await app.ready();
  return app;
}

describe('GET /api/integrations/whatsapp', () => {
  it('should return 200 with the masked domain from the service', async () => {
    const { service, double } = createServiceDouble();
    double.getForHotel.mockResolvedValue(maskedDomain);
    const app = await buildApp({ service });

    try {
      const res = await app.inject({ method: 'GET', url: '/api/integrations/whatsapp' });
      expect(res.statusCode).toBe(200);
      expect(double.getForHotel).toHaveBeenCalledWith(HOTEL_ID);
      const body = res.json<{ accessToken: string }>();
      expect(body.accessToken).toBe('***oken');
    } finally {
      await app.close();
    }
  });

  it('should surface NotFoundError from the service as a 404 canonical envelope', async () => {
    const { service, double } = createServiceDouble();
    double.getForHotel.mockRejectedValue(new NotFoundError('WaConfig', HOTEL_ID));
    const app = await buildApp({ service });

    try {
      const res = await app.inject({ method: 'GET', url: '/api/integrations/whatsapp' });
      expect(res.statusCode).toBe(404);
      const body = res.json<{ error: { code: string } }>();
      expect(body.error.code).toBe('NOT_FOUND');
    } finally {
      await app.close();
    }
  });

  it('should return 401 AUTH_ERROR when req.hotelId is empty (defensive branch)', async () => {
    const { service, double } = createServiceDouble();
    const app = await buildApp({ service, hotelIdOverride: '' });

    try {
      const res = await app.inject({ method: 'GET', url: '/api/integrations/whatsapp' });
      expect(res.statusCode).toBe(401);
      expect(double.getForHotel).not.toHaveBeenCalled();
      const body = res.json<{ error: { code: string } }>();
      expect(body.error.code).toBe('AUTH_ERROR');
    } finally {
      await app.close();
    }
  });
});

describe('PUT /api/integrations/whatsapp', () => {
  it('should return 200 with the masked domain and NEVER echo the plaintext accessToken (PII floor)', async () => {
    const { service, double } = createServiceDouble();
    double.upsertForHotel.mockResolvedValue(maskedDomain);
    const app = await buildApp({ service });

    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/integrations/whatsapp',
        headers: { 'content-type': 'application/json' },
        payload: validPutPayload,
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).not.toContain(PLAINTEXT_ACCESS_TOKEN);
      expect(res.body).not.toContain(PLAINTEXT_WEBHOOK_VERIFY_TOKEN);
      const parsed = res.json<{ accessToken: string; hotelId: string }>();
      expect(parsed.accessToken).toBe('***oken');
      expect(parsed.hotelId).toBe(HOTEL_ID);
    } finally {
      await app.close();
    }
  });

  it('should pass the parsed body to service.upsertForHotel unchanged', async () => {
    const { service, double } = createServiceDouble();
    double.upsertForHotel.mockResolvedValue(maskedDomain);
    const app = await buildApp({ service });

    try {
      await app.inject({
        method: 'PUT',
        url: '/api/integrations/whatsapp',
        headers: { 'content-type': 'application/json' },
        payload: validPutPayload,
      });
      expect(double.upsertForHotel).toHaveBeenCalledWith(HOTEL_ID, validPutPayload);
    } finally {
      await app.close();
    }
  });

  it('should return 400 VALIDATION_ERROR when the body fails zod strict parse, and NOT call the service', async () => {
    const { service, double } = createServiceDouble();
    const app = await buildApp({ service });

    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/integrations/whatsapp',
        headers: { 'content-type': 'application/json' },
        payload: { ...validPutPayload, phoneNumber: '081-not-e164' },
      });
      expect(res.statusCode).toBe(400);
      expect(double.upsertForHotel).not.toHaveBeenCalled();
      const body = res.json<{ error: { code: string } }>();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    } finally {
      await app.close();
    }
  });

  it('should return 401 AUTH_ERROR when req.hotelId is not populated by the guard', async () => {
    const { service, double } = createServiceDouble();
    const app = await buildApp({ service, hotelIdOverride: '' });

    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/integrations/whatsapp',
        headers: { 'content-type': 'application/json' },
        payload: validPutPayload,
      });
      expect(res.statusCode).toBe(401);
      expect(double.upsertForHotel).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should surface an AuthError thrown by a guard as a 401 canonical envelope', async () => {
    const { service, double } = createServiceDouble();
    const app = Fastify({ logger: false });
    registerErrorHandler(app);
    const throwingGuard = (
      _req: FastifyRequest,
      _reply: unknown,
      done: (err: Error) => void,
    ): void => {
      done(new AuthError('missing bearer'));
    };
    await app.register(whatsappConfigRoutes, {
      service,
      guards: [throwingGuard],
    });
    await app.ready();

    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/integrations/whatsapp',
        headers: { 'content-type': 'application/json' },
        payload: validPutPayload,
      });
      expect(res.statusCode).toBe(401);
      expect(double.upsertForHotel).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
