import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import type { OtaMailboxRepository } from '../ota-mailbox.repository.js';
import type {
  DispatchOutcome,
  EmailMessage,
  MailboxState,
  PollError,
} from '../ota-mailbox.types.js';
import { computeAdvanceableUid, OtaPollService } from '../ota-poll.service.js';
import type {
  CreatePendingVisitInput,
  CreatePendingVisitResult,
  HotelCorePendingVisitPort,
} from '../ports/hotel-core-pending-visit.port.js';
import type { ImapFetcherPort } from '../ports/imap-fetcher.port.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const NOW = new Date('2026-07-06T20:00:00Z');

const MAILBOX: MailboxState = {
  hotelId: HOTEL_ID,
  imapHost: 'imap.example.com',
  imapUsername: 'ops@example.com',
  imapPasswordEnc: 'v1:opaque',
  lastPollAt: new Date('2026-07-06T19:00:00Z'),
  lastUidSeen: 100,
  pollError: null,
  isActive: true,
};

const BOOKING_EMAIL: EmailMessage = {
  uid: 101,
  fromAddress: 'noreply@booking.com',
  subject: 'Booking Confirmation - Confirmation number: BKG-1',
  body: [
    'Guest name: Jane Doe',
    'Check-in: 2026-08-15',
    'Check-out: 2026-08-20',
    'Confirmation number: BKG-1',
  ].join('\n'),
  receivedAt: new Date('2026-07-06T18:00:00Z'),
};

const UNRECOGNIZED_EMAIL: EmailMessage = {
  uid: 102,
  fromAddress: 'noreply@newsletter.com',
  subject: 'Weekly digest',
  body: 'Some content',
  receivedAt: new Date('2026-07-06T18:00:00Z'),
};

interface RepoMock {
  listActive: jest.Mock<OtaMailboxRepository['listActive']>;
  updateAfterPoll: jest.Mock<OtaMailboxRepository['updateAfterPoll']>;
  recordPollError: jest.Mock<OtaMailboxRepository['recordPollError']>;
}

interface ImapMock {
  fetchUnread: jest.Mock<ImapFetcherPort['fetchUnread']>;
}

interface HcMock {
  createPendingVisit: jest.Mock<
    (input: CreatePendingVisitInput) => Promise<CreatePendingVisitResult>
  >;
}

interface LoggerMock extends Logger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}

function buildRepoMock(): RepoMock {
  return {
    listActive: jest.fn<OtaMailboxRepository['listActive']>(),
    updateAfterPoll: jest.fn<OtaMailboxRepository['updateAfterPoll']>(),
    recordPollError: jest.fn<OtaMailboxRepository['recordPollError']>(),
  };
}

function buildImapMock(): ImapMock {
  return { fetchUnread: jest.fn<ImapFetcherPort['fetchUnread']>() };
}

function buildHcMock(): HcMock {
  return {
    createPendingVisit:
      jest.fn<(input: CreatePendingVisitInput) => Promise<CreatePendingVisitResult>>(),
  };
}

function buildLoggerMock(): LoggerMock {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

function buildService(): {
  service: OtaPollService;
  repo: RepoMock;
  imap: ImapMock;
  hc: HcMock;
  logger: LoggerMock;
} {
  const repo = buildRepoMock();
  const imap = buildImapMock();
  const hc = buildHcMock();
  const logger = buildLoggerMock();
  const service = new OtaPollService(
    repo as unknown as OtaMailboxRepository,
    {
      imap: imap as unknown as ImapFetcherPort,
      hotelCore: hc as unknown as HotelCorePendingVisitPort,
    },
    logger,
    { now: () => NOW },
  );
  return { service, repo, imap, hc, logger };
}

describe('OtaPollService.pollAllMailboxes — happy path', () => {
  it('should create a pending visit for a recognized email and advance lastUidSeen to msg.uid on ok outcome', async () => {
    const { service, repo, imap, hc } = buildService();
    repo.listActive.mockResolvedValue([MAILBOX]);
    imap.fetchUnread.mockResolvedValue([BOOKING_EMAIL]);
    hc.createPendingVisit.mockResolvedValue({ status: 'ok', visitId: 'visit-1' });
    repo.updateAfterPoll.mockResolvedValue(undefined);

    const summary = await service.pollAllMailboxes();

    expect(hc.createPendingVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        hotelId: HOTEL_ID,
        guestName: 'Jane Doe',
        bookingSource: 'booking_com',
        externalRef: 'BKG-1',
      }),
    );
    expect(repo.updateAfterPoll).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      lastPollAt: NOW,
      lastUidSeen: 101,
    });
    expect(summary.visitsCreated).toBe(1);
    expect(summary.errors).toHaveLength(0);
  });
});

