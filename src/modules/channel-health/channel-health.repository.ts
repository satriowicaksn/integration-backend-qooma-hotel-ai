// Prisma-direct repository for `channel_health_snapshots` (ADR-0001 —
// no wrap-interface). PrismaClient injected via ctor so unit-testable with
// plain-object mock (tolerated deviation per PM C ACK §571 + T17 precedent);
// real integration test lands when Q-C-01 (Prisma singleton) resolves.

import type { ChannelHealthSnapshot, PrismaClient } from '@prisma/client';

import type { ChannelHealthDomain, HealthProvider, HealthStatus } from './channel-health.types.js';

export interface ChannelHealthInsertInput {
  readonly hotelId: string;
  readonly provider: HealthProvider;
  readonly status: HealthStatus;
  readonly latencyMs: number | null;
}

export class ChannelHealthRepository {
  constructor(private readonly db: PrismaClient) {}

  async findLatestByHotelProvider(
    hotelId: string,
    provider: HealthProvider,
  ): Promise<ChannelHealthDomain | null> {
    const row = await this.db.channelHealthSnapshot.findFirst({
      where: { hotelId, provider },
      orderBy: { checkedAt: 'desc' },
    });
    return row ? toDomain(row) : null;
  }

  async insertSnapshot(input: ChannelHealthInsertInput): Promise<ChannelHealthDomain> {
    const row = await this.db.channelHealthSnapshot.create({
      data: {
        hotelId: input.hotelId,
        provider: input.provider,
        status: input.status,
        latencyMs: input.latencyMs,
      },
    });
    return toDomain(row);
  }
}

function toDomain(row: ChannelHealthSnapshot): ChannelHealthDomain {
  return {
    id: row.id,
    hotelId: row.hotelId,
    provider: row.provider as HealthProvider,
    status: row.status as HealthStatus,
    latencyMs: row.latencyMs,
    checkedAt: row.checkedAt,
  };
}
