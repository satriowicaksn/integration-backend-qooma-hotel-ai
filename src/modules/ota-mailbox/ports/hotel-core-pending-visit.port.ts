// Cross-service RPC port — Integration → Hotel Core: create a pending
// visit from a parsed OTA reservation (spec §3.3 step 5). TYPE-ONLY per
// PM C ACK T21 binding condition #6.
//
// Contract details (URL, path, payload, response, error catalog, idempotency
// key) tracked as Q-C-09 (open — HC-team + PO ratify). Adapter deferred to
// T21-followup after Q-C-09 resolves + `INTERNAL_SECRET` + `HC_BASE_URL`
// wiring lands (Q-C-02 / Q-C-03).
//
// Idempotency (PM C ACK GAP #5): HC MUST dedupe on
// `(hotelId, bookingSource, externalRef)`; `conflict` is a success outcome
// (the visit already exists). See ota-poll.service.ts for the UID-advance
// discipline that depends on this contract.

import type { BookingSource } from '../ota-mailbox.types.js';

export interface CreatePendingVisitInput {
  readonly hotelId: string;
  readonly guestName: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly roomNumber: string | null;
  readonly bookingSource: BookingSource;
  readonly externalRef: string | null;
}

export type CreatePendingVisitResult =
  | { readonly status: 'ok'; readonly visitId: string }
  | { readonly status: 'conflict'; readonly visitId: string }
  | { readonly status: 'error'; readonly code: string; readonly message: string };

export interface HotelCorePendingVisitPort {
  createPendingVisit(input: CreatePendingVisitInput): Promise<CreatePendingVisitResult>;
}
