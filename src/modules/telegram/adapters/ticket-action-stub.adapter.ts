// MVP stub adapter for `TicketActionPort` (T19-followup PLAN GAP #1).
// Q-C-07 (HC RPC contract) is unresolved at Parent PM — this stub returns
// `{ status: 'not_found' }` for every action. The T19 primitive service
// renders that as "Ticket X not found." to the staff sender. Each
// invocation is logged as `hc_rpc_stubbed` so operators can see stubbed
// downstream calls.
//
// Swap this file for the real HTTP adapter once Q-C-07 lands.

import type { Logger } from '@core/logger/logger.js';

import type { TicketActionPort } from '../ports/ticket-action.port.js';
import type { TicketActionOutcome } from '../telegram-inbound.types.js';

const SUFFIX_LEN = 4;
const NOT_FOUND: TicketActionOutcome = { status: 'not_found' };

interface ActionInput {
  readonly hotelId: string;
  readonly ticketId: string;
  readonly staffId: string;
}

export class TicketActionStubAdapter implements TicketActionPort {
  constructor(private readonly logger: Logger) {}

  async take(input: ActionInput): Promise<TicketActionOutcome> {
    return this.stub('take', input);
  }

  async release(input: ActionInput): Promise<TicketActionOutcome> {
    return this.stub('release', input);
  }

  async markDone(input: ActionInput): Promise<TicketActionOutcome> {
    return this.stub('markDone', input);
  }

  private stub(action: string, input: ActionInput): Promise<TicketActionOutcome> {
    this.logger.warn({
      msg: 'telegram_inbound.hc_rpc_stubbed',
      module: 'telegram',
      port: 'ticket_action',
      action,
      hotelId: input.hotelId,
      ticketId: input.ticketId,
      staffIdSuffix: input.staffId.slice(-SUFFIX_LEN),
    });
    return Promise.resolve(NOT_FOUND);
  }
}
