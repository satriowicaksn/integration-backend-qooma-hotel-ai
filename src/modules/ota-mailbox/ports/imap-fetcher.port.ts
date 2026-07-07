// Fetches unread emails from an IMAP mailbox (spec §3.3 step 2).
// TYPE-ONLY per PM C ACK T21 binding condition #6.
//
// Adapter deferred to T21-followup pending PO approval on `pnpm add
// imap-simple` (or equivalent). The adapter is responsible for connecting,
// decrypting `imapPasswordEnc` via `@shared/utils/crypto.decrypt`, applying
// UID > sinceUid filter, and MIME/HTML → text decoding.

import type { EmailMessage, MailboxState } from '../ota-mailbox.types.js';

export interface ImapFetcherPort {
  fetchUnread(input: { mailbox: MailboxState; sinceUid: number | null }): Promise<EmailMessage[]>;
}
