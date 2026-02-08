import { describe, it, expect, vi } from 'vitest';

vi.mock('../../netlify/functions/db.js', () => ({
  getDatabase: vi.fn(() => async () => [
    { pseudo: 'AAA', score: 100, time: 10 },
    { pseudo: 'BBB', score: 90, time: 12 },
  ]),
}));

vi.mock('../../netlify/functions/_utils.js', () => ({
  successResponse: (body, headers) => ({ status: 200, body, headers }),
  errorResponse: (message, status) => ({ status, body: { error: message } }),
  handleDatabaseError: vi.fn(),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

const makeReq = (method, url = 'http://localhost/.netlify/functions/leaderboard') => ({
  method,
  headers: new Map([['host', 'localhost']]),
  url,
});

describe('leaderboard function', () => {
  it('rejects non-GET methods', async () => {
    const { default: handler } = await import('../../netlify/functions/leaderboard.js');
    const res = await handler(makeReq('POST'), {});
    expect(res.status).toBe(405);
  });

  it('returns ranked scores for daily type', async () => {
    const { default: handler } = await import('../../netlify/functions/leaderboard.js');
    const res = await handler(makeReq('GET', 'http://localhost/.netlify/functions/leaderboard?type=daily'), {});
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { rank: 1, pseudo: 'AAA', score: 100, time: 10 },
      { rank: 2, pseudo: 'BBB', score: 90, time: 12 },
    ]);
  });
});
