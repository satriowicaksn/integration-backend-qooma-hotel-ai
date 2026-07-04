import { describe, it, expect, jest } from '@jest/globals';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';

import {
  createSlugResolver,
  resolveTenantFromSlug,
  type HotelSlugLookup,
} from '../tenant-resolver.plugin.js';

const KNOWN = { slug: 'acme', hotelId: 'hotel-acme-id' };

function stubLookup(): jest.MockedFunction<HotelSlugLookup> {
  return jest.fn(
    (slug: string): Promise<string | null> =>
      Promise.resolve(slug === KNOWN.slug ? KNOWN.hotelId : null),
  );
}

interface Harness {
  app: FastifyInstance;
  didHandlerRun: () => boolean;
}

async function buildApp(lookup: HotelSlugLookup): Promise<Harness> {
  let handlerRan = false;
  const app = Fastify();
  const resolver = createSlugResolver({ lookup });
  app.post(
    '/webhook/whatsapp/:hotel_slug',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- async Fastify hook (Q-A-05, unratified)
      preHandler: resolveTenantFromSlug({ resolver }),
    },
    (req) => {
      handlerRan = true;
      return { hotelId: req.hotelId };
    },
  );
  await app.ready();
  return { app, didHandlerRun: () => handlerRan };
}

describe('createSlugResolver', () => {
  it('should resolve a known slug to its hotel id', async () => {
    const resolver = createSlugResolver({ lookup: stubLookup() });
    expect(await resolver.resolve(KNOWN.slug)).toBe(KNOWN.hotelId);
  });

  it('should not call lookup twice on a cache hit', async () => {
    const lookup = stubLookup();
    const resolver = createSlugResolver({ lookup });
    await resolver.resolve(KNOWN.slug);
    await resolver.resolve(KNOWN.slug);
    expect(lookup.mock.calls).toHaveLength(1);
  });

  it('should re-lookup after the ttl expires', async () => {
    let t = 1000;
    const lookup = stubLookup();
    const resolver = createSlugResolver({ lookup, ttlMs: 100, now: () => t });
    await resolver.resolve(KNOWN.slug);
    t += 101;
    await resolver.resolve(KNOWN.slug);
    expect(lookup.mock.calls).toHaveLength(2);
  });

  it('should throw NotFoundError for an unknown slug', async () => {
    const resolver = createSlugResolver({ lookup: stubLookup() });
    await expect(resolver.resolve('ghost')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('should throw NotFoundError when the slug param is missing', async () => {
    const hook = resolveTenantFromSlug({ resolver: createSlugResolver({ lookup: stubLookup() }) });
    const req = { params: {} } as unknown as FastifyRequest;
    await expect(hook(req)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('resolveTenantFromSlug (fastify.inject)', () => {
  it('should resolve hotelId from the url slug and return 200', async () => {
    const { app, didHandlerRun } = await buildApp(stubLookup());
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/whatsapp/acme',
      headers: { 'content-type': 'application/json' },
      payload: { any: 'body' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ hotelId: KNOWN.hotelId });
    expect(didHandlerRun()).toBe(true);
    await app.close();
  });

  it('should derive hotelId from the url slug and ignore hotel_id in the body', async () => {
    const { app } = await buildApp(stubLookup());
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/whatsapp/acme',
      headers: { 'content-type': 'application/json' },
      payload: { hotel_id: 'attacker-controlled-id' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ hotelId: KNOWN.hotelId }); // url slug wins, body ignored
    await app.close();
  });

  it('should return 404 and skip the handler for an unknown slug', async () => {
    const { app, didHandlerRun } = await buildApp(stubLookup());
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/whatsapp/ghost',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(didHandlerRun()).toBe(false);
    await app.close();
  });
});
