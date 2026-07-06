// Orchestrator: for each active mailbox, fetch unread emails via ImapFetcher
// port → dispatch to per-OTA parser → RPC HC create_pending_visit → update
// state. Per-mailbox try/catch so one bad mailbox doesn't crash the loop
// (spec §3.3 failure mode).
//
// UID-advance discipline (PM C ACK T21 GAP #5 + binding condition #4):
//   ok            → advance to msg.uid
//   conflict      → advance to msg.uid (HC idempotent = success)
//   unrecognized  → advance to msg.uid (logged + skipped)
//   error         → DO NOT advance (next poll retries)
//   exception     → DO NOT advance (next poll retries)
//
// Max-UID across a batch is computed via `Math.max(...)` over the
// advanceable subset (binding condition #5), not "last message's UID",
// because unrecognized/error messages may be interleaved with successes.

import type { Logger } from '@core/logger/logger.js';

import type { OtaMailboxRepository } from './ota-mailbox.repository.js';
import type {
  DispatchOutcome,
  EmailMessage,
  MailboxState,
  ParsedVisit,
  PollError,
  PollSummary,
} from './ota-mailbox.types.js';
import { parseEmail } from './ota-parser.js';
import type { HotelCorePendingVisitPort } from './ports/hotel-core-pending-visit.port.js';
import type { ImapFetcherPort } from './ports/imap-fetcher.port.js';

export interface OtaPollPorts {
  readonly imap: ImapFetcherPort;
  readonly hotelCore: HotelCorePendingVisitPort;
}

interface Clock {
  now(): Date;
}

const SYSTEM_CLOCK: Clock = { now: () => new Date() };

export class OtaPollService {
  private readonly clock: Clock;

  constructor(
    private readonly repository: OtaMailboxRepository,
    private readonly ports: OtaPollPorts,
    private readonly logger: Logger,
    clock?: Clock,
  ) {
    this.clock = clock ?? SYSTEM_CLOCK;
  }

  async pollAllMailboxes(): Promise<PollSummary> {
    const mailboxes = await this.repository.listActive();
    const summary: MutableSummary = {
      hotelsPolled: 0,
      emailsSeen: 0,
      visitsCreated: 0,
      conflicts: 0,
      unrecognized: 0,
      errors: [],
    };
    for (const mailbox of mailboxes) {
      await this.pollOneMailbox(mailbox, summary);
    }
    return {
      hotelsPolled: summary.hotelsPolled,
      emailsSeen: summary.emailsSeen,
      visitsCreated: summary.visitsCreated,
      conflicts: summary.conflicts,
      unrecognized: summary.unrecognized,
      errors: summary.errors,
    };
  }

  private async pollOneMailbox(mailbox: MailboxState, summary: MutableSummary): Promise<void> {
    summary.hotelsPolled += 1;
    const pollStart = this.clock.now();
    let messages: EmailMessage[];
    try {
      messages = await this.ports.imap.fetchUnread({
        mailbox,
        sinceUid: mailbox.lastUidSeen,
      });
    } catch (err) {
      const pollError = buildPollError('imap_fetch_failed', err, this.clock);
      summary.errors.push(pollError);
      await this.recordError(mailbox.hotelId, pollError);
      this.logger.warn({
        msg: 'ota_poll.imap_fetch_failed',
        module: 'ota-mailbox',
        hotelId: mailbox.hotelId,
        code: pollError.code,
      });
      return;
    }

    summary.emailsSeen += messages.length;
    const outcomes: DispatchOutcome[] = [];
    for (const message of messages) {
      const outcome = await this.dispatchMessage(mailbox, message);
      outcomes.push(outcome);
      applyOutcomeToSummary(summary, outcome);
    }

    const advancedUid = computeAdvanceableUid(outcomes, mailbox.lastUidSeen);
    await this.repository.updateAfterPoll({
      hotelId: mailbox.hotelId,
      lastPollAt: pollStart,
      lastUidSeen: advancedUid,
    });
    this.logger.info({
      msg: 'ota_poll.completed',
      module: 'ota-mailbox',
      hotelId: mailbox.hotelId,
      emailsSeen: messages.length,
      advancedUid,
    });
  }