describe('OtaPollService.pollAllMailboxes — UID discipline (PM C ACK T21 GAP #5)', () => {
  it('should advance lastUidSeen on conflict outcome (HC idempotent = success)', async () => {
    const { service, repo, imap, hc } = buildService();
    repo.listActive.mockResolvedValue([MAILBOX]);
    imap.fetchUnread.mockResolvedValue([BOOKING_EMAIL]);
    hc.createPendingVisit.mockResolvedValue({ status: 'conflict', visitId: 'visit-existing' });

    const summary = await service.pollAllMailboxes();

    expect(repo.updateAfterPoll).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      lastPollAt: NOW,
      lastUidSeen: 101,
    });
    expect(summary.conflicts).toBe(1);
  });

  it('should NOT advance lastUidSeen on error outcome (freeze so next poll retries)', async () => {
    const { service, repo, imap, hc } = buildService();
    repo.listActive.mockResolvedValue([MAILBOX]);
    imap.fetchUnread.mockResolvedValue([BOOKING_EMAIL]);
    hc.createPendingVisit.mockResolvedValue({
      status: 'error',
      code: 'HC_UNAVAILABLE',
      message: 'HC down',
    });

    const summary = await service.pollAllMailboxes();

    expect(repo.updateAfterPoll).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      lastPollAt: NOW,
      lastUidSeen: MAILBOX.lastUidSeen, // frozen
    });
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]?.code).toBe('rpc_error');
  });

  it('should advance lastUidSeen for unrecognized-and-logged emails', async () => {
    const { service, repo, imap } = buildService();
    repo.listActive.mockResolvedValue([MAILBOX]);
    imap.fetchUnread.mockResolvedValue([UNRECOGNIZED_EMAIL]);

    const summary = await service.pollAllMailboxes();

    expect(repo.updateAfterPoll).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      lastPollAt: NOW,
      lastUidSeen: 102,
    });
    expect(summary.unrecognized).toBe(1);
  });

  it('should compute max advanceable UID across a mixed batch (binding #5)', async () => {
    const { service, repo, imap, hc } = buildService();
    const okMsg: EmailMessage = { ...BOOKING_EMAIL, uid: 105 };
    const errorMsg: EmailMessage = {
      ...BOOKING_EMAIL,
      uid: 108,
      subject: 'Booking Confirmation - Confirmation number: BKG-2',
    };
    const unrecognizedMsg: EmailMessage = { ...UNRECOGNIZED_EMAIL, uid: 110 };
    repo.listActive.mockResolvedValue([MAILBOX]);
    imap.fetchUnread.mockResolvedValue([okMsg, errorMsg, unrecognizedMsg]);
    hc.createPendingVisit
      .mockResolvedValueOnce({ status: 'ok', visitId: 'v-1' })
      .mockResolvedValueOnce({ status: 'error', code: 'X', message: 'x' });

    await service.pollAllMailboxes();

    // ok=105, unrecognized=110 advanceable; error=108 frozen → max advanceable = 110
    expect(repo.updateAfterPoll).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      lastPollAt: NOW,
      lastUidSeen: 110,
    });
  });
});

