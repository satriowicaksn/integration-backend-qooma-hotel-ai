import { describe, expect, it } from '@jest/globals';

import type { EmailMessage } from '../ota-mailbox.types.js';
import { parseEmail } from '../ota-parser.js';

const CANON_BOOKING_BODY = [
  'Guest name: Jane Doe',
  'Check-in: 2026-08-15',
  'Check-out: 2026-08-20',
  'Confirmation number: XYZ-1',
].join('\n');

const CANON_AGODA_BODY = [
  'Guest name: John Smith',
  'Check-in: 2026-09-01',
  'Check-out: 2026-09-05',
  'Booking id: AGD-1',
].join('\n');

describe('parseEmail — dispatcher', () => {
  it('should route a Booking.com confirmation to booking_com', () => {
    const msg: EmailMessage = {
      uid: 1,
      fromAddress: 'noreply@booking.com',
      subject: 'Booking Confirmation',
      body: CANON_BOOKING_BODY,
      receivedAt: new Date('2026-07-06'),
    };
    const out = parseEmail(msg);
    expect(out.kind).toBe('recognized');
    if (out.kind === 'recognized') {
      expect(out.source).toBe('booking_com');
      expect(out.visit.guestName).toBe('Jane Doe');
    }
  });

  it('should route an Agoda confirmation to agoda', () => {
    const msg: EmailMessage = {
      uid: 2,
      fromAddress: 'noreply@agoda.com',
      subject: 'Booking Confirmation',
      body: CANON_AGODA_BODY,
      receivedAt: new Date('2026-07-06'),
    };
    const out = parseEmail(msg);
    expect(out.kind).toBe('recognized');
    if (out.kind === 'recognized') {
      expect(out.source).toBe('agoda');
    }
  });

  it('should return unrecognized when neither parser recognizes the email', () => {
    const msg: EmailMessage = {
      uid: 3,
      fromAddress: 'noreply@some-newsletter.com',
      subject: 'Weekly newsletter',
      body: 'Some marketing content',
      receivedAt: new Date('2026-07-06'),
    };
    expect(parseEmail(msg)).toEqual({ kind: 'unrecognized' });
  });

  it('should return unrecognized when Booking.com sender has a malformed body', () => {
    const msg: EmailMessage = {
      uid: 4,
      fromAddress: 'noreply@booking.com',
      subject: 'Confirmation number: X',
      body: 'Guest name: Jane', // dates missing
      receivedAt: new Date('2026-07-06'),
    };
    expect(parseEmail(msg)).toEqual({ kind: 'unrecognized' });
  });
});
