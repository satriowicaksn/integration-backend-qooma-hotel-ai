import { describe, expect, it } from '@jest/globals';

import { IntegrationOverviewResponseSchema } from '../integration-overview.schema.js';

const CHECKED_AT = '2026-07-07T09:30:00Z';

const FULL_RESPONSE = {
  whatsapp: {
    bsp: '1engage',
    phone_number: '+6281234567890',
    phone_number_id: '109876543210987',
    verified_at: '2026-07-01T12:00:00Z',
    has_access_token: true,
    webhook_url: 'https://example.com/wa-webhook',
    webhook_verify_token: 'verify-token-abc',
    waba_id: null,
  },
  telegram: {
    bot_username: 'qooma_demo_bot',
    has_bot_token: true,
    default_chat_id: '-100999',
    webhook_url: null,
  },
  qr: {
    url: 'https://wa.me/6281234567890',
    png_url: 'https://cdn.example.com/qr/hotel-1.png',
    generated_at: '2026-07-06T22:30:00Z',
  },
  health: {
    whatsapp: { status: 'healthy', last_message_at: '2026-07-07T09:29:12Z' },
    telegram: { status: 'degraded', last_message_at: null },
    claude_api: { status: 'healthy', last_check_at: CHECKED_AT, uptime_30d: 99.7 },
  },
};

describe('IntegrationOverviewResponseSchema', () => {
  it('should parse a full response with every subsystem populated', () => {
    const parsed = IntegrationOverviewResponseSchema.parse(FULL_RESPONSE);
    expect(parsed.whatsapp?.phone_number).toBe('+6281234567890');
    expect(parsed.telegram?.default_chat_id).toBe('-100999');
    expect(parsed.qr?.png_url).toContain('cdn.example.com');
    expect(parsed.health.claude_api.uptime_30d).toBe(99.7);
  });

  it('should parse a response with WA/Telegram/QR null and health synthetic-down', () => {
    const parsed = IntegrationOverviewResponseSchema.parse({
      whatsapp: null,
      telegram: null,
      qr: null,
      health: {
        whatsapp: { status: 'down' },
        telegram: { status: 'down' },
        claude_api: { status: 'down', last_check_at: CHECKED_AT },
      },
    });
    expect(parsed.whatsapp).toBeNull();
    expect(parsed.telegram).toBeNull();
    expect(parsed.qr).toBeNull();
    expect(parsed.health.whatsapp.status).toBe('down');
  });

  it('should reject unknown top-level keys (binding #4 strict)', () => {
    expect(() =>
      IntegrationOverviewResponseSchema.parse({ ...FULL_RESPONSE, evil: true }),
    ).toThrow();
  });

  it('should reject an unknown health status value', () => {
    expect(() =>
      IntegrationOverviewResponseSchema.parse({
        ...FULL_RESPONSE,
        health: {
          whatsapp: { status: 'unknown' },
          telegram: { status: 'down' },
          claude_api: { status: 'down', last_check_at: CHECKED_AT },
        },
      }),
    ).toThrow();
  });

  it('should reject if the health object is missing (binding #3 always present)', () => {
    const { health: _drop, ...rest } = FULL_RESPONSE;
    void _drop;
    expect(() => IntegrationOverviewResponseSchema.parse(rest)).toThrow();
  });

  it('should reject out-of-range uptime_30d', () => {
    expect(() =>
      IntegrationOverviewResponseSchema.parse({
        ...FULL_RESPONSE,
        health: {
          ...FULL_RESPONSE.health,
          claude_api: { status: 'healthy', last_check_at: CHECKED_AT, uptime_30d: 150 },
        },
      }),
    ).toThrow();
  });
});
