// Unit tests for T29 WhatsappConversationsService (ADR-0010).
//
// Repository is a jest.fn() double. Focus areas:
//  - PII floor (PM C binding #11): message `body` is NEVER in the log
//    payload; only `bodyLength` is surfaced.
//  - Cursor encode round-trip: emitted `nextCursor` decodes back to the
//    same `(ts, id)` tuple.
//  - limit + 1 fetch trick: repo is called with `limit + 1`; page is
//    trimmed to `limit`.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import type { WhatsappConversationsRepository } from '../whatsapp-conversations.repository.js';
import { LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX } from '../whatsapp-conversations.schema.js';
import { encodeCursor, WhatsappConversationsService } from '../whatsapp-conversations.service.js';
import type {
  ConversationDomain,
  MessageDomain,
  UpsertInboundInput,
  UpsertOutboundInput,
} from '../whatsapp-conversations.types.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const WA_CONFIG_ID = '22222222-3333-4444-5555-666666666666';
const CONVERSATION_ID = '33333333-4444-5555-6666-777777777777';

interface RepoDouble {
  upsertOnInbound: jest.Mock;
  upsertOnOutbound: jest.Mock;
  findConversationById: jest.Mock;
  listConversations: jest.Mock;
  listMessages: jest.Mock;
}

function createRepoDouble(): { repo: WhatsappConversationsRepository; double: RepoDouble } {
  const double: RepoDouble = {
    upsertOnInbound: jest.fn(),
    upsertOnOutbound: jest.fn(),
    findConversationById: jest.fn(),
    listConversations: jest.fn(),
    listMessages: jest.fn(),
  };
  return { repo: double as unknown as WhatsappConversationsRepository, double };
}

function createLoggerSpy(): Logger & {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
} {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function conversationRow(overrides: Partial<ConversationDomain> = {}): ConversationDomain {
  return {
    id: CONVERSATION_ID,
    hotelId: HOTEL_ID,
    waConfigId: WA_CONFIG_ID,
    guestWaPhone: '+6281234567890',
    guestId: null,
    lastMessageAt: new Date('2026-07-08T00:00:00.000Z'),
    lastMessagePreview: 'hi',
    unreadCount: 1,
    createdAt: new Date('2026-07-08T00:00:00.000Z'),
    updatedAt: new Date('2026-07-08T00:00:00.000Z'),
    ...overrides,
  };
}

function messageRow(overrides: Partial<MessageDomain> = {}): MessageDomain {
  return {
    id: '44444444-5555-6666-7777-888888888888',
    conversationId: CONVERSATION_ID,
    direction: 'inbound',
    body: 'hello',
    templateRef: null,
    templateVariables: null,
    externalMessageId: 'wamid.HBg',
    status: 'received',
    receivedAt: new Date('2026-07-08T00:00:00.000Z'),
    sentAt: null,
    dispatchId: null,
    webhookEventId: null,
    createdAt: new Date('2026-07-08T00:00:00.000Z'),
    ...overrides,
  };
}

const SECRET_BODY = 'This is a secret guest message that must never appear in any log line, ever!';

describe('WhatsappConversationsService.upsertOnInbound', () => {
  let repo: WhatsappConversationsRepository;
  let double: RepoDouble;
  let logger: ReturnType<typeof createLoggerSpy>;
  let service: WhatsappConversationsService;

  beforeEach(() => {
    ({ repo, double } = createRepoDouble());
    logger = createLoggerSpy();
    service = new WhatsappConversationsService(repo, logger);
  });

  it('should delegate persistence to the repository and return the same tuple', async () => {
    const conversation = conversationRow();
    const message = messageRow();
    double.upsertOnInbound.mockResolvedValue({ conversation, message });

    const input: UpsertInboundInput = {
      hotelId: HOTEL_ID,
      waConfigId: WA_CONFIG_ID,
      guestWaPhone: '+6281234567890',
      body: SECRET_BODY,
      externalMessageId: 'wamid.HBg',
      webhookEventId: null,
      receivedAt: new Date('2026-07-08T00:00:00.000Z'),
    };

    const result = await service.upsertOnInbound(input);

    expect(result.conversation).toBe(conversation);
    expect(result.message).toBe(message);
    expect(double.upsertOnInbound).toHaveBeenCalledWith(input);
  });

  it('should NEVER include the raw message body in the log payload (PII floor binding #11)', async () => {
    double.upsertOnInbound.mockResolvedValue({
      conversation: conversationRow(),
      message: messageRow(),
    });

    await service.upsertOnInbound({
      hotelId: HOTEL_ID,
      waConfigId: WA_CONFIG_ID,
      guestWaPhone: '+6281234567890',
      body: SECRET_BODY,
      externalMessageId: null,
      webhookEventId: null,
      receivedAt: new Date(),
    });

    expect(logger.info).toHaveBeenCalled();
    for (const call of logger.info.mock.calls) {
      expect(JSON.stringify(call[0])).not.toContain(SECRET_BODY);
    }
  });

  it('should surface bodyLength (never body itself) on the info log line', async () => {
    double.upsertOnInbound.mockResolvedValue({
      conversation: conversationRow(),
      message: messageRow(),
    });

    await service.upsertOnInbound({
      hotelId: HOTEL_ID,
      waConfigId: WA_CONFIG_ID,
      guestWaPhone: '+6281234567890',
      body: SECRET_BODY,
      externalMessageId: null,
      webhookEventId: null,
      receivedAt: new Date(),
    });

    const payload = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['bodyLength']).toBe(SECRET_BODY.length);
    expect(payload).not.toHaveProperty('body');
  });

  it('should record bodyLength=0 when body is null', async () => {
    double.upsertOnInbound.mockResolvedValue({
      conversation: conversationRow(),
      message: messageRow({ body: null }),
    });

    await service.upsertOnInbound({
      hotelId: HOTEL_ID,
      waConfigId: WA_CONFIG_ID,
      guestWaPhone: '+6281234567890',
      body: null,
      externalMessageId: null,
      webhookEventId: null,
      receivedAt: new Date(),
    });

    const payload = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['bodyLength']).toBe(0);
  });
});

