// Bridges the T23 `QrStateReadPort` to the T22 `QrStateRepository`.
// Maps the persisted `QrDomain` (`waLink` + `pngUrl`) to the overview
// wire-shape (`url` + `pngUrl` + `generatedAt` ISO string).

import type { QrStateRepository } from '@modules/qr-provisioning/qr-provisioning.repository.js';

import type { QrOverviewView } from '../integration-overview.types.js';
import type { QrStateReadPort } from '../ports/qr-state-read.port.js';

export class QrStateReadAdapter implements QrStateReadPort {
  constructor(private readonly repo: QrStateRepository) {}

  async getForHotel(input: { hotelId: string }): Promise<QrOverviewView | null> {
    const domain = await this.repo.findByHotelId(input.hotelId);
    if (domain === null) return null;
    return {
      url: domain.waLink,
      pngUrl: domain.pngUrl,
      generatedAt: domain.generatedAt.toISOString(),
    };
  }
}
