// Pure parser for Telegram staff commands (spec §3.2).
// Accepts raw message text, returns discriminated union. No side effects,
// no external deps — trivially unit-testable.

import type { ParsedCommand, TicketCommandKind } from './telegram-inbound.types.js';

const TICKET_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

const TICKET_COMMAND_KINDS: readonly TicketCommandKind[] = ['take', 'release', 'done'] as const;

function isTicketCommandKind(value: string): value is TicketCommandKind {
  return (TICKET_COMMAND_KINDS as readonly string[]).includes(value);
}

export function parseCommand(rawText: string | undefined | null): ParsedCommand {
  const trimmed = (rawText ?? '').trim();
  if (trimmed === '' || !trimmed.startsWith('/')) {
    return { kind: 'unknown', raw: trimmed };
  }

  const [head, ...rest] = trimmed.split(/\s+/);
  const commandWord = (head ?? '').slice(1).split('@')[0]?.toLowerCase() ?? '';

  if (commandWord === 'help') {
    return { kind: 'help' };
  }

  if (isTicketCommandKind(commandWord)) {
    const ticketId = rest[0] ?? '';
    if (!TICKET_ID_PATTERN.test(ticketId)) {
      return { kind: 'unknown', raw: trimmed };
    }
    return { kind: commandWord, ticketId };
  }

  return { kind: 'unknown', raw: trimmed };
}

export const HELP_TEXT = [
  'Available commands:',
  '/take <ticket_id> — assign a ticket to yourself',
  '/release <ticket_id> — release your assignment',
  '/done <ticket_id> — mark ticket resolved',
  '/help — show this message',
].join('\n');
