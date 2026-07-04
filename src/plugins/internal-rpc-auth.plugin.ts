/**
 * Internal RPC authentication (service-to-service).
 *
 * RPCs from Hotel Core / AI authenticate with a shared secret in the
 * `X-Internal-Secret` header — NOT session cookies / user JWT (MVP §4.11).
 * The guard runs as a synchronous `preHandler`: a missing/wrong secret throws
 * `AuthError` (401) before the handler, so the RPC handler never runs.
 *
 * The expected secret is injected (from config at wiring time) — this primitive
 * has no config/prisma coupling. mTLS, if used, is terminated at the TLS/LB
 * layer, not here.
 */

import { timingSafeEqual } from 'node:crypto';

import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';

import { AuthError } from '@core/errors/app-errors.js';

const INTERNAL_SECRET_HEADER = 'x-internal-secret';

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyInternalSecret(provided: string | undefined, expected: string): boolean {
  // A blank configured secret must never authenticate.
  if (provided === undefined || expected === '') return false;
  return timingSafeStringEqual(provided, expected);
}

export interface InternalRpcAuthOptions {
  secret: string;
}

export type InternalRpcGuard = (
  req: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
) => void;

export function internalRpcAuthGuard(opts: InternalRpcAuthOptions): InternalRpcGuard {
  return function internalRpcGuard(req, _reply, done): void {
    const header = req.headers[INTERNAL_SECRET_HEADER];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!verifyInternalSecret(provided, opts.secret)) {
      done(new AuthError('Invalid internal RPC credentials'));
      return;
    }
    done();
  };
}
