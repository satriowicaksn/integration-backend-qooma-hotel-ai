export type { TelegramConfigDomain, TelegramConfigView } from './telegram.types.js';

export type { TelegramConfigPutDto, TelegramConfigResponseDto } from './telegram.schema.js';

export { TelegramConfigPutSchema, TelegramConfigResponseSchema } from './telegram.schema.js';

export { TelegramConfigRepository } from './telegram.repository.js';
export type { TelegramConfigUpsertInput } from './telegram.repository.js';

export { TelegramConfigService } from './telegram.service.js';

// T19 — Telegram inbound command parser + intent dispatch (primitive).
// Router / HMAC wiring / adapter impls deferred pending Q-C-01/02/03.

export type {
  DispatchIgnoredReason,
  DispatchResult,
  HelpCommand,
  ParsedCommand,
  StaffIdentity,
  StaffRole,
  TicketActionOutcome,
  TicketCommand,
  TicketCommandKind,
  UnknownCommand,
} from './telegram-inbound.types.js';

export type {
  TelegramChat,
  TelegramMessage,
  TelegramUpdate,
  TelegramUser,
} from './telegram-inbound.schema.js';

export {
  TelegramChatSchema,
  TelegramMessageSchema,
  TelegramUpdateSchema,
  TelegramUserSchema,
} from './telegram-inbound.schema.js';

export { HELP_TEXT, parseCommand } from './telegram-inbound.commands.js';
export { TelegramInboundService } from './telegram-inbound.service.js';

export type { StaffLookupPort } from './ports/staff-lookup.port.js';
export type { TicketActionPort } from './ports/ticket-action.port.js';
