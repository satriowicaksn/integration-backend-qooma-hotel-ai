// Cross-service RPC port — Integration → Hotel Core: apply a Telegram
// staff-command action to a ticket (spec §3.2 "RPC AI service (for handover)
// or Hotel Core (for ticket status update)").
//
// TYPE-ONLY in this primitive: adapter deferred to T19-followup pending Q-C-03
// (HC RPC client-side contract). Unit tests inject a jest fake.

import type { TicketActionOutcome } from '../telegram-inbound.types.js';

export interface TicketActionPort {
  take(input: { hotelId: string; ticketId: string; staffId: string }): Promise<TicketActionOutcome>;
  release(input: {
    hotelId: string;
    ticketId: string;
    staffId: string;
  }): Promise<TicketActionOutcome>;
  markDone(input: {
    hotelId: string;
    ticketId: string;
    staffId: string;
  }): Promise<TicketActionOutcome>;
}
