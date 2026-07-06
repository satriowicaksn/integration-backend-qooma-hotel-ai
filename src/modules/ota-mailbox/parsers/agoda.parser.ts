// Pure Agoda confirmation email parser. Same discipline as
// booking-com.parser.ts: null on missing required field, no throws.

import type { EmailMessage, ParsedVisit } from '../ota-mailbox.types.js';

const FROM_DOMAINS = ['agoda.com'];
const CONFIRMATION_MARKERS = [
  /booking confirmation/i,
  /reservation confirmed/i,
  /your agoda booking/i,
];

const GUEST_NAME_PATTERN = /guest(?: name)?[:\s]+([A-Za-zÀ-ÿ' .-]{2,80})/i;
const CHECK_IN_PATTERN = /check[-\s]?in[:\s]+(\d{4}-\d{2}-\d{2})/i;
const CHECK_OUT_PATTERN = /check[-\s]?out[:\s]+(\d{4}-\d{2}-\d{2})/i;
const ROOM_PATTERN = /room(?:\s?(?:number|type))?[:\s]+([A-Za-z0-9-]{1,20})/i;
const REF_PATTERN = /booking id[:\s]+([A-Za-z0-9-]{4,80})/i;

export function parseAgodaEmail(msg: EmailMessage): ParsedVisit | null {
  if (!isAgodaEmail(msg)) {
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
    bookingSource: 'agoda',
    externalRef: REF_PATTERN.exec(haystack)?.[1] ?? null,
  };
}

function isAgodaEmail(msg: EmailMessage): boolean {
  const from = msg.fromAddress.toLowerCase();
  if (!FROM_DOMAINS.some((d) => from.includes(d))) {
    return false;
  }
  return CONFIRMATION_MARKERS.some((rx) => rx.test(msg.subject) || rx.test(msg.body));
}
