import { describe, expect, it } from '@jest/globals';

import { ImapFetcherStubAdapter } from '../adapters/imap-fetcher-stub.adapter.js';
import type { MailboxState } from '../ota-mailbox.types.js';

const MAILBOX: MailboxState = {
  hotelId: '11111111-2222-3333-4444-555555555555',
  mailboxId: 'mailbox-1',
  imapHost: 'imap.example.com',
  imapUser: 'user@example.com',
  imapPasswordEnc: 'stub',
  lastUidSeen: 0,
  frozen: false,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as MailboxState;

describe('ImapFetcherStubAdapter', () => {
  it('should return an empty message list unconditionally', async () => {
    const adapter = new ImapFetcherStubAdapter();
    const result = await adapter.fetchUnread({ mailbox: MAILBOX, sinceUid: null });
    expect(result).toEqual([]);
  });

  it('should return empty list even when sinceUid is a positive integer', async () => {
    const adapter = new ImapFetcherStubAdapter();
    const result = await adapter.fetchUnread({ mailbox: MAILBOX, sinceUid: 42 });
    expect(result).toEqual([]);
  });
});
