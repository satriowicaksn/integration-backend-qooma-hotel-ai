// Bridges the T23 `WhatsappConfigReadPort` to slot-B `WhatsappConfigRepository`.
// Maps the persisted `WaConfig` row to the narrow status-oriented view the
// overview aggregator returns (PM C ACK T23 binding #7 recommendation).

import type { WhatsappConfigRepository } from '@modules/whatsapp/whatsapp-config.repository.js';

import type { WhatsappOverviewView } from '../integration-overview.types.js';
import type { WhatsappConfigReadPort } from '../ports/whatsapp-config-read.port.js';

export class WhatsappConfigReadAdapter implements WhatsappConfigReadPort {
  constructor(private readonly repo: WhatsappConfigRepository) {}

  async getForHotel(input: { hotelId: string }): Promise<WhatsappOverviewView | null> {
    const row = await this.repo.findByHotelId(input.hotelId);
    if (row === null) return null;
    return {
      bsp: row.bsp,
      phoneNumber: row.phoneNumber,
      phoneNumberId: row.phoneNumberId,
      verifiedAt: row.verifiedAt === null ? null : row.verifiedAt.toISOString(),
      hasAccessToken: row.accessTokenEnc.length > 0,
      webhookUrl: row.webhookUrl,
      wabaId: row.wabaId ?? null,
    };
  }
}
