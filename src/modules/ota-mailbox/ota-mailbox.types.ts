// Domain types for T21 OTA email poller primitive (spec §3.3 + §4.8).
// Wire types (ParsedVisitSchema, PollErrorSchema) live in
// ota-mailbox.schema.ts (zod, source of truth).
//
// `booking_source` uses snake_case string literals per PM C ACK T21
// binding condition #3.

export type BookingSource = 'booking_com' | 'agoda';

/** Extracted from a recognized OTA confirmation email — spec §3.3 line 141. */
export interface ParsedVisit {
  readonly guestName: string;
  readonly checkInDate: string; // ISO date (YYYY-MM-DD)
  readonly checkOutDate: string; // ISO date (YYYY-MM-DD)
  readonly roomNumber: string | null;
  readonly bookingSource: BookingSource;
  readonly externalRef: string | null;
}

/** Result of dispatching a single email to a per-OTA parser. */
export type ParseOutcome =
  | { readonly kind: 'recognized'; readonly source: BookingSource; readonly visit: ParsedVisit }
  | { readonly kind: 'unrecognized' };

/** Minimal envelope of an inbound IMAP message consumed by the parser layer.
 *  Fields are intentionally raw text — HTML decoding / MIME decoding is the
 *  IMAP-fetcher adapter's responsibility (T21-followup). */
export interface EmailMessage {
  readonly uid: number;
  readonly fromAddress: string;
  readonly subject: string;
  readonly body: string;
  readonly receivedAt: Date;
}

/** Persisted mailbox state (spec §4.8 DDL). Password stays encrypted;
 *  primitive never decrypts (PM C ACK binding condition #10). */
export interface MailboxState {
  readonly hotelId: string;
  readonly imapHost: string;
  readonly imapUsername: string;
  readonly imapPasswordEnc: string;
  readonly lastPollAt: Date | null;
  readonly lastUidSeen: number | null;
  readonly pollError: PollError | null;
  readonly isActive: boolean;
}

/** Structured pollError envelope per PM C ACK T21 binding condition #2. */
export interface PollError {
  readonly timestamp: string; // ISO 8601
  readonly code: PollErrorCode;
  readonly message: string;
  readonly mailboxUid?: number;
  readonly stack?: string;
}

export type PollErrorCode = 'imap_fetch_failed' | 'rpc_error' | 'parser_exception' | 'unknown';

/** Outcome of dispatching one message: drives the UID-advance discipline
 *  (PM C ACK T21 binding condition #4 / GAP #5 refinement). */
export type DispatchOutcome =
  | { readonly kind: 'ok'; readonly uid: number }
  | { readonly kind: 'conflict'; readonly uid: number }
  | { readonly kind: 'unrecognized'; readonly uid: number }
  | { readonly kind: 'error'; readonly uid: number; readonly error: PollError };

/** Aggregate summary of a poll cycle across ALL active mailboxes. Consumed by
 *  the (future) Bull cron worker for logging + observability. */
export interface PollSummary {
  readonly hotelsPolled: number;
  readonly emailsSeen: number;
  readonly visitsCreated: number;
  readonly conflicts: number;
  readonly unrecognized: number;
  readonly errors: PollError[];
}
