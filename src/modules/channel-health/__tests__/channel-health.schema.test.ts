import { describe, expect, it } from '@jest/globals';

import { HealthResponseSchema } from '../channel-health.schema.js';

const FULL_RESPONSE = {
  claude_api: {
    status: 'healthy',
    last_check_at: '2026-07-06T14:00:00Z',
    uptime_30d: 99.7,
    avg_response_ms: 1284,
  },
  whatsapp: { status: 'healthy', last_message_at: '2026-07-06T13:59:12Z' },
  telegram: { status: 'degraded', last_message_at: null },
};

describe('HealthResponseSchema', () => {
  it('should parse a full response with all optional fields', () => {
    const parsed = HealthResponseSchema.parse(FULL_RESPONSE);
    expect(parsed.claude_api.uptime_30d).toBe(99.7);
    expect(parsed.telegram.status).toBe('degraded');
    expect(parsed.whatsapp.last_message_at).toBe('2026-07-06T13:59:12Z');
  });

  it('should parse a minimal response (WA/Telegram without last_message_at)', () => {
    const parsed = HealthResponseSchema.parse({
      claude_api: { status: 'down', last_check_at: '2026-07-06T14:00:00Z' },
      whatsapp: { status: 'healthy' },
      telegram: { status: 'healthy' },
    });
    expect(parsed.whatsapp.status).toBe('healthy');
    expect(parsed.whatsapp.last_message_at).toBeUndefined();
  });

  it('should reject an unknown status value', () => {
    expect(() =>
      HealthResponseSchema.parse({
        claude_api: { status: 'yellow', last_check_at: '2026-07-06T14:00:00Z' },
        whatsapp: { status: 'healthy' },
        telegram: { status: 'healthy' },
      }),
    ).toThrow();
  });

  it('should reject uptime_30d out of range', () => {
    expect(() =>
      HealthResponseSchema.parse({
        claude_api: {
          status: 'healthy',
          last_check_at: '2026-07-06T14:00:00Z',
          uptime_30d: 150,
        },
        whatsapp: { status: 'healthy' },
        telegram: { status: 'healthy' },
      }),
    ).toThrow();
  });

  it('should reject negative avg_response_ms', () => {
    expect(() =>
      HealthResponseSchema.parse({
        claude_api: {
          status: 'healthy',
          last_check_at: '2026-07-06T14:00:00Z',
          avg_response_ms: -1,
        },
        whatsapp: { status: 'healthy' },
        telegram: { status: 'healthy' },
      }),
    ).toThrow();
  });
});
