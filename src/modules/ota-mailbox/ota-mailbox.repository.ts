// Prisma-direct repository for `ota_mailbox_state` (ADR-0001 — no wrap-
// interface). PrismaClient injected via ctor so unit-testable with plain-
// object mock (tolerated deviation per PM C ACK T21 binding #8 + T17/T24
// precedent); real integration test lands when Q-C-01 resolves.
//
// **Password discipline** (PM C ACK T21 binding condition #10): this file
// stores/reads `imapPasswordEnc` verbatim. It MUST NOT invoke
// `@shared/utils/crypto.decrypt` — decryption is the IMAP fetcher adapter's
// concern (T21-followup). Drift-scan target: 0 hits of `decrypt` across
// `src/modules/ota-mailbox/**`.

import { Prisma, type OtaMailboxState, type PrismaClient } from '@prisma/client';

import { PollErrorSchema } from './ota-mailbox.schema.js';
import type { MailboxState, PollError } from './ota-mailbox.types.js';

export class OtaMailboxRepository {
  constructor(private readonly db: PrismaClient) {}

  async listActive(): Promise<MailboxState[]> {
    const rows = await this.db.otaMailboxState.findMany({ where: { isActive: true } });
    return rows.map(toDomain);
  }

  async updateAfterPoll(input: {
    hotelId: string;
    lastPollAt: Date;
    lastUidSeen: number | null;
  }): Promise<void> {
    await this.db.otaMailboxState.update({
      where: { hotelId: input.hotelId },
      data: {
        lastPollAt: input.lastPollAt,
        lastUidSeen: input.lastUidSeen,
        pollError: Prisma.JsonNull,
      },
    });
  }

  async recordPollError(input: { hotelId: string; error: PollError }): Promise<void> {
    await this.db.otaMailboxState.update({
      where: { hotelId: input.hotelId },
      data: { pollError: input.error as unknown as object },
    });
  }
}

function toDomain(row: OtaMailboxState): MailboxState {
  return {
    hotelId: row.hotelId,
    imapHost: row.imapHost,
    imapUsername: row.imapUsername,
    imapPasswordEnc: row.imapPasswordEnc,
    lastPollAt: row.lastPollAt,
    lastUidSeen: row.lastUidSeen,
    pollError: parsePollError(row.pollError),
    isActive: row.isActive,
  };
}

function parsePollError(raw: unknown): PollError | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const parsed = PollErrorSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const { timestamp, code, message, mailboxUid, stack } = parsed.data;
  return {
    timestamp,
    code,
    message,
    ...(mailboxUid !== undefined ? { mailboxUid } : {}),
    ...(stack !== undefined ? { stack } : {}),
  };
}
