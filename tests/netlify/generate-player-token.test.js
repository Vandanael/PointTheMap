import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../netlify/functions/db.js', () => ({
  getDatabase: vi.fn(() => async () => {
    return [];
  }),
}));

vi.mock('../../netlify/functions/_utils.js', () => ({
  errorEnvelope: (code, message, status, details, headers) => ({
    status,
    body: { ok: false, error: { code, message, details } },
    headers,
  }),
  successEnvelope: (body, headers) => ({
    status: 200,
    body: { ok: true, data: body },
    headers,
  }),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  isDatabaseConnectionError: vi.fn(() => false),
}));

vi.mock('../../netlify/functions/_rate-limit.js', () => ({
  createFallbackRateLimiter: vi.fn(() => ({
    check: vi.fn(() => ({ allowed: true, remaining: 9 })),
  })),
  checkDbRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9 })),
}));

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    randomUUID: () => 'uuid-1234',
    default: actual,
  };
});
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'mock-jwt-token'),
  },
}));

const makeReq = (method) => ({
  method,
  headers: { get: () => null },
});
describe('generate-player-token function', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    vi.resetModules();
  });

  it('handles CORS preflight', async () => {
    const { default: handler } = await import('../../netlify/functions/generate-player-token.js');
    const res = await handler(makeReq('OPTIONS'), {});
    expect(res.status).toBe(200);
  });

  it('rejects non-POST methods', async () => {
    const { default: handler } = await import('../../netlify/functions/generate-player-token.js');
    const res = await handler(makeReq('GET'), {});
    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe('method_not_allowed');
  });

  it('returns 429 when rate limiter blocks request', async () => {
    const rateLimit = await import('../../netlify/functions/_rate-limit.js');
    rateLimit.checkDbRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 });

    const { default: handler } = await import('../../netlify/functions/generate-player-token.js');
    const res = await handler(makeReq('POST'), {});
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('rate_limited');
    expect(res.headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('returns error envelope when token generation fails', async () => {
    const db = await import('../../netlify/functions/db.js');
    db.getDatabase.mockImplementationOnce(() => {
      throw new Error('Failed to connect to database');
    });

    const { default: handler } = await import('../../netlify/functions/generate-player-token.js');
    const res = await handler(makeReq('POST'), {});

    expect(res.status).toBe(500);
    expect(res.body?.error?.code).toBe('internal_error');
  });
});
