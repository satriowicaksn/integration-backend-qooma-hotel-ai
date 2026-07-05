/**
 * `http-webhook-pinger` adapter tests — asserts probe-semantics (PM B ACK
 * binding conditions #4, #5, #6):
 *  - simple GET, exact URL, NO `hub.*` params (spec-faithful; no invented
 *    Meta subscription-challenge protocol)
 *  - 3-outcome probe coverage: 2xx / non-2xx / network error — NONE throws
 *  - NO `Authorization` / auth header sent — hotel's webhook_url is public
 */

import { describe, expect, it, jest } from '@jest/globals';

import {
  createHttpWebhookPingerAdapter,
  type HttpPoster,
} from '../adapters/http-webhook-pinger.adapter.js';

const WEBHOOK_URL = 'https://hotel.example.com/webhook/whatsapp/abc';

function buildAdapter(get: jest.Mock, config?: { timeoutMs?: number }) {
  const http = { get } as unknown as HttpPoster;
  return createHttpWebhookPingerAdapter(config ? { http, config } : { http });
}

describe('createHttpWebhookPingerAdapter.ping — 2xx reachable', () => {
  it('should return reachable=true with statusCode 200 when the URL responds 200', async () => {
    const get = jest.fn(() => Promise.resolve({ data: 'ok', status: 200 }));
    const adapter = buildAdapter(get);

    const result = await adapter.ping({ url: WEBHOOK_URL });

    expect(result).toEqual({ reachable: true, statusCode: 200 });
  });

  it('should return reachable=true for any other 2xx (e.g., 204)', async () => {
    const get = jest.fn(() => Promise.resolve({ data: undefined, status: 204 }));
    const adapter = buildAdapter(get);

    const result = await adapter.ping({ url: WEBHOOK_URL });

    expect(result).toEqual({ reachable: true, statusCode: 204 });
  });

  it('should GET the URL exactly as passed with no hub.* params appended', async () => {
    const get = jest.fn(() => Promise.resolve({ data: 'ok', status: 200 }));
    const adapter = buildAdapter(get);

    await adapter.ping({ url: WEBHOOK_URL });

    expect(get).toHaveBeenCalledTimes(1);
    const passedUrl = get.mock.calls[0]?.[0] as string;
    expect(passedUrl).toBe(WEBHOOK_URL);
    expect(passedUrl).not.toContain('hub.mode');
    expect(passedUrl).not.toContain('hub.verify_token');
    expect(passedUrl).not.toContain('hub.challenge');
  });

  it('should NOT send an Authorization / auth header — webhook_url is a public endpoint', async () => {
    const get = jest.fn(() => Promise.resolve({ data: 'ok', status: 200 }));
    const adapter = buildAdapter(get);

    await adapter.ping({ url: WEBHOOK_URL });

    const passedOpts = get.mock.calls[0]?.[1] as { headers?: Record<string, string> } | undefined;
    if (passedOpts?.headers !== undefined) {
      const headerKeys = Object.keys(passedOpts.headers).map((k) => k.toLowerCase());
      expect(headerKeys).not.toContain('authorization');
    }
  });

  it('should forward timeoutMs from config when provided', async () => {
    const get = jest.fn(() => Promise.resolve({ data: 'ok', status: 200 }));
    const adapter = buildAdapter(get, { timeoutMs: 5000 });

    await adapter.ping({ url: WEBHOOK_URL });

    const passedOpts = get.mock.calls[0]?.[1] as { timeoutMs?: number } | undefined;
    expect(passedOpts?.timeoutMs).toBe(5000);
  });

  it('should pass no request options when no timeoutMs is configured', async () => {
    const get = jest.fn(() => Promise.resolve({ data: 'ok', status: 200 }));
    const adapter = buildAdapter(get);

    await adapter.ping({ url: WEBHOOK_URL });

    expect(get.mock.calls[0]?.[1]).toBeUndefined();
  });
});

describe('createHttpWebhookPingerAdapter.ping — non-2xx (does NOT throw)', () => {
  it('should return reachable=false with statusCode when hotel returns 404', async () => {
    const get = jest.fn(() => Promise.resolve({ data: 'not found', status: 404 }));
    const adapter = buildAdapter(get);

    await expect(adapter.ping({ url: WEBHOOK_URL })).resolves.toEqual({
      reachable: false,
      statusCode: 404,
    });
  });

  it('should return reachable=false with statusCode when hotel returns 500', async () => {
    const get = jest.fn(() => Promise.resolve({ data: 'server error', status: 500 }));
    const adapter = buildAdapter(get);

    await expect(adapter.ping({ url: WEBHOOK_URL })).resolves.toEqual({
      reachable: false,
      statusCode: 500,
    });
  });

  it('should return reachable=false for 3xx (spec: only 2xx counts as reachable)', async () => {
    const get = jest.fn(() => Promise.resolve({ data: '', status: 301 }));
    const adapter = buildAdapter(get);

    await expect(adapter.ping({ url: WEBHOOK_URL })).resolves.toEqual({
      reachable: false,
      statusCode: 301,
    });
  });
});

describe('createHttpWebhookPingerAdapter.ping — network error (does NOT throw)', () => {
  it('should return reachable=false with statusCode undefined when the http call rejects with Error', async () => {
    const get = jest.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    const adapter = buildAdapter(get);

    await expect(adapter.ping({ url: WEBHOOK_URL })).resolves.toEqual({
      reachable: false,
    });
  });

  it('should return reachable=false with statusCode undefined when the http call rejects with non-Error value', async () => {
    const get = jest.fn(() => Promise.reject('timeout'));
    const adapter = buildAdapter(get);

    await expect(adapter.ping({ url: WEBHOOK_URL })).resolves.toEqual({
      reachable: false,
    });
  });
});
