// Pure `wa.me` URL builder (spec §3.4 step 1). Module-private per
// PM C ACK T22 binding #7 (not exported from barrel).
//
// Normalizes the E.164-style phone number by stripping non-digits so both
// `+62-812-345-6789` and `+6281234567890` produce the same `wa.me/62...`
// URL. Greeting text is URL-encoded via `encodeURIComponent` so that
// arbitrary user text (including spaces + unicode) survives round-trip.
// When `greetingText` is absent, the `?text=` query param is omitted
// entirely per PM C ACK T22 GAP #5 default.

export function buildWaMeLink(input: { phoneNumber: string; greetingText?: string }): string {
  const digitsOnly = input.phoneNumber.replace(/\D+/g, '');
  const base = `https://wa.me/${digitsOnly}`;
  const greeting = input.greetingText?.trim();
  if (greeting === undefined || greeting === '') {
    return base;
  }
  return `${base}?text=${encodeURIComponent(greeting)}`;
}
