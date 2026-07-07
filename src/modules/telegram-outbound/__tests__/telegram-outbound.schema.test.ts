import { describe, expect, it } from '@jest/globals';

import {
  SendTelegramMessageRequestSchema,
  SendTelegramMessageResponseSchema,
} from '../telegram-outbound.schema.js';

const VALID_REQUEST = {
  hotel_id: '11111111-2222-3333-4444-555555555555',
  chat_id: '-1001234567890',
  body: 'Escalation: ticket #42 pending 15+ min',
  parse_mode: 'HTML' as const,
};

describe('SendTelegramMessageRequestSchema', () => {
  it('should parse a full valid request', () => {
    expect(SendTelegramMessageRequestSchema.parse(VALID_REQUEST)).toEqual(VALID_REQUEST);
  });

  it('should parse a request without parse_mode (plaintext default at Telegram side)', () => {
    const { parse_mode: _drop, ...rest } = VALID_REQUEST;
    void _drop;
    expect(SendTelegramMessageRequestSchema.parse(rest)).toEqual(rest);
  });

  it('should reject a non-UUID hotel_id', () => {
    expect(() =>
      SendTelegramMessageRequestSchema.parse({ ...VALID_REQUEST, hotel_id: 'not-uuid' }),
    ).toThrow();
  });

  it('should reject an empty chat_id', () => {
    expect(() =>
      SendTelegramMessageRequestSchema.parse({ ...VALID_REQUEST, chat_id: '' }),
    ).toThrow();
  });

  it('should reject an empty body', () => {
    expect(() => SendTelegramMessageRequestSchema.parse({ ...VALID_REQUEST, body: '' })).toThrow();
  });

  it('should reject a body that exceeds 4096 chars (Telegram API limit, binding #12)', () => {
    const overlong = 'x'.repeat(4097);
    expect(() =>
      SendTelegramMessageRequestSchema.parse({ ...VALID_REQUEST, body: overlong }),
    ).toThrow();
  });

  it('should reject legacy Markdown parse_mode (binding #13 — only MarkdownV2 supported)', () => {
    expect(() =>
      SendTelegramMessageRequestSchema.parse({ ...VALID_REQUEST, parse_mode: 'Markdown' }),
    ).toThrow();
  });

  it('should reject unknown top-level keys (binding #14 strict)', () => {
    expect(() =>
      SendTelegramMessageRequestSchema.parse({ ...VALID_REQUEST, extra: 'nope' }),
    ).toThrow();
  });
});

describe('SendTelegramMessageResponseSchema', () => {
  it('should parse a valid response', () => {
    expect(
      SendTelegramMessageResponseSchema.parse({
        message_id: '9876543210',
        sent_at: '2026-07-07T14:30:00Z',
      }),
    ).toEqual({ message_id: '9876543210', sent_at: '2026-07-07T14:30:00Z' });
  });

  it('should reject numeric message_id (binding #11 — string wire type)', () => {
    expect(() =>
      SendTelegramMessageResponseSchema.parse({
        message_id: 9876543210,
        sent_at: '2026-07-07T14:30:00Z',
      }),
    ).toThrow();
  });
});
