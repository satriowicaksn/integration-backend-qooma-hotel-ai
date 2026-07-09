// Internal RPC routes for T29 WA conversation + message read (ADR-0010,
// spec §2.4 internal RPC surface). Both endpoints are behind
// `internalRpcAuthGuard` (T09; `X-Internal-Secret` header per spec
// §4.11), NOT JWT — HC calls these, not the FE.
//
// Tenant isolation: `messages.list` requires the caller supply `hotel_id`;
// the service validates the target conversation belongs to that hotel
// (anti-enumeration — cross-tenant lookups return 404, byte-identical to
// unknown-conversation).

import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';

import { NotFoundError, ValidationError } from '@core/errors/app-errors.js';

import type { WhatsappConversationsRepository } from './whatsapp-conversations.repository.js';
import {
  ConversationsListRequestSchema,
  MessagesListRequestSchema,
} from './whatsapp-conversations.schema.js';
import type { WhatsappConversationsService } from './whatsapp-conversations.service.js';
import type { ConversationDomain, MessageDomain } from './whatsapp-conversations.types.js';

export interface WhatsappConversationsRoutesOptions {
  readonly service: WhatsappConversationsService;
  readonly repository: WhatsappConversationsRepository;
  readonly guards: readonly preHandlerHookHandler[];
}

export const whatsappConversationsRoutes: FastifyPluginAsync<WhatsappConversationsRoutesOptions> = (
  fastify,
  opts,
) => {
  const preHandler = [...opts.guards] as preHandlerHookHandler[];

  fastify.post('/internal/wa/conversations.list', { preHandler }, async (req) => {
    const parsed = ConversationsListRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid conversations.list payload', {
        issues: parsed.error.issues,
      });
    }
    try {
      const page = await opts.service.listConversations({
        hotelId: parsed.data.hotel_id,
        cursor: parsed.data.cursor ?? null,
        limit: parsed.data.limit ?? null,
      });
      return {
        items: page.items.map(toConversationWire),
        next_cursor: page.nextCursor,
      };
    } catch (err) {
      if (err instanceof TypeError && err.message.startsWith('malformed cursor')) {
        throw new ValidationError('Invalid cursor');
      }
      throw err;
    }
  });

  fastify.post('/internal/wa/messages.list', { preHandler }, async (req) => {
    const parsed = MessagesListRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid messages.list payload', {
        issues: parsed.error.issues,
      });
    }
    const tenancy = await opts.repository.findConversationById({
      hotelId: parsed.data.hotel_id,
      conversationId: parsed.data.conversation_id,
    });
    if (tenancy === null) {
      // Anti-enumeration: null-conversation OR cross-tenant both map to the
      // same 404 shape.
      throw new NotFoundError('conversation', parsed.data.conversation_id);
    }
    try {
      const page = await opts.service.listMessages({
        hotelId: parsed.data.hotel_id,
        conversationId: parsed.data.conversation_id,
        cursor: parsed.data.cursor ?? null,
        limit: parsed.data.limit ?? null,
      });
      return {
        items: page.items.map(toMessageWire),
        next_cursor: page.nextCursor,
      };
    } catch (err) {
      if (err instanceof TypeError && err.message.startsWith('malformed cursor')) {
        throw new ValidationError('Invalid cursor');
      }
      throw err;
    }
  });

  return Promise.resolve();
};

function toConversationWire(row: ConversationDomain): Record<string, unknown> {
  return {
    id: row.id,
    hotel_id: row.hotelId,
    wa_config_id: row.waConfigId,
    guest_wa_phone: row.guestWaPhone,
    guest_id: row.guestId,
    last_message_at: row.lastMessageAt.toISOString(),
    last_message_preview: row.lastMessagePreview,
    unread_count: row.unreadCount,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function toMessageWire(row: MessageDomain): Record<string, unknown> {
  return {
    id: row.id,
    conversation_id: row.conversationId,
    direction: row.direction,
    body: row.body,
    template_ref: row.templateRef,
    template_variables: row.templateVariables ?? null,
    external_message_id: row.externalMessageId,
    status: row.status,
    received_at: row.receivedAt === null ? null : row.receivedAt.toISOString(),
    sent_at: row.sentAt === null ? null : row.sentAt.toISOString(),
    dispatch_id: row.dispatchId,
    webhook_event_id: row.webhookEventId,
    created_at: row.createdAt.toISOString(),
  };
}
