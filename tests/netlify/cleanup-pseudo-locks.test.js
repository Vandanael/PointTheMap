import { describe, expect, it, vi } from 'vitest';

vi.mock('../../netlify/functions/db.js', () => ({
  getDatabase: vi.fn(() => async () => {
    return [];
  }),
}));

vi.mock('../../netlify/functions/_utils.js', () => ({
  errorEnvelope: (code, message, status) => ({
    status,
    body: { ok: false, error: { code, message } },
  }),
  successEnvelope: (data) => ({
    status: 200,
    body: { ok: true, data },
  }),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

const makeReq = (method, token = null) => ({
  method,
  headers: {
    get: (name) => {
      if (String(name).toLowerCase() === 'x-maintenance-token') return token;
      return null;
    },
  },
});

describe('cleanup-pseudo-locks function', () => {
  it('rejects non-POST methods', async () => {
    const { default: handler } = await import('../../netlify/functions/cleanup-pseudo-locks.js');
    const res = await handler(makeReq('GET'), {});
    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe('method_not_allowed');
  });

  it('returns deleted count on success', async () => {
    vi.resetModules();
    vi.doMock('../../netlify/functions/db.js', () => ({
      getDatabase: vi.fn(() => async () => {
        return [{ ip: '203.0.113.5' }, { ip: '203.0.113.7' }];
      }),
    }));
    const { default: handler } = await import('../../netlify/functions/cleanup-pseudo-locks.js');
    const res = await handler(makeReq('POST'), {});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.deletedCount).toBe(2);
  });
});
