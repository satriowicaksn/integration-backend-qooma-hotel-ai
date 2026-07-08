// MVP stub adapter for `ImapFetcherPort` (T21-followup PLAN GAP #1).
// `imap-simple` PO approval is pending — this stub returns an empty
// message list so the cron composition is exercisable end-to-end
// without a live IMAP server or the package.
//
// Swap this file for the real IMAP-connecting adapter once
// `imap-simple` lands.

import type { EmailMessage, MailboxState } from '../ota-mailbox.types.js';
import type { ImapFetcherPort } from '../ports/imap-fetcher.port.js';

export class ImapFetcherStubAdapter implements ImapFetcherPort {
  async fetchUnread(_input: {
    mailbox: MailboxState;
    sinceUid: number | null;
  }): Promise<EmailMessage[]> {
    return Promise.resolve([]);
  }
}
