// Unit tests for T29 WA conversation zod schemas (ADR-0010).
// Covers `.strict()` boundary enforcement, uuid checks, limit bounds,
// and response wire shape.

import { describe, expect, it } from '@jest/globals';

import {
  ConversationsListRequestSchema,
  ConversationsListResponseSchema,
  LIST_LIMIT_DEFAULT,
  LIST_LIMIT_MAX,
  MessagesListRequestSchema,
  MessagesListResponseSchema,
} from '../whatsapp-conversations.schema.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const CONVERSATION_ID = '22222222-3333-4444-5555-666666666666';

describe('ConversationsListRequestSchema', () => {
  it('should parse a minimal request when only hotel_id is present', () => {
    const parsed = ConversationsListRequestSchema.parse({ hotel_id: HOTEL_ID });
    expect(parsed.hotel_id).toBe(HOTEL_ID);
    expect(parsed.cursor).toBeUndefined();
    expect(parsed.limit).toBeUndefined();
  });

  it('should parse a full request when cursor and limit are supplied', () => {
    const parsed = ConversationsListRequestSchema.parse({
      hotel_id: HOTEL_ID,
      cursor: 'abc',
      limit: 25,
    });
    expect(parsed.limit).toBe(25);
    expect(parsed.cursor).toBe('abc');
  });

  it('should reject the payload when hotel_id is not a uuid', () => {
    const result = ConversationsListRequestSchema.safeParse({ hotel_id: 'not-uuid' });
    expect(result.success).toBe(false);
  });

  it('should reject the payload when an unknown extra field is present', () => {
    const result = ConversationsListRequestSchema.safeParse({
      hotel_id: HOTEL_ID,
      unexpected: 'nope',
    });
    expect(result.success).toBe(false);
  });

  it('should reject the payload when limit exceeds LIST_LIMIT_MAX', () => {
    const result = ConversationsListRequestSchema.safeParse({
      hotel_id: HOTEL_ID,
      limit: LIST_LIMIT_MAX + 1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject the payload when limit is zero or negative', () => {
    expect(ConversationsListRequestSchema.safeParse({ hotel_id: HOTEL_ID, limit: 0 }).success).toBe(
      false,
    );
    expect(
      ConversationsListRequestSchema.safeParse({ hotel_id: HOTEL_ID, limit: -3 }).success,
    ).toBe(false);
  });

  it('should reject the payload when limit is not an integer', () => {
    const result = ConversationsListRequestSchema.safeParse({ hotel_id: HOTEL_ID, limit: 1.5 });
    expect(result.success).toBe(false);
  });

  it('should reject the payload when cursor is an empty string', () => {
    const result = ConversationsListRequestSchema.safeParse({ hotel_id: HOTEL_ID, cursor: '' });
    expect(result.success).toBe(false);
  });
});

describe('MessagesListRequestSchema', () => {
  it('should parse a minimal request when hotel_id and conversation_id are present', () => {
    const parsed = MessagesListRequestSchema.parse({
      hotel_id: HOTEL_ID,
      conversation_id: CONVERSATION_ID,
    });
    expect(parsed.conversation_id).toBe(CONVERSATION_ID);
  });

  it('should reject the payload when conversation_id is missing', () => {
    const result = MessagesListRequestSchema.safeParse({ hotel_id: HOTEL_ID });
    expect(result.success).toBe(false);
  });

  it('should reject the payload when conversation_id is not a uuid', () => {
    const result = MessagesListRequestSchema.safeParse({
      hotel_id: HOTEL_ID,
      conversation_id: 'not-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject the payload when an unknown extra field is present', () => {
    const result = MessagesListRequestSchema.safeParse({
      hotel_id: HOTEL_ID,
      conversation_id: CONVERSATION_ID,
      extra: 'nope',
    });
    expect(result.success).toBe(false);
  });
});

describe('ConversationsListResponseSchema', () => {
  const validRow = {
    id: CONVERSATION_ID,
    hotel_id: HOTEL_ID,
    wa_config_id: '33333333-4444-5555-6666-777777777777',
    guest_wa_phone: '+6281234567890',
    guest_id: null,
    last_message_at: '2026-07-08T00:00:00.000Z',
    last_message_preview: 'hi there',
    unread_count: 2,
    created_at: '2026-07-08T00:00:00.000Z',
    updated_at: '2026-07-08T00:00:00.000Z',
  };

  it('should parse an empty items array with null next_cursor', () => {
    const parsed = ConversationsListResponseSchema.parse({ items: [], next_cursor: null });
    expect(parsed.items).toEqual([]);
    expect(parsed.next_cursor).toBeNull();
  });

  it('should parse a single-item page with a next_cursor string', () => {
    const parsed = ConversationsListResponseSchema.parse({
      items: [validRow],
      next_cursor: 'opaque-cursor-abc',
    });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.next_cursor).toBe('opaque-cursor-abc');
  });

  it('should reject the response when unread_count is negative', () => {
    const result = ConversationsListResponseSchema.safeParse({
      items: [{ ...validRow, unread_count: -1 }],
      next_cursor: null,
    });
    expect(result.success).toBe(false);
  });

  it('should reject the response when an unknown extra field is present at row level', () => {
    const result = ConversationsListResponseSchema.safeParse({
      items: [{ ...validRow, extra: 'nope' }],
      next_cursor: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('MessagesListResponseSchema', () => {
  const validMessage = {
    id: '44444444-5555-6666-7777-888888888888',
    conversation_id: CONVERSATION_ID,
    direction: 'inbound' as const,
    body: 'hello',
    template_ref: null,
    template_variables: null,
    external_message_id: 'wamid.HBg',
    status: 'received',
    received_at: '2026-07-08T00:00:00.000Z',
    sent_at: null,
    dispatch_id: null,
    webhook_event_id: null,
    created_at: '2026-07-08T00:00:00.000Z',
  };

  it('should parse a valid inbound message page', () => {
    const parsed = MessagesListResponseSchema.parse({
      items: [validMessage],
      next_cursor: null,
    });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.direction).toBe('inbound');
  });

  it('should reject the response when direction is not inbound or outbound', () => {
    const result = MessagesListResponseSchema.safeParse({
      items: [{ ...validMessage, direction: 'sideways' }],
      next_cursor: null,
    });
    expect(result.success).toBe(false);
  });

  it('should accept an outbound message with sent_at and null received_at', () => {
    const parsed = MessagesListResponseSchema.parse({
      items: [
        {
          ...validMessage,
          direction: 'outbound',
          received_at: null,
          sent_at: '2026-07-08T01:00:00.000Z',
          status: 'sent',
        },
      ],
      next_cursor: 'cur-1',
    });
    expect(parsed.next_cursor).toBe('cur-1');
    expect(parsed.items[0]?.direction).toBe('outbound');
  });
});

describe('list-limit constants', () => {
  it('should expose LIST_LIMIT_DEFAULT = 50 and LIST_LIMIT_MAX = 200', () => {
    expect(LIST_LIMIT_DEFAULT).toBe(50);
    expect(LIST_LIMIT_MAX).toBe(200);
  });
});
