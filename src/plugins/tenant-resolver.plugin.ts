import type { FastifyRequest } from 'fastify';

import { NotFoundError } from '@core/errors/app-errors.js';

import { createTtlLruCache } from '@shared/utils/ttl-lru-cache.js';

declare module 'fastify' {
  interface FastifyRequest {
    hotelId?: string;
  }
}

const DEFAULT_TTL_MS = 300_000; // 5 minutes
const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_PARAM_NAME = 'hotel_slug';

/** Resolves a hotel slug (`hotels.code`) to a `hotel_id`, or `null` if unknown. */
export type HotelSlugLookup = (slug: string) => Promise<string | null>;

export interface SlugResolverOptions {
  lookup: HotelSlugLookup;
  ttlMs?: number;
  maxSize?: number;
  now?: () => number;
}

export interface SlugResolver {
  resolve(slug: string): Promise<string>;
}

export function createSlugResolver(opts: SlugResolverOptions): SlugResolver {
  const cache = createTtlLruCache<string>({
    ttlMs: opts.ttlMs ?? DEFAULT_TTL_MS,
    maxSize: opts.maxSize ?? DEFAULT_MAX_SIZE,
    ...(opts.now ? { now: opts.now } : {}),
  });

  return {
    async resolve(slug: string): Promise<string> {
      const cached = cache.get(slug);
      if (cached !== undefined) return cached;

      const hotelId = await opts.lookup(slug);
      if (hotelId === null) {
        throw new NotFoundError('hotel', slug);
      }
      cache.set(slug, hotelId);
      return hotelId;
    },
  };
}

export interface TenantResolverHookOptions {
  resolver: SlugResolver;
  paramName?: string;
}

/** Fastify preHandler: resolves `req.hotelId` from the URL slug, 404 if unknown. */
export type TenantResolverHook = (req: FastifyRequest) => Promise<void>;

export function resolveTenantFromSlug(opts: TenantResolverHookOptions): TenantResolverHook {
  const paramName = opts.paramName ?? DEFAULT_PARAM_NAME;

  return async function tenantResolverGuard(req): Promise<void> {
    const params = req.params as Record<string, string | undefined>;
    const slug = params[paramName];
    if (slug === undefined || slug === '') {
      throw new NotFoundError('hotel', slug ?? '');
    }
    req.hotelId = await opts.resolver.resolve(slug);
  };
}
