// zod schemas for T29 WA conversation + message internal RPC (ADR-0010).
// Wire snake_case; `.strict()` at request boundary; cursor is opaque base64.

import { z } from 'zod';

const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 200;

export const ConversationsListRequestSchema = z
  .object({
    hotel_id: z.string().uuid(),
    cursor: z.string().min(1).optional(),
    limit: z.number().int().positive().max(LIMIT_MAX).optional(),
  })
  .strict();

export const MessagesListRequestSchema = z
  .object({
    hotel_id: z.string().uuid(),
    conversation_id: z.string().uuid(),
    cursor: z.string().min(1).optional(),
    limit: z.number().int().positive().max(LIMIT_MAX).optional(),
  })
  .strict();

export type ConversationsListRequestDto = z.infer<typeof ConversationsListRequestSchema>;
export type MessagesListRequestDto = z.infer<typeof MessagesListRequestSchema>;

const ConversationWireSchema = z
  .object({
    id: z.string().uuid(),
    hotel_id: z.string().uuid(),
    wa_config_id: z.string().uuid(),
    guest_wa_phone: z.string(),
    guest_id: z.string().uuid().nullable(),
    last_message_at: z.string(),
    last_message_preview: z.string().nullable(),
    unread_count: z.number().int().nonnegative(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

const MessageWireSchema = z
  .object({
    id: z.string().uuid(),
    conversation_id: z.string().uuid(),
    direction: z.enum(['inbound', 'outbound']),
    body: z.string().nullable(),
    template_ref: z.string().nullable(),
    template_variables: z.unknown(),
    external_message_id: z.string().nullable(),
    status: z.string(),
    received_at: z.string().nullable(),
    sent_at: z.string().nullable(),
    dispatch_id: z.string().uuid().nullable(),
    webhook_event_id: z.string().uuid().nullable(),
    created_at: z.string(),
  })
  .strict();

export const ConversationsListResponseSchema = z
  .object({
    items: z.array(ConversationWireSchema),
    next_cursor: z.string().nullable(),
  })
  .strict();

export const MessagesListResponseSchema = z
  .object({
    items: z.array(MessageWireSchema),
    next_cursor: z.string().nullable(),
  })
  .strict();

export type ConversationsListResponseDto = z.infer<typeof ConversationsListResponseSchema>;
export type MessagesListResponseDto = z.infer<typeof MessagesListResponseSchema>;

export const LIST_LIMIT_DEFAULT = LIMIT_DEFAULT;
export const LIST_LIMIT_MAX = LIMIT_MAX;
