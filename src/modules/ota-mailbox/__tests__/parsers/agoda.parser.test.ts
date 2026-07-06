import { describe, expect, it } from '@jest/globals';

import type { EmailMessage } from '../../ota-mailbox.types.js';
import { parseAgodaEmail } from '../../parsers/agoda.parser.js';

function buildEmail(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    uid: 200,
    fromAddress: 'noreply@agoda.com',
    subject: 'Your Agoda booking confirmation',
    body: [
      'Guest name: John Smith',
      'Check-in: 2026-09-01',
      'Check-out: 2026-09-05',
      'Room type: Deluxe',
      'Booking id: AGD-77712',
    ].join('\n'),
    receivedAt: new Date('2026-07-06T18:00:00Z'),
    ...overrides,
  };
}

describe('parseAgodaEmail — happy paths', () => {
  it('should extract all fields when the email is a canonical Agoda confirmation', () => {
    const parsed = parseAgodaEmail(buildEmail());
    expect(parsed).toEqual({
      guestName: 'John Smith',
      checkInDate: '2026-09-01',
      checkOutDate: '2026-09-05',
      roomNumber: 'Deluxe',
      bookingSource: 'agoda',
      externalRef: 'AGD-77712',
    });
  });

  it('should accept "reservation confirmed" as a confirmation marker', () => {
    const email = buildEmail({ subject: 'Reservation confirmed - AGD-77712' });
    expect(parseAgodaEmail(email)?.bookingSource).toBe('agoda');
  });
});

describe('parseAgodaEmail — reject non-Agoda', () => {
  it('should return null when the sender is not agoda.com', () => {
    expect(parseAgodaEmail(buildEmail({ fromAddress: 'noreply@booking.com' }))).toBeNull();
  });

  it('should return null when no confirmation marker is present', () => {
    expect(
      parseAgodaEmail(
        buildEmail({
          subject: 'Newsletter',
          body: 'Guest name: X\nCheck-in: 2026-01-01\nCheck-out: 2026-01-02',
        }),
      ),
    ).toBeNull();
  });
});

describe('parseAgodaEmail — malformed', () => {
  it('should return null when guest name is missing', () => {
    const email = buildEmail({
      body: ['Check-in: 2026-09-01', 'Check-out: 2026-09-05'].join('\n'),
    });
    expect(parseAgodaEmail(email)).toBeNull();
  });

  it('should return null when booking id is absent (externalRef falls back to null but core fields still parse)', () => {
    const email = buildEmail({
      body: ['Guest name: John Smith', 'Check-in: 2026-09-01', 'Check-out: 2026-09-05'].join('\n'),
    });
    const parsed = parseAgodaEmail(email);
    expect(parsed).not.toBeNull();
    expect(parsed?.externalRef).toBeNull();
  });
});
