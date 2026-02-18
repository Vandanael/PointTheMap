import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('error-report privacy controls', () => {
  it('rejects payloads above max size', async () => {
    vi.doMock('../../netlify/functions/db.js', () => ({
      getDatabase: vi.fn(() => vi.fn(async () => [])),
    }));

    const { default: handler } = await import('../../netlify/functions/error-report.js');
    const body = JSON.stringify({ errors: [{ message: 'x'.repeat(35 * 1024) }] });
    const req = new Request('http://localhost/.netlify/functions/error-report', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body,
    });

    const res = await handler(req, { ip: '203.0.113.10' });
    const payload = await res.json();

    expect(res.status).toBe(413);
    expect(payload.error.code).toBe('payload_too_large');
  });

  it('redacts sensitive fields and strips query params from url', async () => {
    const inserted = [];

    const sql = vi.fn(async (strings, ...values) => {
      const query = strings.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
      if (query.startsWith('insert into error_logs')) {
        inserted.push(values);
      }
      return [];
    });

    vi.doMock('../../netlify/functions/db.js', () => ({
      getDatabase: vi.fn(() => sql),
    }));

    const { default: handler } = await import('../../netlify/functions/error-report.js');

    const req = {
      method: 'POST',
      headers: {
        get(name) {
          const key = String(name).toLowerCase();
          if (key === 'user-agent') return 'agent token=abc123 user=test@example.com';
          if (key === 'referer') {
            return 'https://pointthemap.net/play?token=abc123&email=test@example.com#frag';
          }
          if (key === 'content-length') return null;
          return null;
        },
      },
      async json() {
        return {
          errors: [
            {
              message: 'User test@example.com failed token=abc123 from 192.168.0.1',
              stack: 'Authorization: Bearer secret-token-value',
              context: 'auth token=abc123',
              type: 'TypeError',
            },
          ],
        };
      },
    };
    const res = await handler(/** @type {any} */ (req), { ip: '203.0.113.11' });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(inserted).toHaveLength(1);

    const [message, stack, context, type, url, userAgent] = inserted[0];
    expect(message).not.toContain('test@example.com');
    expect(message).not.toContain('192.168.0.1');
    expect(message).toContain('[REDACTED_EMAIL]');
    expect(stack).toContain('[REDACTED]');
    expect(context).toContain('[REDACTED]');
    expect(type).toBe('TypeError');
    expect(url).toBe('https://pointthemap.net/play');
    expect(userAgent).not.toContain('abc123');
  });
});
