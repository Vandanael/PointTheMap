import { describe, it, expect, vi } from 'vitest';
import { loadActiveSessionByToken } from '../../netlify/functions/submit/session.js';

describe('submit session mapping', () => {
  it('maps only API/domain-safe keys from persistence row', async () => {
    const sql = vi.fn(async () => [
      {
        token: 'tok-1',
        targets: [{ name: 'Paris' }],
        start_time: '123456',
        used: false,
        game_type: 'classic',
        expires_at: new Date(Date.now() + 10000),
        csrf_token: 'csrf-1',
        player_id: 'player-1',
        created_at: 'should-not-leak',
      },
    ]);

    const result = await loadActiveSessionByToken({
      sql: (...args) => sql(...args),
      token: 'tok-1',
      markStage: () => {},
      logger: { error: () => {} },
      isDatabaseConnectionError: () => false,
      errorJson: () => new Response('err', { status: 500 }),
      finish: (response) => response,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session).toEqual({
        token: 'tok-1',
        targets: [{ name: 'Paris' }],
        startTime: 123456,
        used: false,
        gameType: 'classic',
        csrfToken: 'csrf-1',
        playerId: 'player-1',
      });
      expect('start_time' in result.session).toBe(false);
      expect('csrf_token' in result.session).toBe(false);
      expect('player_id' in result.session).toBe(false);
      expect('created_at' in result.session).toBe(false);
    }
  });
});
