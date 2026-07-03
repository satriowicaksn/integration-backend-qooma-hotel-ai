/**
 * Webhook signature verification for inbound provider callbacks.
 *
 * Runs plugin-level BEFORE the route handler (as a preHandler hook): an invalid
 * signature throws `AuthError` (401) so the handler never executes — no
 * `webhook_events` row is ever written for a spoofed request.
 *
 * - WhatsApp / Meta: `X-Hub-Signature-256: sha256=<hmac-sha256(rawBody, secret)>`.
 * - Telegram: `X-Telegram-Bot-Api-Secret-Token: <secret>` (Telegram echoes the
 *   secret set at setWebhook time — it does not HMAC-sign the body).
 *
 * The HMAC MUST be computed over the raw request bytes, so this module also
 * provides a content-type parser that captures `req.rawBody`. The per-hotel
 * secret is injected via `resolveSecret` (hexagonal-disiplin) — this primitive
 * has no knowledge of tenant resolution or config storage.
 *
 * Lihat docs/SECURITY.md §4.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import { AuthError, ValidationError } from '@core/errors/app-errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

const META_SIGNATURE_PREFIX = 'sha256=';
const META_SIGNATURE_HEADER = 'x-hub-signature-256';
const TELEGRAM_SECRET_HEADER = 'x-telegram-bot-api-secret-token';

export type WebhookProvider = 'whatsapp' | 'telegram';

export type ResolveSecret = (req: FastifyRequest) => string | Promise<string>;

export interface VerifyWebhookOptions {
  provider: WebhookProvider;
  resolveSecret: ResolveSecret;
}

/** Fastify preHandler hook: verifies the signature, throwing `AuthError` on failure. */
export type WebhookSignatureGuard = (req: FastifyRequest) => Promise<void>;

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function headerValue(req: FastifyRequest, name: string): string | undefined {
  const raw = req.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

export function verifyMetaSignature(
  rawBody: Buffer,
  header: string | undefined,
  secret: string,
): boolean {
  if (header === undefined || !header.startsWith(META_SIGNATURE_PREFIX)) return false;
  const provided = header.slice(META_SIGNATURE_PREFIX.length);
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return constantTimeEqual(provided, expected);
}

export function verifyTelegramToken(header: string | undefined, secret: string): boolean {
  if (header === undefined) return false;
  return constantTimeEqual(header, secret);
}

/**
 * Register a content-type parser that keeps the raw request bytes on
 * `req.rawBody` while still exposing the parsed JSON to handlers. Call this on
 * the scope that owns the webhook routes so HMAC can verify over raw bytes.
 */
export function registerWebhookRawBody(app: FastifyInstance): void {
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    req.rawBody = buf;
    if (buf.length === 0) {
      done(null, undefined);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(buf.toString('utf8'));
      done(null, parsed);
    } catch {
      done(new ValidationError('Invalid JSON in request body'), undefined);
    }
  });
}

/**
 * Build a preHandler hook that verifies the provider signature before the route
 * handler runs. Throws `AuthError` (401) on any failure.
 */
export function verifyWebhookSignature(opts: VerifyWebhookOptions): WebhookSignatureGuard {
  return async function webhookSignatureGuard(req): Promise<void> {
    const secret = await opts.resolveSecret(req);
    const rawBody = req.rawBody ?? Buffer.alloc(0);

    const valid =
      opts.provider === 'whatsapp'
        ? verifyMetaSignature(rawBody, headerValue(req, META_SIGNATURE_HEADER), secret)
        : verifyTelegramToken(headerValue(req, TELEGRAM_SECRET_HEADER), secret);

    if (!valid) {
      throw new AuthError('Invalid webhook signature');
    }
  };
}
