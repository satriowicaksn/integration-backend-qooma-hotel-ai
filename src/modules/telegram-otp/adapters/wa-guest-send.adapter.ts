// GuestWaSendPort adapter over the T28 WhatsappOutboundDispatchService.
// Consumes the whatsapp module ONLY through its barrel (module-boundary
// rule). Discriminates the dispatch outcome to a boolean; failure reasons
// are already logged by the dispatch pipeline (body content never logged —
// this is the resent-OTP-code path).
//
// NOTE (deviation, documented in T97 report): the resent code message is
// dispatched WITHOUT the /internal/wa/dispatch conversations upsert, so the
// code never lands in the CRM conversation history.

import type { WhatsappOutboundDispatchService } from '@modules/whatsapp/index.js';

import type {
  GuestWaSendInput,
  GuestWaSendPort,
  GuestWaSendResult,
} from '../ports/guest-wa-send.port.js';

export class WaGuestSendAdapter implements GuestWaSendPort {
  constructor(private readonly dispatchService: WhatsappOutboundDispatchService) {}

  async sendText(input: GuestWaSendInput): Promise<GuestWaSendResult> {
    const outcome = await this.dispatchService.dispatchMessage({
      hotelId: input.hotelId,
      guestId: input.guestId,
      recipientPhone: input.recipientPhone,
      body: input.body,
    });
    return { sent: outcome.kind === 'dispatched' };
  }
}
