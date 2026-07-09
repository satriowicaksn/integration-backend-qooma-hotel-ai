/**
 * WA outbound DND — PASSTHROUGH adapter per ADR-0009.
 *
 * **THIS IS THE FINAL MVP SHAPE — NOT A STUB.** ADR-0009 makes Hotel Core
 * the sole authority on DND windows; the Integration service explicitly
 * does NOT gate on DND. This adapter satisfies the `HotelCoreDndPort`
 * contract required by the T13 dispatch service by always returning
 * `{ blocked: false, vvipExempt: false }`.
 *
 * Do NOT convert this to a real HC RPC in this repo. Q-B-09 (HC DND RPC
 * contract) is CLOSED on the Integration side.
 */

import type { Logger } from '@core/logger/logger.js';

import { maskWaPhone } from '@shared/utils/masking.js';

import type { HotelCoreDndPort } from '../ports/hotel-core-dnd.port.js';
import type { DndCheckResult } from '../whatsapp-outbound-dispatch.types.js';

const LOG_MODULE = 'whatsapp';
const LOG_MSG = 'wa_dnd.passthrough_invoked';

export class HotelCoreDndPassthroughAdapter implements HotelCoreDndPort {
  constructor(private readonly logger: Logger) {}

  isDndForRecipient(hotelId: string, recipientPhone: string): Promise<DndCheckResult> {
    this.logger.debug({
      msg: LOG_MSG,
      module: LOG_MODULE,
      hotelId,
      recipientPhone: maskWaPhone(recipientPhone),
    });
    return Promise.resolve({ blocked: false, vvipExempt: false });
  }
}
