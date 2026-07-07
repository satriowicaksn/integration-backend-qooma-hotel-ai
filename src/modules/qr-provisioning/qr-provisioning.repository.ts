// Prisma-direct repository for `qr_state` (ADR-0001 — no wrap-interface).
// PrismaClient injected via ctor so unit-testable with plain-object mock
// (tolerated deviation per PM C ACK T22 binding #9 + T17/T19/T24/T21
// precedent; integration test blocked on Q-C-01 Prisma singleton).
//
// `generatedAt` bump discipline (PM C ACK T22 binding #10): the DDL
// column has `@default(now())` which only fires on INSERT. On UPDATE the
// service passes a clock-derived `generatedAt` explicitly so tests can
// assert deterministically.

import type { PrismaClient, QrState } from '@prisma/client';

import type { QrDomain } from './qr-provisioning.types.js';

export interface QrUpsertInput {
  readonly hotelId: string;
  readonly waLink: string;
  readonly pngUrl: string;
  readonly generatedAt: Date;
}

export class QrStateRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByHotelId(hotelId: string): Promise<QrDomain | null> {
    const row = await this.db.qrState.findUnique({ where: { hotelId } });
    return row ? toDomain(row) : null;
  }

  async upsert(input: QrUpsertInput): Promise<QrDomain> {
    const row = await this.db.qrState.upsert({
      where: { hotelId: input.hotelId },
      create: {
        hotelId: input.hotelId,
        waLink: input.waLink,
        pngUrl: input.pngUrl,
        generatedAt: input.generatedAt,
      },
      update: {
        waLink: input.waLink,
        pngUrl: input.pngUrl,
        generatedAt: input.generatedAt,
      },
    });
    return toDomain(row);
  }
}

function toDomain(row: QrState): QrDomain {
  return {
    hotelId: row.hotelId,
    waLink: row.waLink,
    pngUrl: row.pngUrl,
    generatedAt: row.generatedAt,
  };
}
