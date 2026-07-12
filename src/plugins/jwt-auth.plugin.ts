/**
 * Session JWT authentication (Q-C-03 resolution — MVP HS256).
 *
 * Auth service (separate repo per KICKOFF §1) issues JWTs signed with
 * `JWT_ACCESS_SECRET` (HS256). This service only VERIFIES — it never
 * issues refresh tokens. When the Auth team upgrades to JWKS + RS256,
 * swap the verify implementation; the guard API + payload shape stay
 * the same.
 *
 * Discipline (mirrors `internal-rpc-auth.plugin.ts` style):
 * - Pure `verifyJwt` function that is trivially unit-testable (no
 *   Fastify coupling).
 * - Constant-time HMAC comparison via `timingSafeEqual`.
 * - Blank secret NEVER authenticates (defense against misconfiguration).
 * - Payload shape validated structurally (typeof + role enum) so any
 *   drift in Auth's issuance surfaces at the boundary.
 * - `req.user` typed via Fastify augmentation; `req.hotelId` populated
 *   from `payload.hotelId` (Q-C-04 resolution — tenant scope comes
 *   from the signed session, not client-controlled headers).
 * - Token read from `Authorization: Bearer` OR the auth service's httpOnly
 *   `token` cookie (the FE flow), whichever is present.
 *
 * Zero new deps: `@fastify/jwt` is already installed but this plugin
 * uses Node's built-in `crypto` to keep the verify path a pure
 * function (matching the `internal-rpc-auth` unit-test story).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';

import { AuthError, ForbiddenError } from '@core/errors/app-errors.js';

export type UserRole = 'super_admin' | 'gm_admin' | 'dept_head' | 'supervisor' | 'staff' | 'gm';

const VALID_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'super_admin',
  'gm_admin',
  'dept_head',
  'supervisor',
  'staff',
  'gm',
]);

/** Session claim shape as ACTUALLY issued by the auth service
 *  (`auth-backend/src/modules/auth/auth.token-issuer.ts`):
 *  `{ sub, sid, role, hotelId, deptId, exp, iat }`. `hotelId` is `null` for
 *  `super_admin` (all-hotels scope). Field names are camelCase — NOT the
 *  earlier assumed snake_case `hotel_id`. */
export interface JwtPayload {
  readonly sub: string;
  readonly sid?: string;
  readonly hotelId: string | null;
  readonly deptId?: string | null;
  readonly role: UserRole;
  readonly exp: number;
  readonly iat?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

const BEARER_PREFIX = 'bearer ';
const ACCESS_COOKIE = 'token';

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(normalized + '='.repeat(padLen), 'base64');
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isJwtPayload(candidate: unknown): candidate is JwtPayload {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const p = candidate as Record<string, unknown>;
  const hotelId = p['hotelId'];
  const hotelIdOk = hotelId === null || (typeof hotelId === 'string' && hotelId.length > 0);
  return (
    typeof p['sub'] === 'string' &&
    p['sub'].length > 0 &&
    hotelIdOk &&
    typeof p['role'] === 'string' &&
    VALID_ROLES.has(p['role'] as UserRole) &&
    typeof p['exp'] === 'number' &&
    Number.isFinite(p['exp'])
  );
}

/** Extracts a token from an `Authorization: Bearer <token>` header. Returns
 *  undefined for missing/malformed values so the caller can throw a stable
 *  `AuthError` at the guard boundary. */
export function extractBearerToken(header: string | string[] | undefined): string | undefined {
  if (header === undefined) return undefined;
  const value = Array.isArray(header) ? header[0] : header;
  if (value === undefined || value === '') return undefined;
  if (value.toLowerCase().startsWith(BEARER_PREFIX)) {
    const token = value.slice(BEARER_PREFIX.length).trim();
    return token === '' ? undefined : token;
  }
  return undefined;
}

/** Reads a named cookie value from a raw `Cookie` header. The FE authenticates
 *  via the auth service's httpOnly `token` cookie (not a Bearer header), so the
 *  guard accepts either. */
export function extractCookieToken(
  header: string | undefined,
  name: string = ACCESS_COOKIE,
): string | undefined {
  if (header === undefined) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      const value = decodeURIComponent(part.slice(idx + 1).trim());
      return value === '' ? undefined : value;
    }
  }
  return undefined;
}

