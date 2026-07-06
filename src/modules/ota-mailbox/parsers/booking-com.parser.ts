// Pure Booking.com confirmation email parser. Regex-based extraction from
// subject + body against the public documented format. Returns `null` on any
// missing required field (spec §3.3 failure mode: "log + skip, don't crash").
//
// Real production hardening (multi-locale, HTML variants, encoding) is
// T21-followup; PM C ACK GAP #1 tolerated deviation.

import type { EmailMessage, ParsedVisit } from '../ota-mailbox.types.js';

const FROM_DOMAINS = ['booking.com'];
const CONFIRMATION_MARKERS = [
  /confirmation number[:\s]/i,
  /booking confirmation/i,
  /your reservation at/i,
];

const GUEST_NAME_PATTERN = /guest(?: name)?[:\s]+([A-Za-zÀ-ÿ' .-]{2,80})/i;
const CHECK_IN_PATTERN = /check[-\s]?in[:\s]+(\d{4}-\d{2}-\d{2})/i;
const CHECK_OUT_PATTERN = /check[-\s]?out[:\s]+(\d{4}-\d{2}-\d{2})/i;
const ROOM_PATTERN = /room(?:\s?number)?[:\s]+([A-Za-z0-9-]{1,20})/i;
const REF_PATTERN = /confirmation number[:\s]+([A-Za-z0-9-]{4,80})/i;

/** Returns `null` when the email does not appear to be a Booking.com
 *  confirmation OR when any required field is missing. */
export function parseBookingComEmail(msg: EmailMessage): ParsedVisit | null {
  if (!isBookingComEmail(msg)) {
    return null;
  }
  const haystack = `${msg.subject}\n${msg.body}`;
  const guest = GUEST_NAME_PATTERN.exec(haystack)?.[1];
  const checkIn = CHECK_IN_PATTERN.exec(haystack)?.[1];
  const checkOut = CHECK_OUT_PATTERN.exec(haystack)?.[1];
  if (guest === undefined || checkIn === undefined || checkOut === undefined) {
    return null;
  }
  return {
    guestName: guest.trim(),
    checkInDate: checkIn,
    checkOutDate: checkOut,
    roomNumber: ROOM_PATTERN.exec(haystack)?.[1] ?? null,
    bookingSource: 'booking_com',
    externalRef: REF_PATTERN.exec(haystack)?.[1] ?? null,
  };
}

function isBookingComEmail(msg: EmailMessage): boolean {
  const from = msg.fromAddress.toLowerCase();
  if (!FROM_DOMAINS.some((d) => from.includes(d))) {
    return false;
  }
  return CONFIRMATION_MARKERS.some((rx) => rx.test(msg.subject) || rx.test(msg.body));
}
