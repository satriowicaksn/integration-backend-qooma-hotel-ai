// MVP stub adapter for `HotelCorePendingVisitPort` (T21-followup PLAN GAP #2).
// Q-C-09 (HC pending-visit RPC contract) unresolved at Parent PM — this
// stub returns `{ status: 'ok', visitId: 'stub-<random>' }` and logs
// `hc_rpc_stubbed` per invocation with tenant + booking-source context.
// The primitive's UID-advance discipline treats `ok` as a persist-and-
// advance; behavior is identical to a successful real RPC.
//
// Swap this file for the real HTTP RPC adapter once Q-C-09 lands.

import { randomUUID } from 'node:crypto';

import type { Logger } from '@core/logger/logger.js';

import type {
  CreatePendingVisitInput,
  CreatePendingVisitResult,
  HotelCorePendingVisitPort,
} from '../ports/hotel-core-pending-visit.port.js';

export class HotelCorePendingVisitStubAdapter implements HotelCorePendingVisitPort {
  constructor(private readonly logger: Logger) {}

  async createPendingVisit(input: CreatePendingVisitInput): Promise<CreatePendingVisitResult> {
    const visitId = `stub-${randomUUID()}`;
    this.logger.warn({
      msg: 'ota_mailbox.hc_rpc_stubbed',
      module: 'ota-mailbox',
      port: 'hotel_core_pending_visit',
      hotelId: input.hotelId,
      bookingSource: input.bookingSource,
      hasExternalRef: input.externalRef !== null,
    });
    return Promise.resolve({ status: 'ok', visitId });
  }
}
