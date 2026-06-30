/**
 * PII masking helpers. Wajib pakai SETIAP kali log atau display data sensitif
 * di luar konteks authorized (e.g., log debug, error message).
 *
 * Lihat docs/SECURITY.md §5.
 */

/**
 * Mask nomor WA: tampilkan 4 digit terakhir saja.
 * Input: +6281234567890
 * Output: +628******7890
 */
export function maskWaPhone(phone: string): string {
  if (!phone || phone.length < 5) return '***';
  const last4 = phone.slice(-4);
  const prefixLen = Math.max(0, phone.length - 4);
  return phone.slice(0, Math.min(4, prefixLen)) + '*'.repeat(Math.max(0, prefixLen - 4)) + last4;
}

/**
 * Mask email: tampilkan 1 char depan + domain.
 * Input: john.doe@example.com
 * Output: j***@example.com
 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email[0] ?? ''}***${email.slice(at)}`;
}

/**
 * Mask token / API key untuk log. Tampilkan 3 char terakhir saja.
 */
export function maskTokenForLog(token: string): string {
  if (!token || token.length < 4) return '***';
  return `***${token.slice(-3)}`;
}