describe('WhatsappConversationsService.upsertOnOutbound', () => {
  let repo: WhatsappConversationsRepository;
  let double: RepoDouble;
  let logger: ReturnType<typeof createLoggerSpy>;
  let service: WhatsappConversationsService;

  beforeEach(() => {
    ({ repo, double } = createRepoDouble());
    logger = createLoggerSpy();
    service = new WhatsappConversationsService(repo, logger);
  });

  it('should delegate to the repository upsertOnOutbound with the raw input', async () => {
    const conversation = conversationRow();
    const message = messageRow({ direction: 'outbound', status: 'sent' });
    double.upsertOnOutbound.mockResolvedValue({ conversation, message });

    const input: UpsertOutboundInput = {
      hotelId: HOTEL_ID,
      waConfigId: WA_CONFIG_ID,
      guestWaPhone: '+6281234567890',
      body: SECRET_BODY,
      templateRef: null,
      templateVariables: null,
      externalMessageId: 'wamid.OUT',
      dispatchId: null,
      status: 'sent',
      sentAt: new Date('2026-07-08T01:00:00.000Z'),
    };

    const result = await service.upsertOnOutbound(input);
    expect(result.conversation).toBe(conversation);
    expect(double.upsertOnOutbound).toHaveBeenCalledWith(input);
  });

  it('should NEVER include the raw outbound body in the log payload (PII floor binding #11)', async () => {
    double.upsertOnOutbound.mockResolvedValue({
      conversation: conversationRow(),
      message: messageRow({ direction: 'outbound' }),
    });

    await service.upsertOnOutbound({
      hotelId: HOTEL_ID,
      waConfigId: WA_CONFIG_ID,
      guestWaPhone: '+6281234567890',
      body: SECRET_BODY,
      templateRef: null,
      templateVariables: null,
      externalMessageId: null,
      dispatchId: null,
      status: 'pending',
      sentAt: null,
    });

    for (const call of logger.info.mock.calls) {
      expect(JSON.stringify(call[0])).not.toContain(SECRET_BODY);
    }
  });
});

