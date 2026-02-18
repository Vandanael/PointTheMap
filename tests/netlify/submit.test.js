import { describe, it, expect, vi } from 'vitest';

vi.mock('../../netlify/functions/db.js', () => ({
  getDatabase: vi.fn(() => async () => []),
}));

vi.mock('../../netlify/functions/_utils.js', () => ({
  errorEnvelope: (code, message, status, details) => ({
    status,
    body: { ok: false, error: { code, message, details } },
  }),
  successEnvelope: (body, _headers, meta) => ({
    status: 200,
    body: { ok: true, data: body, meta },
  }),
  parseJsonBody: vi.fn(async () => ({})),
  getClientIp: vi.fn(() => '127.0.0.1'),
  isDatabaseConnectionError: vi.fn(() => false),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('../../netlify/functions/_geo-data.js', () => ({
  getCountryFeature: vi.fn(),
  getCivilizationFeature: vi.fn(),
}));

const makeReq = (method) => ({
  method,
  headers: new Map(),
  url: 'http://localhost/.netlify/functions/submit',
});

describe('submit function', () => {
  it('rejects non-POST methods', async () => {
    const { default: handler } = await import('../../netlify/functions/submit.js');
    const res = await handler(makeReq('GET'), {});
    expect(res.status).toBe(405);
  });

  it('returns invalid payload for empty body', async () => {
    const { default: handler } = await import('../../netlify/functions/submit.js');
    const res = await handler(makeReq('POST'), {});
    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('invalid_payload');
  });

  it('rejects unsupported payload versions', async () => {
    const utils = await import('../../netlify/functions/_utils.js');
    utils.parseJsonBody.mockResolvedValueOnce({
      token: 'token-123',
      pseudo: 'ABC',
      rounds: [],
      payloadVersion: 2,
    });
    const { default: handler } = await import('../../netlify/functions/submit.js');
    const res = await handler(makeReq('POST'), {});
    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('unsupported_payload_version');
  });
});
