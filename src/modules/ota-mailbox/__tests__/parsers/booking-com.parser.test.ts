import { describe, expect, it } from '@jest/globals';

import type { EmailMessage } from '../../ota-mailbox.types.js';
import { parseBookingComEmail } from '../../parsers/booking-com.parser.js';

function buildEmail(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    uid: 100,
    fromAddress: 'noreply@booking.com',
    subject: 'Booking Confirmation - Confirmation number: 1234567890',
    body: [
      'Guest name: Jane Doe',
      'Check-in: 2026-08-15',
      'Check-out: 2026-08-20',
      'Room number: 204',
      'Confirmation number: 1234567890',
    ].join('\n'),
    receivedAt: new Date('2026-07-06T18:00:00Z'),
    ...overrides,
  };
}

describe('parseBookingComEmail — happy paths', () => {
  it('should extract all fields when the email is a canonical Booking.com confirmation', () => {
    const parsed = parseBookingComEmail(buildEmail());
    expect(parsed).toEqual({
      guestName: 'Jane Doe',
      checkInDate: '2026-08-15',
      checkOutDate: '2026-08-20',
      roomNumber: '204',
      bookingSource: 'booking_com',
      externalRef: '1234567890',
    });
  });

  it('should treat roomNumber as null when the email omits it', () => {
    const email = buildEmail({
      body: [
        'Guest name: Jane Doe',
        'Check-in: 2026-08-15',
        'Check-out: 2026-08-20',
        'Confirmation number: ABC-123',
      ].join('\n'),
    });
    expect(parseBookingComEmail(email)?.roomNumber).toBeNull();
  });

  it('should treat externalRef as null when confirmation number is missing', () => {
    const email = buildEmail({
      subject: 'Your reservation at Grand Hotel',
      body: [
        'Guest name: Jane Doe',
        'Check-in: 2026-08-15',
        'Check-out: 2026-08-20',
        'Room number: 101',
      ].join('\n'),
    });
    expect(parseBookingComEmail(email)?.externalRef).toBeNull();
  });

  it('should accept upper-case section labels', () => {
    const email = buildEmail({
      body: ['GUEST NAME: Jane Doe', 'CHECK-IN: 2026-08-15', 'CHECK-OUT: 2026-08-20'].join('\n'),
    });
    expect(parseBookingComEmail(email)?.guestName).toBe('Jane Doe');
  });
});

describe('parseBookingComEmail — reject non-Booking.com', () => {
  it('should return null when the sender is not booking.com', () => {
    expect(parseBookingComEmail(buildEmail({ fromAddress: 'noreply@expedia.com' }))).toBeNull();
  });

  it('should return null when neither subject nor body carries a confirmation marker', () => {
    expect(
      parseBookingComEmail(
        buildEmail({ subject: 'Weekly newsletter', body: 'Some marketing content' }),
      ),
    ).toBeNull();
  });
});

describe('parseBookingComEmail — malformed / missing required fields', () => {
  it('should return null when guest name is missing', () => {
    const email = buildEmail({
      body: ['Check-in: 2026-08-15', 'Check-out: 2026-08-20'].join('\n'),
    });
    expect(parseBookingComEmail(email)).toBeNull();
  });

  it('should return null when check-in is missing', () => {
    const email = buildEmail({
      body: ['Guest name: Jane Doe', 'Check-out: 2026-08-20'].join('\n'),
    });
    expect(parseBookingComEmail(email)).toBeNull();
  });

  it('should return null when check-out is missing', () => {
    const email = buildEmail({
      body: ['Guest name: Jane Doe', 'Check-in: 2026-08-15'].join('\n'),
    });
    expect(parseBookingComEmail(email)).toBeNull();
  });

  it('should return null when dates are not ISO YYYY-MM-DD', () => {
    const email = buildEmail({
      body: ['Guest name: Jane Doe', 'Check-in: 15/08/2026', 'Check-out: 20/08/2026'].join('\n'),
    });
    expect(parseBookingComEmail(email)).toBeNull();
  });
});
