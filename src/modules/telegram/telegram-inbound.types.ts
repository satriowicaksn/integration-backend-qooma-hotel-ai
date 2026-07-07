// Domain types for T19 Telegram inbound command handling (spec §3.2).
// Parser + service consume these; wire types (Telegram Update body) live in
// telegram-inbound.schema.ts (zod, source of truth).

export type TicketCommandKind = 'take' | 'release' | 'done';

export interface TicketCommand {
  readonly kind: TicketCommandKind;
  readonly ticketId: string;
}

export interface HelpCommand {
  readonly kind: 'help';
}

export interface UnknownCommand {
  readonly kind: 'unknown';
  readonly raw: string;
}

export type ParsedCommand = TicketCommand | HelpCommand | UnknownCommand;

export type StaffRole = 'staff' | 'supervisor' | 'gm';

export interface StaffIdentity {
  readonly staffId: string;
  readonly hotelId: string;
  readonly deptId: string;
  readonly role: StaffRole;
}

export type TicketActionOutcome =
  | { readonly status: 'ok' }
  | { readonly status: 'not_found' }
  | { readonly status: 'forbidden' };

export type DispatchResult =
  | { readonly kind: 'reply'; readonly text: string }
  | { readonly kind: 'ignored'; readonly reason: DispatchIgnoredReason };

export type DispatchIgnoredReason =
  | 'staff_not_recognized'
  | 'no_message'
  | 'no_sender'
  | 'no_text'
  | 'unknown_command';
