import { describe, expect, it, jest } from '@jest/globals';
import { Prisma, type OtaMailboxState, type PrismaClient } from '@prisma/client';

import { OtaMailboxRepository } from '../ota-mailbox.repository.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

function buildRow(overrides: Partial<OtaMailboxState> = {}): OtaMailboxState {
  return {
    hotelId: HOTEL_ID,
    imapHost: 'imap.example.com',
    imapUsername: 'ops@example.com',
    imapPasswordEnc: 'v1:iv:ct:tag',
    lastPollAt: new Date('2026-07-06T18:00:00Z'),
    lastUidSeen: 100,
    pollError: null,
    isActive: true,
    ...overrides,
  };
}

interface DbMock {
  otaMailboxState: {
    findMany: jest.Mock;
    update: jest.Mock;
  };
}

function buildDbMock(): DbMock {
  return {
    otaMailboxState: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('OtaMailboxRepository.listActive', () => {
  it('should query mailboxes where isActive = true', async () => {
    const db = buildDbMock();
    db.otaMailboxState.findMany.mockResolvedValue([
      buildRow(),
      buildRow({ hotelId: 'other-hotel' }),
    ]);
    const repo = new OtaMailboxRepository(db as unknown as PrismaClient);

    const result = await repo.listActive();

    expect(db.otaMailboxState.findMany).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(result).toHaveLength(2);
    expect(result[0]?.imapPasswordEnc).toBe('v1:iv:ct:tag');
  });

  it('should NOT decrypt imapPasswordEnc — password stays encrypted in the domain object', async () => {
    const db = buildDbMock();
    db.otaMailboxState.findMany.mockResolvedValue([buildRow({ imapPasswordEnc: 'v1:opaque' })]);
    const repo = new OtaMailboxRepository(db as unknown as PrismaClient);

    const [mailbox] = await repo.listActive();

    expect(mailbox?.imapPasswordEnc).toBe('v1:opaque');
  });

  it('should safe-parse a well-formed pollError JSONB and preserve it on the domain', async () => {
    const db = buildDbMock();
    db.otaMailboxState.findMany.mockResolvedValue([
      buildRow({
        pollError: {
          timestamp: '2026-07-06T18:00:00Z',
          code: 'rpc_error',
          message: 'HC down',
        } as unknown as Prisma.JsonValue,
      }),
    ]);
    const repo = new OtaMailboxRepository(db as unknown as PrismaClient);

    const [mailbox] = await repo.listActive();

    expect(mailbox?.pollError?.code).toBe('rpc_error');
    expect(mailbox?.pollError?.message).toBe('HC down');
  });

  it('should coerce a malformed pollError JSONB to null so a poisoned row does not crash the loader', async () => {
    const db = buildDbMock();
    db.otaMailboxState.findMany.mockResolvedValue([
      buildRow({ pollError: { garbage: true } as unknown as Prisma.JsonValue }),
    ]);
    const repo = new OtaMailboxRepository(db as unknown as PrismaClient);

    const [mailbox] = await repo.listActive();

    expect(mailbox?.pollError).toBeNull();
  });

  it('should preserve mailboxUid + stack when the JSONB carries them', async () => {
    const db = buildDbMock();
    db.otaMailboxState.findMany.mockResolvedValue([
      buildRow({
        pollError: {
          timestamp: '2026-07-06T18:00:00Z',
          code: 'parser_exception',
          message: 'regex',
          mailboxUid: 42,
          stack: 'stack trace',
        } as unknown as Prisma.JsonValue,
      }),
    ]);
    const repo = new OtaMailboxRepository(db as unknown as PrismaClient);

    const [mailbox] = await repo.listActive();

    expect(mailbox?.pollError?.mailboxUid).toBe(42);
    expect(mailbox?.pollError?.stack).toBe('stack trace');
  });
});

describe('OtaMailboxRepository.updateAfterPoll', () => {
  it('should clear pollError with Prisma.JsonNull and set lastPollAt + lastUidSeen', async () => {
    const db = buildDbMock();
    db.otaMailboxState.update.mockResolvedValue(buildRow());
    const repo = new OtaMailboxRepository(db as unknown as PrismaClient);

    await repo.updateAfterPoll({
      hotelId: HOTEL_ID,
      lastPollAt: new Date('2026-07-06T19:00:00Z'),
      lastUidSeen: 123,
    });

    const call = db.otaMailboxState.update.mock.calls[0]?.[0] as {
      where: { hotelId: string };
      data: { lastPollAt: Date; lastUidSeen: number | null; pollError: unknown };
    };
    expect(call.where).toEqual({ hotelId: HOTEL_ID });
    expect(call.data.lastPollAt).toEqual(new Date('2026-07-06T19:00:00Z'));
    expect(call.data.lastUidSeen).toBe(123);
    expect(call.data.pollError).toBe(Prisma.JsonNull);
  });
});

describe('OtaMailboxRepository.recordPollError', () => {
  it('should persist the PollError as JSONB', async () => {
    const db = buildDbMock();
    db.otaMailboxState.update.mockResolvedValue(buildRow());
    const repo = new OtaMailboxRepository(db as unknown as PrismaClient);

    await repo.recordPollError({
      hotelId: HOTEL_ID,
      error: {
        timestamp: '2026-07-06T18:00:00Z',
        code: 'imap_fetch_failed',
        message: 'timeout',
      },
    });

    const call = db.otaMailboxState.update.mock.calls[0]?.[0] as {
      where: { hotelId: string };
      data: { pollError: { code: string; message: string } };
    };
    expect(call.where).toEqual({ hotelId: HOTEL_ID });
    expect(call.data.pollError.code).toBe('imap_fetch_failed');
    expect(call.data.pollError.message).toBe('timeout');
  });
});
