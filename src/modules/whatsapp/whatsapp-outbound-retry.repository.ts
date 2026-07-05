/**
 * `outbound_dispatch_queue` retry-side repository — sibling to T13's
 * `WhatsappOutboundDispatchRepository`. T13 primitive is preserved
 * byte-for-byte per cross-primitive discipline; T14 owns retry-scheduling
 * mutations on the SAME table via a distinct method surface.
 *
 * **EXACTLY 2 methods** per PM B ACK binding condition #4:
 *  - `markRetryScheduled(dispatchId, attemptCount)` — bumps
 *    `outbound_dispatch_queue.attempts` for audit trail (Bull manages its own
 *    attemptsMade counter separately at T14-followup adapter).
 *  - `markPermanentFail(dispatchId, lastError)` — sets `status='failed'` +
 *    persists classification reason to `last_error JSON`.
 *
 * No `markDead` (spec §7 optional; deferred to T14-followup). No
 * `findByDispatchId` (input carries context per PM ACK 5-field clarification).
 */

import type { Prisma, PrismaClient } from '@prisma/client';

import type { PermanentFailPersistenceInput } from './whatsapp-outbound-retry.types.js';

export class WhatsappOutboundRetryRepository {
  constructor(private readonly db: PrismaClient) {}

  async markRetryScheduled(dispatchId: string, attemptCount: number): Promise<void> {
    await this.db.outboundDispatch.update({
      where: { id: dispatchId },
      data: { attempts: attemptCount },
    });
  }

  async markPermanentFail(
    dispatchId: string,
    lastError: PermanentFailPersistenceInput,
  ): Promise<void> {
    const errorPayload: Prisma.InputJsonValue = {
      reason: lastError.reason,
      ...(lastError.status !== undefined ? { status: lastError.status } : {}),
      ...(lastError.body !== undefined ? { body: describeBody(lastError.body) } : {}),
    };
    await this.db.outboundDispatch.update({
      where: { id: dispatchId },
      data: { status: 'failed', lastError: errorPayload },
    });
  }
}

/**
 * Coerce arbitrary `body` (from Meta upstream) into a JSON-storable string so
 * the `Prisma.InputJsonValue` shape stays honest (no `as X` casts on
 * `unknown` — T15/T13 discriminated-union discipline extended).
 */
function describeBody(body: unknown): string {
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}
