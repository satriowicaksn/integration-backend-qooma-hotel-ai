// Reads `phoneNumber` from slot-B's `WhatsappConfigRepository` for the
// QR regenerate route. The T22 primitive service is decoupled from WA
// config (per PM C ACK T22 binding #5) — this adapter provides the
// route-layer bridge.

import type { WhatsappConfigRepository } from '@modules/whatsapp/whatsapp-config.repository.js';

import type { WhatsappPhoneLookupPort } from '../qr-provisioning.routes.js';

export class WhatsappPhoneLookupAdapter implements WhatsappPhoneLookupPort {
  constructor(private readonly repo: WhatsappConfigRepository) {}

  async lookupPhone(input: { hotelId: string }): Promise<string | null> {
    const row = await this.repo.findByHotelId(input.hotelId);
    return row === null ? null : row.phoneNumber;
  }
}
