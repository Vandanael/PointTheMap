import { describe, expect, it } from 'vitest';

import { redactForLog, redactToken } from '../../netlify/functions/_utils.js';

describe('log redaction', () => {
  it('masks token-like values', () => {
    expect(redactToken('abcdef123456')).toBe('abcd***56');
    expect(redactToken('abc')).toBe('***');
    expect(redactToken('')).toBe('[redacted]');
  });

  it('redacts sensitive fields recursively', () => {
    const input = {
      token: 'session-token-123456',
      pseudo: 'ALFA',
      rounds: [
        {
          click: { lat: 48.8, lng: 2.3 },
          score: 5000,
        },
      ],
      nested: {
        csrfToken: 'csrf-token-abcdef',
        authorization: 'Bearer secret-token',
      },
      gameType: 'classic',
      roundsCount: 5,
    };

    const redacted = /** @type {Record<string, any>} */ (redactForLog(input));
    expect(redacted.token).toBe('sess***56');
    expect(redacted.pseudo).toBe('[redacted]');
    expect(redacted.rounds).toBe('[redacted]');
    expect(redacted.nested.csrfToken).toBe('csrf***ef');
    expect(redacted.nested.authorization).toBe('[redacted]');
    expect(redacted.gameType).toBe('classic');
    expect(redacted.roundsCount).toBe(5);
  });
});
