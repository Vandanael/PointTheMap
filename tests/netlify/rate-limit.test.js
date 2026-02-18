import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  delete process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS;
  vi.restoreAllMocks();
});

describe('rate limit helpers', () => {
  it('runs sampled cleanup at most once per cleanup interval', async () => {
    process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS = '60000';
    vi.resetModules();

    const { maybeCleanupExpiredRateLimits } =
      await import('../../netlify/functions/_rate-limit.js');

    const calls = [];
    const sql = vi.fn(async (strings) => {
      const query = strings.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
      calls.push(query);
      return [];
    });

    const first = await maybeCleanupExpiredRateLimits({ sql, sampleRate: 1 });
    const second = await maybeCleanupExpiredRateLimits({ sql, sampleRate: 1 });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('delete from rate_limits where expires_at < now()');
  });

  it('falls back to in-memory limiter when DB check fails', async () => {
    vi.resetModules();
    const { checkDbRateLimit, createFallbackRateLimiter } =
      await import('../../netlify/functions/_rate-limit.js');

    const fallback = createFallbackRateLimiter({ windowMs: 60_000, maxRequests: 2 });
    const sql = vi.fn(async () => {
      throw Object.assign(new Error('connection timeout'), { code: 'ETIMEDOUT' });
    });

    const first = await checkDbRateLimit({
      ip: '198.51.100.50',
      sql,
      keyPrefix: '',
      maxRequests: 2,
      fallback,
    });
    const second = await checkDbRateLimit({
      ip: '198.51.100.50',
      sql,
      keyPrefix: '',
      maxRequests: 2,
      fallback,
    });
    const third = await checkDbRateLimit({
      ip: '198.51.100.50',
      sql,
      keyPrefix: '',
      maxRequests: 2,
      fallback,
    });

    expect(first).toEqual({ allowed: true, remaining: 1 });
    expect(second).toEqual({ allowed: true, remaining: 0 });
    expect(third).toEqual({ allowed: false, remaining: 0 });
  });

  it('continues rate-limit DB flow when cleanup query fails', async () => {
    vi.resetModules();
    const { checkDbRateLimit, createFallbackRateLimiter } =
      await import('../../netlify/functions/_rate-limit.js');

    const sql = vi.fn(async (strings) => {
      const query = strings.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
      if (query.startsWith('delete from rate_limits')) {
        throw new Error('cleanup failed');
      }
      if (query.startsWith('insert into rate_limits')) {
        return [{ count: 1 }];
      }
      return [];
    });

    const result = await checkDbRateLimit({
      ip: '203.0.113.60',
      sql,
      keyPrefix: '',
      maxRequests: 3,
      fallback: createFallbackRateLimiter({ windowMs: 60_000, maxRequests: 3 }),
      logger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    });

    expect(result).toEqual({ allowed: true, remaining: 2 });
    expect(sql).toHaveBeenCalled();
  });
});
