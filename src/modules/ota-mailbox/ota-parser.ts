// Parser dispatcher — routes a raw EmailMessage to the appropriate per-OTA
// parser, or returns `unrecognized` (spec §3.3 failure mode: log + skip).
//
// Order of attempts is intentional: from-address / subject markers make the
// two OTA parsers cheap to reject, so we try both in a fixed order and
// return on first recognition.

import type { EmailMessage, ParseOutcome } from './ota-mailbox.types.js';
import { parseAgodaEmail } from './parsers/agoda.parser.js';
import { parseBookingComEmail } from './parsers/booking-com.parser.js';

export function parseEmail(msg: EmailMessage): ParseOutcome {
  const bookingCom = parseBookingComEmail(msg);
  if (bookingCom !== null) {
    return { kind: 'recognized', source: 'booking_com', visit: bookingCom };
  }
  const agoda = parseAgodaEmail(msg);
  if (agoda !== null) {
    return { kind: 'recognized', source: 'agoda', visit: agoda };
  }
  return { kind: 'unrecognized' };
}
