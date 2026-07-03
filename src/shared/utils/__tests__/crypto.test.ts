import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { resetConfigCache } from '@core/config/env.js';

import { CryptoError, decrypt, decryptDsn, encrypt, encryptDsn } from '../crypto.js';

const VALID_KEY = 'a'.repeat(64);

const BASE_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  API_BASE_URL: 'http://localhost:3000',
  CORS_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://app:app@localhost:5433/app?schema=public',
  REDIS_URL: 'redis://localhost:6380',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  JWT_REFRESH_SECRET: 'y'.repeat(32),
  ENCRYPTION_KEY: VALID_KEY,
  ENCRYPTION_KEY_VERSION: 'v1',
};

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, BASE_ENV);
  resetConfigCache();
});

afterEach(() => {
  process.env = savedEnv;
  resetConfigCache();
});

describe('crypto.encrypt / decrypt', () => {
  it('should round-trip an ascii string when key is valid', () => {
    const secret = 'super-secret-access-token';
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it('should round-trip a unicode string when input has multibyte chars', () => {
    const secret = 'héllo-🔐-日本語';
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it('should round-trip an empty string when plaintext is empty', () => {
    expect(decrypt(encrypt(''))).toBe('');
  });

  it('should produce a versioned 4-part envelope when encrypting', () => {
    const parts = encrypt('token').split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
  });

  it('should produce different ciphertext each call when iv is random', () => {
    expect(encrypt('same-input')).not.toBe(encrypt('same-input'));
  });

  it('should throw CryptoError when the ciphertext is tampered', () => {
    const parts = encrypt('token').split(':');
    const ct = parts[2] as string;
    parts[2] = ct[0] === 'a' ? `b${ct.slice(1)}` : `a${ct.slice(1)}`;
    expect(() => decrypt(parts.join(':'))).toThrow(CryptoError);
  });

  it('should throw CryptoError when the auth tag is tampered', () => {
    const parts = encrypt('token').split(':');
    const tag = parts[3] as string;
    parts[3] = tag[0] === 'a' ? `b${tag.slice(1)}` : `a${tag.slice(1)}`;
    expect(() => decrypt(parts.join(':'))).toThrow(CryptoError);
  });

  it('should throw CryptoError when the envelope is malformed', () => {
    expect(() => decrypt('not-a-valid-envelope')).toThrow(CryptoError);
    expect(() => decrypt('v1:abc:def')).toThrow(CryptoError);
  });

  it('should throw CryptoError when the iv length is wrong for a known version', () => {
    const shortIv = 'aa';
    const tag = 'b'.repeat(32);
    expect(() => decrypt(`v1:${shortIv}:cc:${tag}`)).toThrow(CryptoError);
  });

  it('should throw CryptoError when the key version is unknown', () => {
    const parts = encrypt('token').split(':');
    parts[0] = 'v2';
    expect(() => decrypt(parts.join(':'))).toThrow(CryptoError);
  });

  it('should round-trip via encryptDsn / decryptDsn when given a dsn', () => {
    const dsn = 'postgresql://user:pw@host:5432/db';
    expect(decryptDsn(encryptDsn(dsn))).toBe(dsn);
  });
});

describe('crypto fail-fast', () => {
  it('should throw when ENCRYPTION_KEY is missing (config validation)', () => {
    delete process.env.ENCRYPTION_KEY;
    resetConfigCache();
    expect(() => encrypt('token')).toThrow();
  });

  it('should throw CryptoError when ENCRYPTION_KEY is 64 chars but not hex', () => {
    process.env.ENCRYPTION_KEY = 'z'.repeat(64);
    resetConfigCache();
    expect(() => encrypt('token')).toThrow(CryptoError);
  });
});
