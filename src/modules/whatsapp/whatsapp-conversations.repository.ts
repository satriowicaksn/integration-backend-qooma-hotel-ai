// Prisma-direct repository for T29 WA conversations + messages
// (ADR-0001: no wrap interface). Ctor takes `PrismaClient` so
// integration tests can share the singleton and unit tests can plug
// a lightweight mock.

import type { PrismaClient } from '@prisma/client';

import type {
  ConversationDomain,
  CursorFilterConversations,
  CursorFilterMessages,
  MessageDomain,
  UpsertInboundInput,
  UpsertOutboundInput,
} from './whatsapp-conversations.types.js';

const PREVIEW_MAX_LENGTH = 200; // ADR-0010 line 52 — PM C ACK correction from 280.

export class WhatsappConversationsRepository {
  constructor(private readonly db: PrismaClient) {}

  async upsertOnInbound(input: UpsertInboundInput): Promise<{
    conversation: ConversationDomain;
    message: MessageDomain;
  }> {
    return this.db.$transaction(async (tx) => {
      const conversation = await tx.conversation.upsert({
        where: {
          hotelId_guestWaPhone: {
            hotelId: input.hotelId,
            guestWaPhone: input.guestWaPhone,
          },
        },
        create: {
          hotelId: input.hotelId,
          waConfigId: input.waConfigId,
          guestWaPhone: input.guestWaPhone,
          lastMessageAt: input.receivedAt,
          lastMessagePreview: truncatePreview(input.body),
          unreadCount: 1,
        },
        update: {
          lastMessageAt: input.receivedAt,
          lastMessagePreview: truncatePreview(input.body),
          unreadCount: { increment: 1 },
        },
      });
      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'inbound',
          body: input.body,
          externalMessageId: input.externalMessageId,
          status: 'received',
          receivedAt: input.receivedAt,
          webhookEventId: input.webhookEventId,
        },
      });
      return {
        conversation: conversation as ConversationDomain,
        message: message as MessageDomain,
      };
    });
  }

  async upsertOnOutbound(input: UpsertOutboundInput): Promise<{
    conversation: ConversationDomain;
    message: MessageDomain;
  }> {
    return this.db.$transaction(async (tx) => {
      const conversation = await tx.conversation.upsert({
        where: {
          hotelId_guestWaPhone: {
            hotelId: input.hotelId,
            guestWaPhone: input.guestWaPhone,
          },
        },
        create: {
          hotelId: input.hotelId,
          waConfigId: input.waConfigId,
          guestWaPhone: input.guestWaPhone,
          lastMessageAt: input.sentAt ?? new Date(),
          lastMessagePreview: truncatePreview(input.body),
          unreadCount: 0,
        },
        update: {
          lastMessageAt: input.sentAt ?? new Date(),
          lastMessagePreview: truncatePreview(input.body),
        },
      });
      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'outbound',
          body: input.body,
          templateRef: input.templateRef,
          templateVariables: input.templateVariables as never,
          externalMessageId: input.externalMessageId,
          status: input.status,
          dispatchId: input.dispatchId,
          sentAt: input.sentAt,
        },
      });
      return {
        conversation: conversation as ConversationDomain,
        message: message as MessageDomain,
      };
    });
  }

  async findConversationById(input: {
    hotelId: string;
    conversationId: string;
  }): Promise<ConversationDomain | null> {
    const row = await this.db.conversation.findFirst({
      where: { id: input.conversationId, hotelId: input.hotelId },
    });
    return row === null ? null : (row as ConversationDomain);
  }

  async listConversations(input: CursorFilterConversations): Promise<ConversationDomain[]> {
    const cursor = decodeConversationCursor(input.cursor);
    const rows = await this.db.conversation.findMany({
      where: {
        hotelId: input.hotelId,
        ...(cursor === null
          ? {}
          : {
              OR: [
                { lastMessageAt: { lt: cursor.ts } },
                {
                  lastMessageAt: cursor.ts,
                  id: { gt: cursor.id },
                },
              ],
            }),
      },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'asc' }],
      take: input.limit,
    });
    return rows as ConversationDomain[];
  }

  async listMessages(input: CursorFilterMessages): Promise<MessageDomain[]> {
    const cursor = decodeMessageCursor(input.cursor);
    const rows = await this.db.message.findMany({
      where: {
        conversationId: input.conversationId,
        ...(cursor === null
          ? {}
          : {
              OR: [
                { createdAt: { lt: cursor.ts } },
                { createdAt: cursor.ts, id: { gt: cursor.id } },
              ],
            }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: input.limit,
    });
    return rows as MessageDomain[];
  }
}

/** Truncates message body to the ADR-0010 preview cap (200 chars).
 *  Returns null when body is null. */
function truncatePreview(body: string | null): string | null {
  if (body === null) return null;
  return body.length > PREVIEW_MAX_LENGTH ? body.slice(0, PREVIEW_MAX_LENGTH) : body;
}

interface DecodedCursor {
  readonly ts: Date;
  readonly id: string;
}

function decodeConversationCursor(raw: string | null): DecodedCursor | null {
  if (raw === null) return null;
  return decodeCursor(raw);
}

function decodeMessageCursor(raw: string | null): DecodedCursor | null {
  if (raw === null) return null;
  return decodeCursor(raw);
}

function decodeCursor(raw: string): DecodedCursor {
  const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
    v?: number;
    id?: string;
    ts?: string;
  };
  if (parsed.v !== 1 || typeof parsed.id !== 'string' || typeof parsed.ts !== 'string') {
    throw new TypeError('malformed cursor');
  }
  const ts = new Date(parsed.ts);
  if (Number.isNaN(ts.getTime())) throw new TypeError('malformed cursor timestamp');
  return { ts, id: parsed.id };
}
