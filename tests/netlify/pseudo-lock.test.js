import { describe, it, expect, vi } from 'vitest';
import { acquirePseudoLock } from '../../netlify/functions/_pseudo-lock.js';

describe('acquirePseudoLock', () => {
  it('returns ok=true when insert/upsert succeeds', async () => {
    const sql = vi.fn().mockResolvedValueOnce([{ pseudo: 'ABCD' }]);
    const result = await acquirePseudoLock({ sql, ip: '127.0.0.1', pseudo: 'ABCD' });
    expect(result).toEqual({ ok: true });
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('returns conflicting pseudo when lock is held by another pseudo', async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ pseudo: 'LOCKE' }]);
    const result = await acquirePseudoLock({ sql, ip: '127.0.0.1', pseudo: 'OTHER' });
    expect(result).toEqual({ ok: false, pseudo: 'LOCKE' });
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it('returns null pseudo if lookup row is missing', async () => {
    const sql = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = await acquirePseudoLock({ sql, ip: '127.0.0.1', pseudo: 'OTHER' });
    expect(result).toEqual({ ok: false, pseudo: null });
  });
});