/** Verifies an HS256 JWT against `secret`. Returns the decoded payload on
 *  success, `null` on any failure (missing parts, wrong alg, bad signature,
 *  expired, unrecognized shape). Blank secret NEVER authenticates. */
export function verifyJwt(
  token: string,
  secret: string,
  now: () => number = () => Math.floor(Date.now() / 1000),
): JwtPayload | null {
  if (secret === '') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (
    headerB64 === undefined ||
    payloadB64 === undefined ||
    sigB64 === undefined ||
    headerB64 === '' ||
    payloadB64 === '' ||
    sigB64 === ''
  ) {
    return null;
  }

  const header = safeJsonParse(base64UrlDecode(headerB64).toString('utf8'));
  if (typeof header !== 'object' || header === null) return null;
  const alg = (header as { alg?: unknown }).alg;
  if (alg !== 'HS256') return null;

  const signingInput = `${headerB64}.${payloadB64}`;
  const expected = createHmac('sha256', secret).update(signingInput).digest();
  const actual = base64UrlDecode(sigB64);
  if (actual.length !== expected.length) return null;
  if (!timingSafeEqual(actual, expected)) return null;

  const payload = safeJsonParse(base64UrlDecode(payloadB64).toString('utf8'));
  if (!isJwtPayload(payload)) return null;
  if (payload.exp <= now()) return null;

  return payload;
}

export interface JwtAuthOptions {
  readonly secret: string;
  readonly now?: () => number;
}

export type JwtAuthGuard = (
  req: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
) => void;

/** Fastify preHandler: verifies bearer JWT, populates `req.user` +
 *  `req.hotelId` (Q-C-04 tenancy binding). Throws `AuthError` (401) on
 *  missing / malformed / invalid / expired token. */
export function jwtAuthGuard(opts: JwtAuthOptions): JwtAuthGuard {
  const nowFn = opts.now ?? (() => Math.floor(Date.now() / 1000));
  return function jwtGuard(req, _reply, done): void {
    const token =
      extractBearerToken(req.headers.authorization) ?? extractCookieToken(req.headers.cookie);
    if (token === undefined) {
      done(new AuthError('Missing session token (Bearer header or `token` cookie)'));
      return;
    }
    const payload = verifyJwt(token, opts.secret, nowFn);
    if (payload === null) {
      done(new AuthError('Invalid or expired JWT'));
      return;
    }
    req.user = payload;
    // `hotelId` is null for super_admin (all-hotels). Leave `req.hotelId` unset
    // in that case; hotel-scoped routes call `requireHotelId(req.hotelId)`, which
    // rejects the missing case — the correct behavior for a per-hotel surface.
    if (payload.hotelId !== null) {
      req.hotelId = payload.hotelId;
    }
    done();
  };
}

/** Fastify preHandler: chains after `jwtAuthGuard`. Grants access when
 *  the session role is in `allowed` OR when the role is `super_admin`
 *  (spec §8 all-access rule). Throws `AuthError` if unauthenticated,
 *  `ForbiddenError` (403) if authenticated but role not permitted. */
export function requireRole(...allowed: readonly UserRole[]): JwtAuthGuard {
  const allowedSet = new Set(allowed);
  return function roleGuard(req, _reply, done): void {
    const user = req.user;
    if (user === undefined) {
      done(new AuthError('Authentication required'));
      return;
    }
    if (user.role === 'super_admin' || allowedSet.has(user.role)) {
      done();
      return;
    }
    done(new ForbiddenError(`Role '${user.role}' is not permitted for this route`));
  };
}
