/**
 * WA outbound quota — PASSTHROUGH adapter per ADR-0009.
 *
 * **THIS IS THE FINAL MVP SHAPE — NOT A STUB.** ADR-0009 makes Hotel Core
 * the sole authority on outbound quota; the Integration service explicitly
 * does NOT gate on quota. This adapter satisfies the `HotelCoreQuotaPort`
 * contract required by the T13 dispatch service by always returning
 * `{ reserved: true }` and no-op commits / rollbacks.
 *
 * Do NOT convert this to a real HC RPC in this repo. Q-B-08 (HC quota RPC
 * contract) is CLOSED on the Integration side — HC calls Integration; the
 * reverse path does not exist by design.
 */

import type { Logger } from '@core/logger/logger.js';

import type { HotelCoreQuotaPort } from '../ports/hotel-core-quota.port.js';
import type { QuotaCheckResult } from '../whatsapp-outbound-dispatch.types.js';

const LOG_MODULE = 'whatsapp';
const LOG_MSG = 'wa_quota.passthrough_invoked';
const RESERVATION_ID_PREFIX = 'passthrough-';

export class HotelCoreQuotaPassthroughAdapter implements HotelCoreQuotaPort {
  constructor(private readonly logger: Logger) {}

  checkAndReserve(hotelId: string, count: number): Promise<QuotaCheckResult> {
    const reservationId = `${RESERVATION_ID_PREFIX}${hotelId}`;
    this.logger.debug({
      msg: LOG_MSG,
      module: LOG_MODULE,
      op: 'checkAndReserve',
      hotelId,
      count,
    });
    return Promise.resolve({ reserved: true, reservationId });
  }

  commit(reservationId: string): Promise<void> {
    this.logger.debug({
      msg: LOG_MSG,
      module: LOG_MODULE,
      op: 'commit',
      reservationId,
    });
    return Promise.resolve();
  }

  rollback(reservationId: string): Promise<void> {
    this.logger.debug({
      msg: LOG_MSG,
      module: LOG_MODULE,
      op: 'rollback',
      reservationId,
    });
    return Promise.resolve();
  }
}
