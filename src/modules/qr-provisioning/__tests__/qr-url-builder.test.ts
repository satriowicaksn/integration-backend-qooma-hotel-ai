import { describe, expect, it } from '@jest/globals';

import { buildWaMeLink } from '../qr-url-builder.js';

describe('buildWaMeLink — phone normalization', () => {
  it('should strip a leading + when the phone is E.164 with plus', () => {
    expect(buildWaMeLink({ phoneNumber: '+6281234567890' })).toBe('https://wa.me/6281234567890');
  });

  it('should strip separators and internal dashes when the phone is formatted', () => {
    expect(buildWaMeLink({ phoneNumber: '+62-812-3456-7890' })).toBe('https://wa.me/6281234567890');
    expect(buildWaMeLink({ phoneNumber: '+62 812 3456 7890' })).toBe('https://wa.me/6281234567890');
    expect(buildWaMeLink({ phoneNumber: '(0812) 3456-7890' })).toBe('https://wa.me/081234567890');
  });
});

describe('buildWaMeLink — greeting encoding', () => {
  it('should omit ?text= when greetingText is undefined (PM C ACK GAP #5)', () => {
    expect(buildWaMeLink({ phoneNumber: '+6281234567890' })).toBe('https://wa.me/6281234567890');
  });

  it('should omit ?text= when greetingText is an empty string', () => {
    expect(buildWaMeLink({ phoneNumber: '+6281234567890', greetingText: '' })).toBe(
      'https://wa.me/6281234567890',
    );
  });

  it('should omit ?text= when greetingText is only whitespace', () => {
    expect(buildWaMeLink({ phoneNumber: '+6281234567890', greetingText: '   ' })).toBe(
      'https://wa.me/6281234567890',
    );
  });

  it('should url-encode a greeting with spaces', () => {
    expect(buildWaMeLink({ phoneNumber: '+6281234567890', greetingText: 'Hello there' })).toBe(
      'https://wa.me/6281234567890?text=Hello%20there',
    );
  });

  it('should url-encode a greeting with unicode characters', () => {
    expect(buildWaMeLink({ phoneNumber: '+6281234567890', greetingText: 'Halo 🙏' })).toBe(
      'https://wa.me/6281234567890?text=Halo%20%F0%9F%99%8F',
    );
  });

  it('should url-encode reserved characters in the greeting', () => {
    expect(buildWaMeLink({ phoneNumber: '+6281234567890', greetingText: 'a=b&c?d' })).toBe(
      'https://wa.me/6281234567890?text=a%3Db%26c%3Fd',
    );
  });
});
