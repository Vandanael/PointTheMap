import { describe, it, expect, vi } from 'vitest';

vi.mock('../../netlify/functions/db.js', () => ({
  getDatabase: vi.fn(() => async () => []),
}));

vi.mock('../../netlify/functions/_utils.js', () => ({
  jsonResponse: (body, status) => ({ status, body }),
  parseJsonBody: vi.fn(async () => ({})),
  getClientIp: vi.fn(() => '127.0.0.1'),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

const makeReq = (method) => ({
  method,
  headers: new Map(),
  url: 'http://localhost/.netlify/functions/error-report',
});

describe('error-report function', () => {
  it('rejects non-POST methods', async () => {
    const { default: handler } = await import('../../netlify/functions/error-report.js');
    const res = await handler(makeReq('GET'), {});
    expect(res.status).toBe(405);
  });

  it('rejects missing errors array', async () => {
    const { default: handler } = await import('../../netlify/functions/error-report.js');
    const res = await handler(makeReq('POST'), {});
    expect(res.status).toBe(400);
  });
});
