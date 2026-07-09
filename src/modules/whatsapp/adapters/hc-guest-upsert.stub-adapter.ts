// STUB adapter for the T12 `HotelCoreGuestUpsertPort` (Q-B-04 parked).
// Follows the T19-fu telegram inbound stub pattern verbatim: per-
// invocation loud warn, PII last-4 suffix on wa_phone, synthetic
// deterministic `guestId` so downstream stubs get a stable key.
//
// Replace with a real HC RPC adapter once Q-B-04 ratifies the endpoint
// contract.

import { createHash, randomUUID } from 'node:crypto';

import type { Logger } from '@core/logger/logger.js';

import { maskWaPhone } from '@shared/utils/masking.js';

import type { HotelCoreGuestUpsertPort } from '../ports/hotel-core-guest-upsert.port.js';
import type { GuestUpsertInput, GuestUpsertResult } from '../whatsapp-webhook-ingest.types.js';

const LOG_MODULE = 'whatsapp';
const LOG_MSG = 'hc_guest_upsert.stub_invoked';

export class HotelCoreGuestUpsertStubAdapter implements HotelCoreGuestUpsertPort {
  constructor(private readonly logger: Logger) {}

  async upsertGuestByWaPhone(input: GuestUpsertInput): Promise<GuestUpsertResult> {
    this.logger.warn({
      msg: LOG_MSG,
      module: LOG_MODULE,
      hcAdapters: 'STUB',
      ratifyQs: 'Q-B-04',
      hotelId: input.hotelId,
      waPhone: maskWaPhone(input.waPhone),
    });
    return Promise.resolve({ guestId: syntheticGuestId(input.hotelId, input.waPhone) });
  }
}

/** Deterministic uuid-v4-shaped id derived from `hotelId + waPhone`. Same
 *  phone always maps to the same synthetic id so tests + repeated stubs
 *  agree — even without a real HC. Format bits set to v4 to satisfy
 *  Prisma uuid columns. Fallback to `randomUUID()` if the hash somehow
 *  yields an invalid byte range. */
function syntheticGuestId(hotelId: string, waPhone: string): string {
  try {
    const hex = createHash('sha256').update(`${hotelId}:${waPhone}`).digest('hex');
    const b = (start: number): string => hex.slice(start, start + 4);
    const version = '4';
    const variant = '8';
    return `${hex.slice(0, 8)}-${b(8)}-${version}${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  } catch {
    return randomUUID();
  }
}
