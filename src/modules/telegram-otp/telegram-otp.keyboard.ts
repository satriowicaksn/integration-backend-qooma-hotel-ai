// Pure helpers: the 4-button OTP inline keyboard + compact callback-data
// codec `otp:<action>:<ticket_id>` (≤ 64 bytes per Telegram's limit —
// longest is `otp:declined:` + UUID = 49). No side effects, no deps.
//
// ANTI-CHEAT: the keyboard and callback data carry ONLY action + ticket id —
// by construction no code value can appear in any Telegram payload built
// from these helpers.

import { OTP_CALLBACK_DATA_PREFIX } from '@modules/telegram/index.js';
import type { TelegramInlineKeyboardMarkup } from '@modules/telegram-outbound/index.js';

import type { OtpCallbackAction } from './telegram-otp.types.js';

const ACTIONS: readonly OtpCallbackAction[] = ['done', 'nocode', 'declined', 'resend'];

const BUTTON_LABELS: Record<OtpCallbackAction, string> = {
  done: 'Sudah diantar',
  nocode: 'Selesai tanpa kode',
  declined: 'Tamu tidak mau kode',
  resend: 'Kirim ulang kode',
};

export function buildOtpCallbackData(action: OtpCallbackAction, ticketId: string): string {
  return `${OTP_CALLBACK_DATA_PREFIX}${action}:${ticketId}`;
}

export function buildOtpKeyboard(ticketId: string): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: BUTTON_LABELS.done, callback_data: buildOtpCallbackData('done', ticketId) },
        { text: BUTTON_LABELS.resend, callback_data: buildOtpCallbackData('resend', ticketId) },
      ],
      [
        { text: BUTTON_LABELS.nocode, callback_data: buildOtpCallbackData('nocode', ticketId) },
        {
          text: BUTTON_LABELS.declined,
          callback_data: buildOtpCallbackData('declined', ticketId),
        },
      ],
    ],
  };
}

export interface ParsedOtpCallbackData {
  readonly action: OtpCallbackAction;
  readonly ticketId: string;
}

export function parseOtpCallbackData(data: string): ParsedOtpCallbackData | null {
  if (!data.startsWith(OTP_CALLBACK_DATA_PREFIX)) return null;
  const rest = data.slice(OTP_CALLBACK_DATA_PREFIX.length);
  const separator = rest.indexOf(':');
  if (separator <= 0) return null;
  const action = rest.slice(0, separator);
  const ticketId = rest.slice(separator + 1);
  if (!(ACTIONS as readonly string[]).includes(action) || ticketId === '') return null;
  return { action: action as OtpCallbackAction, ticketId };
}
