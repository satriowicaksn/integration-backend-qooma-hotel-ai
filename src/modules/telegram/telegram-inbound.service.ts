// Orchestrator: parses the raw Telegram Update, identifies the staff sender,
// dispatches take/release/done via TicketActionPort, and returns a
// DispatchResult that the (future) webhook handler will map to a bot reply.
//
// Security posture (T19 GAP #2): staff-not-recognized → silent ignore, never
// reveals bot existence to unknown senders. Unknown commands from recognized
// staff → help reply.
//
// T97 (ADD-24) additions — routed BEFORE the staff-command path, both gated
// on the optional OtpInteractionPort:
//  - `callback_query` updates whose data starts with `otp:` → OTP buttons.
//  - messages that REPLY to another message with exactly a 2-digit code →
//    OTP verification. Non-reply 2-digit texts fall through to the command
//    parser (i.e. NEVER trigger verification).
// Telegram retries webhooks, so both paths dedupe via a TTL-LRU keyed by
// callback id / update id. The attempted code is NEVER logged here.

import type { Logger } from '@core/logger/logger.js';

import { createTtlLruCache, type TtlLruCache } from '@shared/utils/ttl-lru-cache.js';

import { OTP_CALLBACK_DATA_PREFIX, type OtpInteractionPort } from './ports/otp-interaction.port.js';
import type { StaffLookupPort } from './ports/staff-lookup.port.js';
import type { TicketActionPort } from './ports/ticket-action.port.js';
import { HELP_TEXT, parseCommand } from './telegram-inbound.commands.js';
import type { TelegramCallbackQuery, TelegramUpdate } from './telegram-inbound.schema.js';
import type {
  DispatchResult,
  StaffIdentity,
  TicketActionOutcome,
  TicketCommandKind,
} from './telegram-inbound.types.js';

const OTP_REPLY_CODE_PATTERN = /^\d{2}$/;
const DEDUPE_MAX_SIZE = 2000;
const DEDUPE_TTL_MS = 10 * 60_000;

export class TelegramInboundService {
  private readonly dedupe: TtlLruCache<boolean>;

  constructor(
    private readonly staffLookup: StaffLookupPort,
    private readonly ticketAction: TicketActionPort,
    private readonly logger: Logger,
    private readonly otp?: OtpInteractionPort,
    dedupeCache?: TtlLruCache<boolean>,
  ) {
    this.dedupe =
      dedupeCache ?? createTtlLruCache<boolean>({ maxSize: DEDUPE_MAX_SIZE, ttlMs: DEDUPE_TTL_MS });
  }

  async handleUpdate(hotelId: string, update: TelegramUpdate): Promise<DispatchResult> {
    if (update.callback_query !== undefined) {
      return this.handleCallbackQuery(hotelId, update.callback_query);
    }

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

    const trimmed = text.trim();
    if (
      this.otp !== undefined &&
      message.reply_to_message !== undefined &&
      OTP_REPLY_CODE_PATTERN.test(trimmed)
    ) {
      return this.handleOtpReplyCode(hotelId, {
        updateId: update.update_id,
        chatId: String(message.chat.id),
        replyToMessageId: message.reply_to_message.message_id,
        code: trimmed,
        actorTelegramId: telegramUserId,
      });
    }

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

  private async handleCallbackQuery(
    hotelId: string,
    callback: TelegramCallbackQuery,
  ): Promise<DispatchResult> {
    if (this.otp === undefined) {
      return { kind: 'ignored', reason: 'otp_not_configured' };
    }
    const data = callback.data;
    if (data === undefined || !data.startsWith(OTP_CALLBACK_DATA_PREFIX)) {
      return { kind: 'ignored', reason: 'callback_unsupported' };
    }
    const dedupeKey = `cb:${callback.id}`;
    if (this.dedupe.has(dedupeKey)) {
      return { kind: 'ignored', reason: 'duplicate_update' };
    }
    this.dedupe.set(dedupeKey, true);

    try {
      await this.otp.handleCallback({
        hotelId,
        callbackQueryId: callback.id,
        data,
        actorTelegramId: String(callback.from.id),
        chatId: callback.message !== undefined ? String(callback.message.chat.id) : null,
        messageId: callback.message?.message_id ?? null,
      });
    } catch (err) {
      this.logger.error({
        msg: 'telegram_inbound.otp_callback_failed',
        module: 'telegram',
        hotelId,
        errCode: err instanceof Error ? err.name : 'unknown',
      });
    }
    return { kind: 'handled', via: 'otp_callback' };
  }

  private async handleOtpReplyCode(
    hotelId: string,
    input: {
      updateId: number;
      chatId: string;
      replyToMessageId: number;
      code: string;
      actorTelegramId: string;
    },
  ): Promise<DispatchResult> {
    const dedupeKey = `upd:${input.updateId}`;
    if (this.dedupe.has(dedupeKey)) {
      return { kind: 'ignored', reason: 'duplicate_update' };
    }
    this.dedupe.set(dedupeKey, true);

    try {
      await this.otp?.handleReplyCode({
        hotelId,
        chatId: input.chatId,
        replyToMessageId: input.replyToMessageId,
        code: input.code,
        actorTelegramId: input.actorTelegramId,
      });
    } catch (err) {
      // errCode only — never the message, which downstream MUST keep
      // code-free anyway (defense in depth).
      this.logger.error({
        msg: 'telegram_inbound.otp_reply_verify_failed',
        module: 'telegram',
        hotelId,
        errCode: err instanceof Error ? err.name : 'unknown',
      });
    }
    return { kind: 'handled', via: 'otp_reply_verify' };
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