describe('OtaPollService.pollAllMailboxes — resilience', () => {
  it('should record poll error and continue when the IMAP fetch itself throws', async () => {
    const { service, repo, imap } = buildService();
    repo.listActive.mockResolvedValue([MAILBOX]);
    imap.fetchUnread.mockRejectedValue(new Error('imap connection refused'));

    const summary = await service.pollAllMailboxes();

    expect(repo.recordPollError).toHaveBeenCalledTimes(1);
    const recorded = repo.recordPollError.mock.calls[0]?.[0] as {
      hotelId: string;
      error: PollError;
    };
    expect(recorded.error.code).toBe('imap_fetch_failed');
    expect(recorded.error.message).toContain('imap connection refused');
    expect(repo.updateAfterPoll).not.toHaveBeenCalled();
    expect(summary.errors).toHaveLength(1);
  });

  it('should continue polling remaining mailboxes when one mailbox fails (spec §3.3 "do not crash poll loop")', async () => {
    const { service, repo, imap, hc } = buildService();
    const mailboxA = MAILBOX;
    const mailboxB: MailboxState = { ...MAILBOX, hotelId: 'other-hotel', lastUidSeen: 200 };
    repo.listActive.mockResolvedValue([mailboxA, mailboxB]);
    imap.fetchUnread
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([BOOKING_EMAIL]);
    hc.createPendingVisit.mockResolvedValue({ status: 'ok', visitId: 'v-2' });

    const summary = await service.pollAllMailboxes();

    expect(summary.hotelsPolled).toBe(2);
    expect(summary.errors).toHaveLength(1);
    expect(summary.visitsCreated).toBe(1);
  });

  it('should tag an HC port throw as rpc_error and freeze that message UID', async () => {
    const { service, repo, imap, hc } = buildService();
    repo.listActive.mockResolvedValue([MAILBOX]);
    imap.fetchUnread.mockResolvedValue([BOOKING_EMAIL]);
    hc.createPendingVisit.mockRejectedValue(new Error('network reset'));

    const summary = await service.pollAllMailboxes();

    expect(summary.errors[0]?.code).toBe('rpc_error');
    expect(summary.errors[0]?.message).toContain('network reset');
    expect(repo.updateAfterPoll).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      lastPollAt: NOW,
      lastUidSeen: MAILBOX.lastUidSeen,
    });
  });

  it('should log an error when recording the poll error itself throws (defensive path)', async () => {
    const { service, repo, imap, logger } = buildService();
    repo.listActive.mockResolvedValue([MAILBOX]);
    imap.fetchUnread.mockRejectedValue(new Error('imap dead'));
    repo.recordPollError.mockRejectedValue(new Error('db write failed'));

    await service.pollAllMailboxes();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'ota_poll.record_error_failed',
        module: 'ota-mailbox',
        hotelId: HOTEL_ID,
      }),
    );
  });

  it('should tag parser exceptions as parser_exception and NOT advance UID for that message', async () => {
    const { service, repo, imap } = buildService();
    // Force a parser exception by making the message body throw when accessed —
    // simulate via Proxy on body access to trigger try/catch in dispatchMessage.
    const bad: EmailMessage = new Proxy(BOOKING_EMAIL, {
      get(target, key) {
        if (key === 'body') throw new Error('body access exploded');
        return target[key as keyof EmailMessage];
      },
    });
    repo.listActive.mockResolvedValue([MAILBOX]);
    imap.fetchUnread.mockResolvedValue([bad, UNRECOGNIZED_EMAIL]);

    const summary = await service.pollAllMailboxes();

    expect(summary.errors.some((e) => e.code === 'parser_exception')).toBe(true);
    // bad has uid=101 (frozen), unrecognized has uid=102 (advanceable)
    expect(repo.updateAfterPoll).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      lastPollAt: NOW,
      lastUidSeen: 102,
    });
  });
});

describe('computeAdvanceableUid (pure helper)', () => {
  it('should return the previousUid when the batch is empty', () => {
    expect(computeAdvanceableUid([], 100)).toBe(100);
    expect(computeAdvanceableUid([], null)).toBeNull();
  });

  it('should return the previousUid when every outcome errored', () => {
    const errored: DispatchOutcome[] = [
      { kind: 'error', uid: 5, error: buildError() },
      { kind: 'error', uid: 6, error: buildError() },
    ];
    expect(computeAdvanceableUid(errored, 4)).toBe(4);
  });

  it('should return the max of advanceable + previousUid', () => {
    const mixed: DispatchOutcome[] = [
      { kind: 'ok', uid: 10 },
      { kind: 'error', uid: 15, error: buildError() },
      { kind: 'unrecognized', uid: 12 },
    ];
    expect(computeAdvanceableUid(mixed, 8)).toBe(12);
  });

  it('should not regress below the previousUid when advanceable are lower', () => {
    const mixed: DispatchOutcome[] = [{ kind: 'ok', uid: 3 }];
    expect(computeAdvanceableUid(mixed, 100)).toBe(100);
  });
});

function buildError(): PollError {
  return { timestamp: '2026-07-06T00:00:00Z', code: 'unknown', message: 'x' };
}
