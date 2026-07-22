import { describe, expect, it } from '@jest/globals';

import {
  buildOtpCallbackData,
  buildOtpKeyboard,
  parseOtpCallbackData,
} from '../telegram-otp.keyboard.js';

const TICKET_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('buildOtpKeyboard', () => {
  it('should compose exactly 4 buttons in 2 rows with compact otp:<action>:<ticket_id> data', () => {
    const keyboard = buildOtpKeyboard(TICKET_ID);

    const buttons = keyboard.inline_keyboard.flat();
    expect(keyboard.inline_keyboard).toHaveLength(2);
    expect(buttons).toHaveLength(4);
    expect(buttons.map((b) => b.callback_data)).toEqual(
      expect.arrayContaining([
        `otp:done:${TICKET_ID}`,
        `otp:nocode:${TICKET_ID}`,
        `otp:declined:${TICKET_ID}`,
        `otp:resend:${TICKET_ID}`,
      ]),
    );
    expect(buttons.map((b) => b.text)).toEqual(
      expect.arrayContaining([
        'Sudah diantar',
        'Selesai tanpa kode',
        'Tamu tidak mau kode',
        'Kirim ulang kode',
      ]),
    );
  });

  it('should keep every callback_data within the Telegram 64-byte limit', () => {
    const buttons = buildOtpKeyboard(TICKET_ID).inline_keyboard.flat();
    for (const button of buttons) {
      expect(Buffer.byteLength(button.callback_data, 'utf8')).toBeLessThanOrEqual(64);
    }
  });
});

describe('parseOtpCallbackData', () => {
  it.each(['done', 'nocode', 'declined', 'resend'] as const)(
    'should round-trip the %s action',
    (action) => {
      const data = buildOtpCallbackData(action, TICKET_ID);
      expect(parseOtpCallbackData(data)).toEqual({ action, ticketId: TICKET_ID });
    },
  );

  it('should return null for foreign callback data', () => {
    expect(parseOtpCallbackData('vote:yes:123')).toBeNull();
  });

  it('should return null for unknown actions', () => {
    expect(parseOtpCallbackData(`otp:explode:${TICKET_ID}`)).toBeNull();
  });

  it('should return null when the ticket id segment is missing or empty', () => {
    expect(parseOtpCallbackData('otp:done')).toBeNull();
    expect(parseOtpCallbackData('otp:done:')).toBeNull();
    expect(parseOtpCallbackData('otp:')).toBeNull();
  });
});
