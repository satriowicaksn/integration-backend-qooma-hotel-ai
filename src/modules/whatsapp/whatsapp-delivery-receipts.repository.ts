/**
 * `delivery_receipts` repository — sibling to T10/T11/T12 pattern. **Cross-
 * table** by design: correlation reads from `outbound_dispatch_queue` (T13's
 * future table, schema present per T02) and delivery-receipts writes to
 * `delivery_receipts` (§4.6 DDL). Both concerns belong to the delivery-
 * receipts flow (per PM B ACK GAP T15-#1 A).
 *
 * **EXACTLY 2 methods** per PM B ACK GAP T15-#4 A + binding condition #4:
 *  - `findDispatchByExternalId(hotelId, externalId)` — correlation READ with
 *    **MANDATORY tenant guard** (both `hotelId` AND `externalId` in `where`).
 *    Prevents cross-tenant orphan hijack.
 *  - `persist(input)` — WRITE with FK-validated dispatchId. Caller (service)
 *    verifies correlation first; Prisma throws on FK violation.
 */

import type { DeliveryReceipt, OutboundDispatch, PrismaClient } from '@prisma/client';

import type { DeliveryReceiptPersistenceInput } from './whatsapp-delivery-receipts.types.js';

export class WhatsappDeliveryReceiptsRepository {
  constructor(private readonly db: PrismaClient) {}

  async findDispatchByExternalId(
    hotelId: string,
    externalId: string,
  ): Promise<OutboundDispatch | null> {
    return this.db.outboundDispatch.findFirst({
      where: { hotelId, externalId },
    });
  }

  async persist(input: DeliveryReceiptPersistenceInput): Promise<DeliveryReceipt> {
    return this.db.deliveryReceipt.create({
      data: {
        hotelId: input.hotelId,
        dispatchId: input.dispatchId,
        externalId: input.externalId,
        status: input.status,
      },
    });
  }
}
