import { describe, expect, it } from '@jest/globals';

import { HELP_TEXT, parseCommand } from '../telegram-inbound.commands.js';

describe('parseCommand — ticket commands', () => {
  it.each([
    ['/take 1234', 'take', '1234'],
    ['/release 1234', 'release', '1234'],
    ['/done 1234', 'done', '1234'],
  ])('should parse "%s" into %s command with ticket id', (input, kind, ticketId) => {
    expect(parseCommand(input)).toEqual({ kind, ticketId });
  });

  it('should accept UUID-style ticket ids', () => {
    expect(parseCommand('/take 550e8400-e29b-41d4-a716-446655440000')).toEqual({
      kind: 'take',
      ticketId: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('should accept alphanumeric ticket ids', () => {
    expect(parseCommand('/done ABC123')).toEqual({
      kind: 'done',
      ticketId: 'ABC123',
    });
  });

  it('should lowercase the command word (case-insensitive)', () => {
    expect(parseCommand('/TAKE 42')).toEqual({ kind: 'take', ticketId: '42' });
  });

  it('should strip @BotUsername suffix from command word', () => {
    expect(parseCommand('/take@qooma_demo_bot 42')).toEqual({
      kind: 'take',
      ticketId: '42',
    });
  });

  it('should tolerate leading whitespace', () => {
    expect(parseCommand('   /release 42')).toEqual({ kind: 'release', ticketId: '42' });
  });

  it('should tolerate extra internal whitespace', () => {
    expect(parseCommand('/take    42')).toEqual({ kind: 'take', ticketId: '42' });
  });
});

describe('parseCommand — help', () => {
  it('should parse /help', () => {
    expect(parseCommand('/help')).toEqual({ kind: 'help' });
  });

  it('should parse /HELP case-insensitively', () => {
    expect(parseCommand('/HELP')).toEqual({ kind: 'help' });
  });

  it('should strip @bot suffix on /help', () => {
    expect(parseCommand('/help@qooma_demo_bot')).toEqual({ kind: 'help' });
  });
});

describe('parseCommand — unknown / malformed', () => {
  it('should return unknown for missing ticket id on /take', () => {
    expect(parseCommand('/take')).toEqual({ kind: 'unknown', raw: '/take' });
  });

  it('should return unknown for empty text', () => {
    expect(parseCommand('')).toEqual({ kind: 'unknown', raw: '' });
  });

  it('should return unknown for null / undefined text', () => {
    expect(parseCommand(null)).toEqual({ kind: 'unknown', raw: '' });
    expect(parseCommand(undefined)).toEqual({ kind: 'unknown', raw: '' });
  });

  it('should return unknown for text not starting with slash', () => {
    expect(parseCommand('take 42')).toEqual({ kind: 'unknown', raw: 'take 42' });
    expect(parseCommand('hello there')).toEqual({ kind: 'unknown', raw: 'hello there' });
  });

  it('should return unknown for unrecognized command word', () => {
    expect(parseCommand('/start')).toEqual({ kind: 'unknown', raw: '/start' });
    expect(parseCommand('/mystery 42')).toEqual({ kind: 'unknown', raw: '/mystery 42' });
  });

  it('should return unknown for ticket id with disallowed characters', () => {
    expect(parseCommand('/take ../etc/passwd')).toEqual({
      kind: 'unknown',
      raw: '/take ../etc/passwd',
    });
    expect(parseCommand('/take id;drop')).toEqual({ kind: 'unknown', raw: '/take id;drop' });
  });

  it('should return unknown for oversized ticket id (>64 chars)', () => {
    const oversized = 'x'.repeat(65);
    expect(parseCommand(`/take ${oversized}`)).toEqual({
      kind: 'unknown',
      raw: `/take ${oversized}`,
    });
  });
});

describe('HELP_TEXT', () => {
  it('should mention each of the four supported commands', () => {
    expect(HELP_TEXT).toContain('/take');
    expect(HELP_TEXT).toContain('/release');
    expect(HELP_TEXT).toContain('/done');
    expect(HELP_TEXT).toContain('/help');
  });
});
