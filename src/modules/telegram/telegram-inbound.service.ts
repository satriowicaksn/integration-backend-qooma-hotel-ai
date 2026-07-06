// Orchestrator: parses the raw Telegram Update, identifies the staff sender,
// dispatches take/release/done via TicketActionPort, and returns a
// DispatchResult that the (future) webhook handler will map to a bot reply.
//
// Security posture (T19 GAP #2): staff-not-recognized → silent ignore, never
// reveals bot existence to unknown senders. Unknown commands from recognized
// staff → help reply.

import type { Logger } from '@core/logger/logger.js';

import type { StaffLookupPort } from './ports/staff-lookup.port.js';
import type { TicketActionPort } from './ports/ticket-action.port.js';
import { HELP_TEXT, parseCommand } from './telegram-inbound.commands.js';
import type { TelegramUpdate } from './telegram-inbound.schema.js';
import type {
  DispatchResult,
  StaffIdentity,
  TicketActionOutcome,
  TicketCommandKind,
} from './telegram-inbound.types.js';

export class TelegramInboundService {
  constructor(
    private readonly staffLookup: StaffLookupPort,
    private readonly ticketAction: TicketActionPort,
    private readonly logger: Logger,
  ) {}

  async handleUpdate(hotelId: string, update: TelegramUpdate): Promise<DispatchResult> {
    const message = update.message;
    if (!message) {
      return { kind: 'ignored', reason: 'no_message' };
    }
    if (!message.from) {
      return { kind: 'ignored', reason: 'no_sender' };
    }
    const text = message.text;
    if (typeof text !== 'string' || text.trim() === '') {
      return { kind: 'ignored', reason: 'no_text' };
    }

    const telegramUserId = String(message.from.id);
    const staff = await this.staffLookup.lookupByTelegramUserId({ hotelId, telegramUserId });
    if (staff === null) {
      this.logger.info({
        msg: 'telegram_inbound.ignored',
        module: 'telegram',
        hotelId,
        reason: 'staff_not_recognized',
        telegramUserIdSuffix: telegramUserId.slice(-4),
      });
      return { kind: 'ignored', reason: 'staff_not_recognized' };
    }

    const parsed = parseCommand(text);
    this.logger.info({
      msg: 'telegram_inbound.dispatch',
      module: 'telegram',
      hotelId,
      staffId: staff.staffId,
      command: parsed.kind,
    });

    if (parsed.kind === 'help' || parsed.kind === 'unknown') {
      return { kind: 'reply', text: HELP_TEXT };
    }

    return this.dispatchTicketCommand(staff, parsed);
  }

  private async dispatchTicketCommand(
    staff: StaffIdentity,
    command: { kind: TicketCommandKind; ticketId: string },
  ): Promise<DispatchResult> {
    const input = {
      hotelId: staff.hotelId,
      ticketId: command.ticketId,
      staffId: staff.staffId,
    };
    const outcome = await this.invokeAction(command.kind, input);
    return { kind: 'reply', text: renderOutcomeReply(command, outcome) };
  }

  private async invokeAction(
    kind: TicketCommandKind,
    input: { hotelId: string; ticketId: string; staffId: string },
  ): Promise<TicketActionOutcome> {
    switch (kind) {
      case 'take':
        return this.ticketAction.take(input);
      case 'release':
        return this.ticketAction.release(input);
      case 'done':
        return this.ticketAction.markDone(input);
    }
  }
}

function renderOutcomeReply(
  command: { kind: TicketCommandKind; ticketId: string },
  outcome: TicketActionOutcome,
): string {
  const verb = OUTCOME_VERB[command.kind];
  switch (outcome.status) {
    case 'ok':
      return `Ticket ${command.ticketId} ${verb.ok}.`;
    case 'not_found':
      return `Ticket ${command.ticketId} not found.`;
    case 'forbidden':
      return `You are not allowed to ${verb.action} ticket ${command.ticketId}.`;
  }
}

const OUTCOME_VERB: Record<TicketCommandKind, { ok: string; action: string }> = {
  take: { ok: 'assigned to you', action: 'take' },
  release: { ok: 'released', action: 'release' },
  done: { ok: 'marked as done', action: 'mark as done for' },
};
