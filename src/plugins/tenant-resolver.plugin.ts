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

/** Lookup function: phone_number_id → hotel_id, or null if not configured. */
export type PhoneNumberIdLookup = (phoneNumberId: string) => Promise<string | null>;

export interface PhoneNumberIdResolverOptions {
  lookup: PhoneNumberIdLookup;
  ttlMs?: number;
  maxSize?: number;
  now?: () => number;
}

export function createPhoneNumberIdResolver(opts: PhoneNumberIdResolverOptions): SlugResolver {
  const cache = createTtlLruCache<string>({
    ttlMs: opts.ttlMs ?? DEFAULT_TTL_MS,
    maxSize: opts.maxSize ?? DEFAULT_MAX_SIZE,
    ...(opts.now ? { now: opts.now } : {}),
  });

  return {
    async resolve(phoneNumberId: string): Promise<string> {
      const cached = cache.get(phoneNumberId);
      if (cached !== undefined) return cached;

      const hotelId = await opts.lookup(phoneNumberId);
      if (hotelId === null) {
        throw new NotFoundError('hotel', phoneNumberId);
      }
      cache.set(phoneNumberId, hotelId);
      return hotelId;
    },
  };
}

/** Fastify preHandler: resolves `req.hotelId` from `phone_number_id` in the Meta webhook body. */
export function resolveTenantFromPhoneNumberId(opts: {
  resolver: SlugResolver;
}): TenantResolverHook {
  return async function tenantResolverPhoneNumberId(req): Promise<void> {
    const phoneNumberId = extractPhoneNumberId(req.body);
    if (phoneNumberId === undefined) {
      throw new NotFoundError('hotel', 'unknown');
    }
    req.hotelId = await opts.resolver.resolve(phoneNumberId);
  };
}

function extractPhoneNumberId(body: unknown): string | undefined {
  if (body === null || typeof body !== 'object') return undefined;
  const entry = (body as Record<string, unknown>)['entry'];
  if (!Array.isArray(entry) || entry.length === 0) return undefined;
  const changes = (entry[0] as Record<string, unknown>)['changes'];
  if (!Array.isArray(changes) || changes.length === 0) return undefined;
  const value = (changes[0] as Record<string, unknown>)['value'];
  if (value === null || typeof value !== 'object') return undefined;
  const metadata = (value as Record<string, unknown>)['metadata'];
  if (metadata === null || typeof metadata !== 'object') return undefined;
  const id = (metadata as Record<string, unknown>)['phone_number_id'];
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}
