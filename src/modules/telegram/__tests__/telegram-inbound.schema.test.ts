import { describe, expect, it } from '@jest/globals';

import { TelegramUpdateSchema } from '../telegram-inbound.schema.js';

const VALID_UPDATE = {
  update_id: 12345,
  message: {
    message_id: 1,
    date: 1728000000,
    chat: { id: -1001234567890, type: 'supergroup' },
    from: { id: 87654321, is_bot: false, first_name: 'Alice', username: 'alice_staff' },
    text: '/take 1234',
  },
};

describe('TelegramUpdateSchema', () => {
  it('should parse a minimal valid update', () => {
    const parsed = TelegramUpdateSchema.parse({ update_id: 1 });
    expect(parsed.update_id).toBe(1);
    expect(parsed.message).toBeUndefined();
  });

  it('should parse a full update with message + from + text', () => {
    const parsed = TelegramUpdateSchema.parse(VALID_UPDATE);
    expect(parsed.update_id).toBe(12345);
    expect(parsed.message?.text).toBe('/take 1234');
    expect(parsed.message?.from?.id).toBe(87654321);
    expect(parsed.message?.chat.id).toBe(-1001234567890);
  });

  it('should preserve unknown top-level fields (passthrough) so Telegram evolutions do not break intake', () => {
    const withUnknown = { ...VALID_UPDATE, edited_message: { message_id: 2 } };
    const parsed = TelegramUpdateSchema.parse(withUnknown);
    expect((parsed as { edited_message?: unknown }).edited_message).toBeDefined();
  });

  it('should reject when update_id is missing', () => {
    expect(() => TelegramUpdateSchema.parse({})).toThrow();
  });

  it('should reject when update_id is not an integer', () => {
    expect(() => TelegramUpdateSchema.parse({ update_id: 'nope' })).toThrow();
  });

  it('should reject when message.chat.id is missing', () => {
    expect(() =>
      TelegramUpdateSchema.parse({
        update_id: 1,
        message: { message_id: 1, date: 1, chat: {} },
      }),
    ).toThrow();
  });
});
