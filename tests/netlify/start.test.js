import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../netlify/functions/db.js', () => ({
  getDatabase: vi.fn(() => async () => []),
}));

vi.mock('../../netlify/functions/_utils.js', () => ({
  errorEnvelope: (code, message, status) => ({ status, body: { ok: false, error: { code, message } } }),
  successEnvelope: (body) => ({ status: 200, body: { ok: true, data: body } }),
  parseJsonBody: vi.fn(async () => ({})),
  handleDatabaseError: vi.fn(),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('../../lib/config/game-modes.js', () => ({
  getGameMode: vi.fn(() => ({ capitalSelection: { type: 'random' } })),
  isValidMode: vi.fn(() => false),
}));

vi.mock('../../lib/config/index.js', () => ({
  API: { SESSION_EXPIRY_MS: 60000 },
}));

vi.mock('../../lib/capital-selection/index.js', () => ({
  selectCapitals: vi.fn(() => []),
  selectCountries: vi.fn(() => []),
  selectCivilizations: vi.fn(() => []),
  selectStadiums: vi.fn(() => []),
}));

vi.mock('jsonwebtoken', () => ({
  default: { verify: vi.fn(() => ({ player_id: 'player-1' })) },
}));

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    randomUUID: () => 'uuid-1234',
    default: actual,
  };
});

vi.mock('../../lib/data/capitals.js', () => ({ capitals: [] }));
vi.mock('../../lib/data/civilizations.js', () => ({ civilizations: [] }));
vi.mock('../../lib/data/stadiums.js', () => ({ stadiums: [] }));

const makeReq = (method, body) => ({
  method,
  headers: new Map(),
  url: 'http://localhost/.netlify/functions/start',
  body: body ? JSON.stringify(body) : undefined,
});

beforeEach(() => {
  vi.resetModules();
  process.env.JWT_SECRET = 'test-secret';
});

describe('start function', () => {
  it('rejects non-POST methods', async () => {
    const { default: handler } = await import('../../netlify/functions/start.js');
    const res = await handler(makeReq('GET'), {});
    expect(res.status).toBe(405);
  });

  it('rejects invalid game mode', async () => {
    const { parseJsonBody } = await import('../../netlify/functions/_utils.js');
    parseJsonBody.mockResolvedValueOnce({ gameType: 'invalid' });

    const { default: handler } = await import('../../netlify/functions/start.js');
    const res = await handler(makeReq('POST', { gameType: 'invalid' }), {});
    expect(res.status).toBe(400);
  });
});
