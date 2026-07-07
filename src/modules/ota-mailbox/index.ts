// Barrel — per PM C ACK T21 binding condition #9: export public
// orchestrator-side surface only. Per-OTA parsers (`parsers/*.parser.ts`)
// + dispatcher (`ota-parser.ts`) remain module-private; T21-followup or
// external callers should not depend on those internals.

export type {
  BookingSource,
  DispatchOutcome,
  EmailMessage,
  MailboxState,
  ParsedVisit,
  ParseOutcome,
  PollError,
  PollErrorCode,
  PollSummary,
} from './ota-mailbox.types.js';

export type { ParsedVisitDto, PollErrorDto } from './ota-mailbox.schema.js';
export {
  BookingSourceEnum,
  ParsedVisitSchema,
  PollErrorCodeEnum,
  PollErrorSchema,
} from './ota-mailbox.schema.js';

export { OtaMailboxRepository } from './ota-mailbox.repository.js';

export { OtaPollService } from './ota-poll.service.js';
export type { OtaPollPorts } from './ota-poll.service.js';

export type { ImapFetcherPort } from './ports/imap-fetcher.port.js';
export type {
  CreatePendingVisitInput,
  CreatePendingVisitResult,
  HotelCorePendingVisitPort,
} from './ports/hotel-core-pending-visit.port.js';
