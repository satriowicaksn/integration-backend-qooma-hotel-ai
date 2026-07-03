/**
 * AES-256-GCM encryption helper untuk secrets at rest.
 *
 * Envelope format: v<version>:<iv_hex>:<ciphertext_hex>:<authTag_hex>
 *
 * Key rotation: envelope carries the key version so decrypt can pick the right
 * key. MVP resolves the current active key only (`ENCRYPTION_KEY` +
 * `ENCRYPTION_KEY_VERSION`); decrypting a retired version throws until retired
 * keys are wired into config. See docs/SECURITY.md §3.
 *
 * Fail-fast: the key comes from the validated config (`loadConfig()` rejects a
 * missing/short `ENCRYPTION_KEY` at boot); `decodeKey` additionally guards that
 * it decodes to a 32-byte AES-256 key.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { loadConfig } from '@core/config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_HEX_LENGTH = 64;
const ENVELOPE_PARTS = 4;

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
    Error.captureStackTrace?.(this, CryptoError);
  }
}

function decodeKey(hexKey: string): Buffer {
  if (!new RegExp(`^[0-9a-fA-F]{${KEY_HEX_LENGTH}}$`).test(hexKey)) {
    throw new CryptoError('ENCRYPTION_KEY must be 64 hex characters (32-byte AES-256 key)');
  }
  return Buffer.from(hexKey, 'hex');
}

function resolveKeyForVersion(version: string): Buffer {
  const config = loadConfig();
  if (version === config.ENCRYPTION_KEY_VERSION) {
    return decodeKey(config.ENCRYPTION_KEY);
  }
  throw new CryptoError(`No encryption key configured for version "${version}"`);
}

export function encrypt(plaintext: string): string {
  const config = loadConfig();
  const version = config.ENCRYPTION_KEY_VERSION;
  const key = decodeKey(config.ENCRYPTION_KEY);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${version}:${iv.toString('hex')}:${ciphertext.toString('hex')}:${authTag.toString('hex')}`;
}

export function decrypt(envelope: string): string {
  const parts = envelope.split(':');
  const [version, ivHex, ctHex, tagHex] = parts;
  if (
    parts.length !== ENVELOPE_PARTS ||
    version === undefined ||
    ivHex === undefined ||
    ctHex === undefined ||
    tagHex === undefined
  ) {
    throw new CryptoError('Malformed ciphertext envelope');
  }

  const key = resolveKeyForVersion(version);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new CryptoError('Malformed ciphertext envelope');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  try {
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    throw new CryptoError('Decryption failed: authentication tag mismatch or corrupt ciphertext');
  }
}

/** Convenience: encrypt connection string */
export function encryptDsn(dsn: string): string {
  return encrypt(dsn);
}

export function decryptDsn(envelope: string): string {
  return decrypt(envelope);
}