  private async dispatchMessage(
    mailbox: MailboxState,
    message: EmailMessage,
  ): Promise<DispatchOutcome> {
    let outcome: DispatchOutcome;
    try {
      const parsed = parseEmail(message);
      if (parsed.kind === 'unrecognized') {
        this.logger.info({
          msg: 'ota_poll.unrecognized',
          module: 'ota-mailbox',
          hotelId: mailbox.hotelId,
          uid: message.uid,
          fromAddress: message.fromAddress,
        });
        outcome = { kind: 'unrecognized', uid: message.uid };
      } else {
        outcome = await this.invokeRpc(mailbox.hotelId, message.uid, parsed.visit);
      }
    } catch (err) {
      const pollError = buildPollError('parser_exception', err, this.clock, message.uid);
      outcome = { kind: 'error', uid: message.uid, error: pollError };
    }
    return outcome;
  }

  private async invokeRpc(
    hotelId: string,
    uid: number,
    visit: ParsedVisit,
  ): Promise<DispatchOutcome> {
    try {
      const result = await this.ports.hotelCore.createPendingVisit({
        hotelId,
        guestName: visit.guestName,
        checkInDate: visit.checkInDate,
        checkOutDate: visit.checkOutDate,
        roomNumber: visit.roomNumber,
        bookingSource: visit.bookingSource,
        externalRef: visit.externalRef,
      });
      switch (result.status) {
        case 'ok':
          this.logger.info({
            msg: 'ota_poll.visit_created',
            module: 'ota-mailbox',
            hotelId,
            uid,
            visitId: result.visitId,
            bookingSource: visit.bookingSource,
          });
          return { kind: 'ok', uid };
        case 'conflict':
          this.logger.info({
            msg: 'ota_poll.visit_conflict',
            module: 'ota-mailbox',
            hotelId,
            uid,
            visitId: result.visitId,
          });
          return { kind: 'conflict', uid };
        case 'error': {
          const pollError = buildPollError(
            'rpc_error',
            new Error(`${result.code}: ${result.message}`),
            this.clock,
            uid,
          );
          return { kind: 'error', uid, error: pollError };
        }
      }
    } catch (err) {
      const pollError = buildPollError('rpc_error', err, this.clock, uid);
      return { kind: 'error', uid, error: pollError };
    }
  }

  private async recordError(hotelId: string, error: PollError): Promise<void> {
    try {
      await this.repository.recordPollError({ hotelId, error });
    } catch (repoErr) {
      this.logger.error({
        msg: 'ota_poll.record_error_failed',
        module: 'ota-mailbox',
        hotelId,
        errCode: error.code,
        repoErrMessage: repoErr instanceof Error ? repoErr.message : String(repoErr),
      });
    }
  }
}

interface MutableSummary {
  hotelsPolled: number;
  emailsSeen: number;
  visitsCreated: number;
  conflicts: number;
  unrecognized: number;
  errors: PollError[];
}

function applyOutcomeToSummary(summary: MutableSummary, outcome: DispatchOutcome): void {
  switch (outcome.kind) {
    case 'ok':
      summary.visitsCreated += 1;
      return;
    case 'conflict':
      summary.conflicts += 1;
      return;
    case 'unrecognized':
      summary.unrecognized += 1;
      return;
    case 'error':
      summary.errors.push(outcome.error);
      return;
  }
}

/** Advance UID only for {ok, conflict, unrecognized}; freeze on {error}.
 *  Returns null-safe max over advanceable UIDs, keeping the previous UID
 *  when the whole batch is empty or every message errored. */
export function computeAdvanceableUid(
  outcomes: readonly DispatchOutcome[],
  previousUid: number | null,
): number | null {
  const advanceable = outcomes.filter((o) => o.kind !== 'error').map((o) => o.uid);
  if (advanceable.length === 0) {
    return previousUid;
  }
  const highest = Math.max(...advanceable);
  return previousUid === null ? highest : Math.max(previousUid, highest);
}

function buildPollError(
  code: PollError['code'],
  err: unknown,
  clock: Clock,
  mailboxUid?: number,
): PollError {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error && err.stack ? err.stack.slice(0, 8000) : undefined;
  return {
    timestamp: clock.now().toISOString(),
    code,
    message: message.slice(0, 2000),
    ...(mailboxUid !== undefined ? { mailboxUid } : {}),
    ...(stack !== undefined ? { stack } : {}),
  };
}
