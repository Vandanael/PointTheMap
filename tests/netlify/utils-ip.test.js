import { afterEach, describe, expect, it } from 'vitest';

import { getClientIp } from '../../netlify/functions/_utils.js';

const makeReq = (headers = {}) => ({
  headers: {
    get(name) {
      const key = String(name).toLowerCase();
      const entry = Object.entries(headers).find(([k]) => String(k).toLowerCase() === key);
      return entry ? String(entry[1]) : null;
    },
  },
});

afterEach(() => {
  delete process.env.NODE_ENV;
});

describe('getClientIp', () => {
  it('prefers trusted context ip', () => {
    const ip = getClientIp(makeReq({ 'x-forwarded-for': '198.51.100.7' }), { ip: '203.0.113.1' });
    expect(ip).toBe('203.0.113.1');
  });

  it('uses netlify edge header when context ip is missing', () => {
    const ip = getClientIp(makeReq({ 'x-nf-client-connection-ip': '198.51.100.2' }), {});
    expect(ip).toBe('198.51.100.2');
  });

  it('returns unknown in production when only x-forwarded-for is present', () => {
    process.env.NODE_ENV = 'production';
    const ip = getClientIp(makeReq({ 'x-forwarded-for': '198.51.100.8' }), {});
    expect(ip).toBe('unknown');
  });

  it('allows x-forwarded-for fallback in non-production', () => {
    process.env.NODE_ENV = 'development';
    const ip = getClientIp(makeReq({ 'x-forwarded-for': '198.51.100.9, 198.51.100.10' }), {});
    expect(ip).toBe('198.51.100.9');
  });
});
