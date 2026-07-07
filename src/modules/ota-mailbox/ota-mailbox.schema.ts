// zod schemas for T21 OTA email poller primitive.
//
// `ParsedVisitSchema` = defence-in-depth boundary between the regex-based
// per-OTA parsers and the poll orchestrator. Parsers do extraction; this
// schema enforces types + basic constraints so a malformed extraction can
// never reach the HC pending-visit RPC layer.
//
// `PollErrorSchema` = canonical JSONB shape for the `ota_mailbox_state.
// poll_error` column (spec §4.8). Structure ratified in PM C ACK T21
// binding condition #2: `{ timestamp: ISO, code: enum, message, mailboxUid?,
// stack? }`. Zod-validated whenever the orchestrator records an error
// (protects against ad-hoc JSON schema drift over time).
//
// `booking_source` string literals are snake_case per PM C ACK T21 binding
// condition #3.

import { z } from 'zod';

export const BookingSourceEnum = z.enum(['booking_com', 'agoda']);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const ParsedVisitSchema = z
  .object({
    guestName: z.string().min(1).max(200),
    checkInDate: z.string().regex(ISO_DATE_PATTERN, 'checkInDate must be ISO YYYY-MM-DD'),
    checkOutDate: z.string().regex(ISO_DATE_PATTERN, 'checkOutDate must be ISO YYYY-MM-DD'),
    roomNumber: z.string().min(1).max(20).nullable(),
    bookingSource: BookingSourceEnum,
    externalRef: z.string().min(1).max(80).nullable(),
  })
  .strict();

export type ParsedVisitDto = z.infer<typeof ParsedVisitSchema>;

export const PollErrorCodeEnum = z.enum([
  'imap_fetch_failed',
  'rpc_error',
  'parser_exception',
  'unknown',
]);

export const PollErrorSchema = z
  .object({
    timestamp: z.string(),
    code: PollErrorCodeEnum,
    message: z.string().min(1).max(2000),
    mailboxUid: z.number().int().nonnegative().optional(),
    stack: z.string().max(8000).optional(),
  })
  .strict();

export type PollErrorDto = z.infer<typeof PollErrorSchema>;
