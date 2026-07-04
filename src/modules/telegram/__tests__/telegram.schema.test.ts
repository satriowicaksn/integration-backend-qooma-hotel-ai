import { describe, expect, it } from '@jest/globals';

import { TelegramConfigPutSchema, TelegramConfigResponseSchema } from '../telegram.schema.js';

const VALID_INPUT = {
  botToken: '123456789:AAABBBcccDDDEeeFFFgggHHHiiiJJJkkk',
  botUsername: 'qooma_demo_bot',
};

describe('TelegramConfigPutSchema', () => {
  it('should parse a minimal valid payload', () => {
    const parsed = TelegramConfigPutSchema.parse(VALID_INPUT);
    expect(parsed.botToken).toBe(VALID_INPUT.botToken);
    expect(parsed.botUsername).toBe(VALID_INPUT.botUsername);
  });

  it('should accept optional fields when provided', () => {
    const parsed = TelegramConfigPutSchema.parse({
      ...VALID_INPUT,
      defaultChatId: '-100999',
      gmTelegramId: '42',
      webhookUrl: 'https://example.com/tg',
    });
    expect(parsed.defaultChatId).toBe('-100999');
    expect(parsed.gmTelegramId).toBe('42');
    expect(parsed.webhookUrl).toBe('https://example.com/tg');
  });

  it('should reject bot_token shorter than 20 chars', () => {
    expect(() => TelegramConfigPutSchema.parse({ ...VALID_INPUT, botToken: 'short' })).toThrow();
  });

  it('should reject bot_username with disallowed characters', () => {
    expect(() =>
      TelegramConfigPutSchema.parse({ ...VALID_INPUT, botUsername: 'has space' }),
    ).toThrow();
  });

  it('should reject webhook_url that is not a valid URL', () => {
    expect(() =>
      TelegramConfigPutSchema.parse({ ...VALID_INPUT, webhookUrl: 'not-a-url' }),
    ).toThrow();
  });

  it('should reject unknown fields (strict schema)', () => {
    expect(() => TelegramConfigPutSchema.parse({ ...VALID_INPUT, extra: 'nope' })).toThrow();
  });
});

describe('TelegramConfigResponseSchema', () => {
  it('should parse a full response payload', () => {
    const parsed = TelegramConfigResponseSchema.parse({
      hotelId: '11111111-2222-3333-4444-555555555555',
      botToken: '***kkk',
      botUsername: 'qooma_demo_bot',
      defaultChatId: null,
      gmTelegramId: null,
      webhookUrl: null,
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
    });
    expect(parsed.hotelId).toBe('11111111-2222-3333-4444-555555555555');
    expect(parsed.createdAt).toBeInstanceOf(Date);
  });

  it('should reject non-uuid hotelId', () => {
    expect(() =>
      TelegramConfigResponseSchema.parse({
        hotelId: 'not-uuid',
        botToken: '***xyz',
        botUsername: 'qooma_demo_bot',
        defaultChatId: null,
        gmTelegramId: null,
        webhookUrl: null,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
      }),
    ).toThrow();
  });
});
