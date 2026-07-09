// Service orchestrator for T29 WA conversation storage (ADR-0010).
// Handles cursor encode/decode + list wrapping; delegates persistence
// to the repository.
//
// **PII floor** (PM C ACK T29 binding): message `body` is NEVER logged.
// The service only surfaces `bodyLength` in observability lines.

import type { Logger } from '@core/logger/logger.js';

import type { WhatsappConversationsRepository } from './whatsapp-conversations.repository.js';
import { LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX } from './whatsapp-conversations.schema.js';
import type {
  ConversationDomain,
  MessageDomain,
  Page,
  UpsertInboundInput,
  UpsertOutboundInput,
} from './whatsapp-conversations.types.js';

interface ListConversationsInput {
  readonly hotelId: string;
  readonly cursor: string | null;
  readonly limit: number | null;
}

interface ListMessagesInput {
  readonly hotelId: string;
  readonly conversationId: string;
  readonly cursor: string | null;
  readonly limit: number | null;
}

export class WhatsappConversationsService {
  constructor(
    private readonly repo: WhatsappConversationsRepository,
    private readonly logger: Logger,
  ) {}

  async upsertOnInbound(input: UpsertInboundInput): Promise<{
    conversation: ConversationDomain;
    message: MessageDomain;
  }> {
    const result = await this.repo.upsertOnInbound(input);
    this.logger.info({
      msg: 'whatsapp_conversations.upserted_inbound',
      module: 'whatsapp',
      hotelId: input.hotelId,
      conversationId: result.conversation.id,
      messageId: result.message.id,
      bodyLength: input.body === null ? 0 : input.body.length,
    });
    return result;
  }

  async upsertOnOutbound(input: UpsertOutboundInput): Promise<{
    conversation: ConversationDomain;
    message: MessageDomain;
  }> {
    const result = await this.repo.upsertOnOutbound(input);
    this.logger.info({
      msg: 'whatsapp_conversations.upserted_outbound',
      module: 'whatsapp',
      hotelId: input.hotelId,
      conversationId: result.conversation.id,
      messageId: result.message.id,
      bodyLength: input.body === null ? 0 : input.body.length,
    });
    return result;
  }

  async listConversations(input: ListConversationsInput): Promise<Page<ConversationDomain>> {
    const limit = normalizeLimit(input.limit);
    const rows = await this.repo.listConversations({
      hotelId: input.hotelId,
      cursor: input.cursor,
      limit: limit + 1,
    });
    return buildPage(rows, limit, (row) => encodeCursor(row.lastMessageAt, row.id));
  }

  async listMessages(input: ListMessagesInput): Promise<Page<MessageDomain>> {
    const limit = normalizeLimit(input.limit);
    const rows = await this.repo.listMessages({
      hotelId: input.hotelId,
      conversationId: input.conversationId,
      cursor: input.cursor,
      limit: limit + 1,
    });
    return buildPage(rows, limit, (row) => encodeCursor(row.createdAt, row.id));
  }
}

function normalizeLimit(candidate: number | null): number {
  if (candidate === null) return LIST_LIMIT_DEFAULT;
  return Math.min(Math.max(1, candidate), LIST_LIMIT_MAX);
}

function buildPage<T>(rows: readonly T[], limit: number, encode: (row: T) => string): Page<T> {
  if (rows.length <= limit) {
    return { items: rows, nextCursor: null };
  }
  const items = rows.slice(0, limit);
  const anchor = items[items.length - 1];
  if (anchor === undefined) return { items, nextCursor: null };
  return { items, nextCursor: encode(anchor) };
}

export function encodeCursor(ts: Date, id: string): string {
  return Buffer.from(JSON.stringify({ v: 1, id, ts: ts.toISOString() }), 'utf8').toString(
    'base64url',
  );
}