describe('WhatsappConversationsService.listConversations', () => {
  let repo: WhatsappConversationsRepository;
  let double: RepoDouble;
  let service: WhatsappConversationsService;

  beforeEach(() => {
    ({ repo, double } = createRepoDouble());
    service = new WhatsappConversationsService(repo, createLoggerSpy());
  });

  it('should default the fetch to LIST_LIMIT_DEFAULT + 1 when limit is null', async () => {
    double.listConversations.mockResolvedValue([]);
    await service.listConversations({ hotelId: HOTEL_ID, cursor: null, limit: null });
    expect(double.listConversations).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      cursor: null,
      limit: LIST_LIMIT_DEFAULT + 1,
    });
  });

  it('should clamp limit to LIST_LIMIT_MAX when caller passes a huge value', async () => {
    double.listConversations.mockResolvedValue([]);
    await service.listConversations({ hotelId: HOTEL_ID, cursor: null, limit: 999_999 });
    expect(double.listConversations).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      cursor: null,
      limit: LIST_LIMIT_MAX + 1,
    });
  });

  it('should return items=rows and nextCursor=null when the repo returns <= limit rows', async () => {
    const rows = [
      conversationRow(),
      conversationRow({ id: 'cccccccc-1111-2222-3333-444444444444' }),
    ];
    double.listConversations.mockResolvedValue(rows);

    const page = await service.listConversations({
      hotelId: HOTEL_ID,
      cursor: null,
      limit: 5,
    });

    expect(page.items).toEqual(rows);
    expect(page.nextCursor).toBeNull();
  });

  it('should emit a decodable nextCursor when the repo returns limit+1 rows', async () => {
    const anchorTs = new Date('2026-07-08T00:00:00.000Z');
    const anchorId = 'aaaaaaaa-1111-2222-3333-444444444444';
    const rows: ConversationDomain[] = [
      conversationRow(),
      conversationRow({ id: anchorId, lastMessageAt: anchorTs }),
      conversationRow({ id: 'extra-row-id' }),
    ];
    double.listConversations.mockResolvedValue(rows);

    const page = await service.listConversations({
      hotelId: HOTEL_ID,
      cursor: null,
      limit: 2,
    });

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).not.toBeNull();

    const decoded = JSON.parse(
      Buffer.from(page.nextCursor as string, 'base64url').toString('utf8'),
    ) as { v: number; id: string; ts: string };
    expect(decoded.v).toBe(1);
    expect(decoded.id).toBe(anchorId);
    expect(decoded.ts).toBe(anchorTs.toISOString());
  });
});

describe('WhatsappConversationsService.listMessages', () => {
  let repo: WhatsappConversationsRepository;
  let double: RepoDouble;
  let service: WhatsappConversationsService;

  beforeEach(() => {
    ({ repo, double } = createRepoDouble());
    service = new WhatsappConversationsService(repo, createLoggerSpy());
  });

  it('should fetch with limit+1 and slice the returned page to limit', async () => {
    const rows: MessageDomain[] = [
      messageRow(),
      messageRow({ id: 'msg-2' }),
      messageRow({ id: 'msg-3' }),
    ];
    double.listMessages.mockResolvedValue(rows);

    const page = await service.listMessages({
      hotelId: HOTEL_ID,
      conversationId: CONVERSATION_ID,
      cursor: null,
      limit: 2,
    });

    expect(page.items).toHaveLength(2);
    expect(double.listMessages).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      conversationId: CONVERSATION_ID,
      cursor: null,
      limit: 3,
    });
  });

  it('should pass the caller cursor through to the repository unchanged', async () => {
    double.listMessages.mockResolvedValue([]);
    await service.listMessages({
      hotelId: HOTEL_ID,
      conversationId: CONVERSATION_ID,
      cursor: 'opaque-abc',
      limit: 10,
    });
    expect(double.listMessages).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'opaque-abc' }),
    );
  });
});

describe('encodeCursor (round-trip)', () => {
  it('should encode a (ts, id) tuple that decodes back to the same values', () => {
    const ts = new Date('2026-07-08T12:34:56.789Z');
    const id = 'aaaaaaaa-1111-2222-3333-444444444444';
    const cursor = encodeCursor(ts, id);
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      v: number;
      id: string;
      ts: string;
    };
    expect(decoded.v).toBe(1);
    expect(decoded.id).toBe(id);
    expect(decoded.ts).toBe(ts.toISOString());
  });

  it('should produce an opaque URL-safe base64url string with no equals padding', () => {
    const cursor = encodeCursor(new Date(), 'x');
    expect(cursor).not.toContain('=');
    expect(cursor).not.toContain('+');
    expect(cursor).not.toContain('/');
  });
});
