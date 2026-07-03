import { createHmac } from 'node:crypto';

import { describe, it, expect } from '@jest/globals';
import Fastify, { type FastifyInstance } from 'fastify';

import {
  registerWebhookRawBody,
  verifyMetaSignature,
  verifyTelegramToken,
  verifyWebhookSignature,
  type WebhookProvider,
} from '../hmac-validator.plugin.js';

const SECRET = 'test-webhook-secret';

function metaSignature(rawBody: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(Buffer.from(rawBody, 'utf8')).digest('hex')}`;
}

interface Harness {
  app: FastifyInstance;
  didHandlerRun: () => boolean;
}

async function buildApp(provider: WebhookProvider, secret = SECRET): Promise<Harness> {
  let handlerRan = false;
  const app = Fastify();
  registerWebhookRawBody(app);
  app.post(
    `/webhook/${provider}/:slug`,
    {
      // Fastify async hooks are correct at runtime; no-misused-promises flags the
      // async fn on the preHandler property (checksVoidReturn.properties). Typecheck
      // passes. See SUBMIT note — project-level eslint config decision pending.
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: verifyWebhookSignature({ provider, resolveSecret: () => secret }),
    },
    () => {
      handlerRan = true;
      return { ok: true };
    },
  );
  await app.ready();
  return { app, didHandlerRun: () => handlerRan };
}

describe('verifyMetaSignature / verifyTelegramToken (pure)', () => {
  it('should return true when the meta signature matches the raw body', () => {
    const body = Buffer.from('{"a":1}', 'utf8');
    const header = metaSignature('{"a":1}', SECRET);
    expect(verifyMetaSignature(body, header, SECRET)).toBe(true);
  });

  it('should return false when the meta header lacks the sha256= prefix', () => {
    const body = Buffer.from('{"a":1}', 'utf8');
    expect(verifyMetaSignature(body, 'deadbeef', SECRET)).toBe(false);
  });

  it('should return false when the meta header is undefined', () => {
    expect(verifyMetaSignature(Buffer.from('x'), undefined, SECRET)).toBe(false);
  });

  it('should return false without throwing when provided hex length differs', () => {
    const body = Buffer.from('{"a":1}', 'utf8');
    expect(verifyMetaSignature(body, 'sha256=abcd', SECRET)).toBe(false);
  });

  it('should return true when the telegram secret token matches', () => {
    expect(verifyTelegramToken(SECRET, SECRET)).toBe(true);
  });

  it('should return false when the telegram token differs in length', () => {
    expect(verifyTelegramToken('short', SECRET)).toBe(false);
  });

  it('should return false when the telegram header is undefined', () => {
    expect(verifyTelegramToken(undefined, SECRET)).toBe(false);
  });
});

describe('whatsapp webhook signature guard (fastify.inject)', () => {
  it('should return 200 and run the handler when the signature is valid', async () => {
    const { app, didHandlerRun } = await buildApp('whatsapp');
    const payload = '{"messages":[{"id":"wamid.1"}]}';
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/whatsapp/acme',
      headers: {
        'content-type': 'application/json',
        [`x-hub-signature-256`]: metaSignature(payload, SECRET),
      },
      payload,
    });
    expect(res.statusCode).toBe(200);
    expect(didHandlerRun()).toBe(true);
    await app.close();
  });

  it('should verify HMAC over raw bytes, not re-serialized JSON', async () => {
    const { app, didHandlerRun } = await buildApp('whatsapp');
    // Non-canonical: extra whitespace + unsorted keys. A digest over
    // JSON.stringify(parsed) would differ from this raw byte sequence.
    const payload = '{"b":2,   "a":1}';
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/whatsapp/acme',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': metaSignature(payload, SECRET),
      },
      payload,
    });
    expect(res.statusCode).toBe(200);
    expect(didHandlerRun()).toBe(true);
    await app.close();
  });

  it('should return 401 and skip the handler when the signature is wrong', async () => {
    const { app, didHandlerRun } = await buildApp('whatsapp');
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/whatsapp/acme',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': metaSignature('{"a":1}', 'wrong-secret'),
      },
      payload: '{"a":1}',
    });
    expect(res.statusCode).toBe(401);
    expect(didHandlerRun()).toBe(false);
    await app.close();
  });

  it('should return 401 when the signature header is missing', async () => {
    const { app, didHandlerRun } = await buildApp('whatsapp');
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/whatsapp/acme',
      headers: { 'content-type': 'application/json' },
      payload: '{"a":1}',
    });
    expect(res.statusCode).toBe(401);
    expect(didHandlerRun()).toBe(false);
    await app.close();
  });
});

describe('telegram webhook secret guard (fastify.inject)', () => {
  it('should return 200 when the secret token matches', async () => {
    const { app, didHandlerRun } = await buildApp('telegram');
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/telegram/acme',
      headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': SECRET },
      payload: '{"update_id":1}',
    });
    expect(res.statusCode).toBe(200);
    expect(didHandlerRun()).toBe(true);
    await app.close();
  });

  it('should return 401 and skip the handler when the secret token is wrong', async () => {
    const { app, didHandlerRun } = await buildApp('telegram');
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/telegram/acme',
      headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'nope' },
      payload: '{"update_id":1}',
    });
    expect(res.statusCode).toBe(401);
    expect(didHandlerRun()).toBe(false);
    await app.close();
  });
});

describe('registerWebhookRawBody content-type parser', () => {
  it('should parse an empty json body as undefined', async () => {
    const app = Fastify();
    registerWebhookRawBody(app);
    let received: unknown = 'unset';
    app.post('/x', (req) => {
      received = req.body;
      return { ok: true };
    });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/x',
      headers: { 'content-type': 'application/json' },
      payload: '',
    });
    expect(res.statusCode).toBe(200);
    expect(received).toBeUndefined();
    await app.close();
  });

  it('should reject a malformed json body with 400', async () => {
    const app = Fastify();
    registerWebhookRawBody(app);
    app.post('/x', () => ({ ok: true }));
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/x',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
