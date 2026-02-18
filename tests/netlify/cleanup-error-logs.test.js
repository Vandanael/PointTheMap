import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  delete process.env.MAINTENANCE_TOKEN;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('cleanup-error-logs function', () => {
  it('returns 405 for non-POST methods', async () => {
    vi.doMock('../../netlify/functions/db.js', () => ({
      getDatabase: vi.fn(() => vi.fn(async () => [])),
    }));

    const { default: handler } = await import('../../netlify/functions/cleanup-error-logs.js');
    const req = new Request('http://localhost/.netlify/functions/cleanup-error-logs', {
      method: 'GET',
    });

    const res = await handler(req, {});
    const payload = await res.json();

    expect(res.status).toBe(405);
    expect(payload.error.code).toBe('method_not_allowed');
  });

  it('cleans up old logs with maintenance token', async () => {
    process.env.MAINTENANCE_TOKEN = 'secret';

    vi.doMock('../../netlify/functions/db.js', () => ({
      getDatabase: vi.fn(() =>
        vi.fn(async (strings) => {
          const query = strings.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
          if (query.startsWith('delete from error_logs')) {
            return [{ id: 1 }, { id: 2 }];
          }
          return [];
        })
      ),
    }));

    const { default: handler } = await import('../../netlify/functions/cleanup-error-logs.js');
    const req = new Request('http://localhost/.netlify/functions/cleanup-error-logs', {
      method: 'POST',
      headers: {
        'x-maintenance-token': 'secret',
      },
    });

    const res = await handler(req, {});
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.deleted).toBe(2);
    expect(payload.data.retentionDays).toBe(30);
  });
});
