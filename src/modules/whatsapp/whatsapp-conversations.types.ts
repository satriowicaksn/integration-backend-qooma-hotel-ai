// Domain types for T29 WA conversation + message storage (ADR-0010).
// Wire types live in whatsapp-conversations.schema.ts (zod, source of truth).

export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'received' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ConversationDomain {
  readonly id: string;
  readonly hotelId: string;
  readonly waConfigId: string;
  readonly guestWaPhone: string;
  readonly guestId: string | null;
  readonly lastMessageAt: Date;
  readonly lastMessagePreview: string | null;
  readonly unreadCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface MessageDomain {
  readonly id: string;
  readonly conversationId: string;
  readonly direction: MessageDirection;
  readonly body: string | null;
  readonly templateRef: string | null;
  readonly templateVariables: unknown;
  readonly externalMessageId: string | null;
  readonly status: string;
  readonly receivedAt: Date | null;
  readonly sentAt: Date | null;
  readonly dispatchId: string | null;
  readonly webhookEventId: string | null;
  readonly createdAt: Date;
}

export interface UpsertInboundInput {
  readonly hotelId: string;
  readonly waConfigId: string;
  readonly guestWaPhone: string;
  readonly body: string | null;
  readonly externalMessageId: string | null;
  readonly webhookEventId: string | null;
  readonly receivedAt: Date;
}

export interface UpsertOutboundInput {
  readonly hotelId: string;
  readonly waConfigId: string;
  readonly guestWaPhone: string;
  readonly body: string | null;
  readonly templateRef: string | null;
  readonly templateVariables: unknown;
  readonly externalMessageId: string | null;
  readonly dispatchId: string | null;
  readonly status: MessageStatus;
  readonly sentAt: Date | null;
}

/** Cursor pagination result — surfaced at both service + route layers. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface CursorFilterConversations {
  readonly hotelId: string;
  readonly cursor: string | null;
  readonly limit: number;
}

export interface CursorFilterMessages {
  readonly hotelId: string;
  readonly conversationId: string;
  readonly cursor: string | null;
  readonly limit: number;
}
