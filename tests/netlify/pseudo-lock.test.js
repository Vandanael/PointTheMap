import { describe, it, expect, vi } from 'vitest';
import { acquirePseudoLock } from '../../netlify/functions/_pseudo-lock.js';

describe('acquirePseudoLock', () => {
  it('returns ok=true when insert/upsert succeeds', async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ pseudo: 'ABCD', updated_at: '2026-02-18T10:00:00Z' }]);
    const result = await acquirePseudoLock({ sql, ip: '127.0.0.1', pseudo: 'ABCD' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lock.pseudo).toBe('ABCD');
      expect(typeof result.lock.updatedAt).toBe('string');
      expect(typeof result.lock.expiresAt).toBe('string');
    }
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('returns conflicting pseudo when lock is held by another pseudo', async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ pseudo: 'LOCKE', updated_at: '2026-02-18T10:00:00Z' }]);
    const result = await acquirePseudoLock({ sql, ip: '127.0.0.1', pseudo: 'OTHER' });
    expect(result).toMatchObject({ ok: false, pseudo: 'LOCKE' });
    if (!result.ok) {
      expect(result.lock.pseudo).toBe('LOCKE');
      expect(typeof result.lock.updatedAt).toBe('string');
      expect(typeof result.lock.expiresAt).toBe('string');
    }
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it('returns null pseudo if lookup row is missing', async () => {
    const sql = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = await acquirePseudoLock({ sql, ip: '127.0.0.1', pseudo: 'OTHER' });
    expect(result).toEqual({
      ok: false,
      pseudo: null,
      lock: { pseudo: null, updatedAt: null, expiresAt: null },
    });
  });
});
