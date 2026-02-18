/**
 * Acquire a pseudo lock for an IP in an atomic way.
 * If the IP is already locked by another pseudo, returns that existing pseudo.
 *
 * @param {{ sql: any, ip: string, pseudo: string }} params
 * @returns {Promise<
 *   | { ok: true, lock: { pseudo: string, updatedAt: string, expiresAt: string } }
 *   | { ok: false, pseudo: string | null, lock: { pseudo: string | null, updatedAt: string | null, expiresAt: string | null } }
 * >}
 */
export async function acquirePseudoLock({ sql, ip, pseudo }) {
  const ttlHoursRaw = Number.parseInt(process.env.PSEUDO_LOCK_TTL_HOURS || '720', 10);
  const ttlHours = Number.isFinite(ttlHoursRaw) && ttlHoursRaw > 0 ? ttlHoursRaw : 720;
  const toIso = (value) => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };
  const withExpiry = (lockPseudo, updatedAtValue) => {
    const updatedAt = toIso(updatedAtValue);
    if (!updatedAt) {
      return {
        pseudo: lockPseudo ?? null,
        updatedAt: null,
        expiresAt: null,
      };
    }
    const expiresAt = new Date(
      new Date(updatedAt).getTime() + ttlHours * 60 * 60 * 1000
    ).toISOString();
    return {
      pseudo: lockPseudo ?? null,
      updatedAt,
      expiresAt,
    };
  };

  const upsertResult = await sql`
    INSERT INTO ip_pseudo_locks (ip, pseudo, updated_at)
    VALUES (${ip}, ${pseudo}, NOW())
    ON CONFLICT (ip) DO UPDATE
      SET pseudo = EXCLUDED.pseudo,
          updated_at = NOW()
    WHERE ip_pseudo_locks.pseudo = EXCLUDED.pseudo
       OR ip_pseudo_locks.updated_at < NOW() - (${ttlHours} * INTERVAL '1 hour')
    RETURNING pseudo, updated_at
  `;

  if (Array.isArray(upsertResult) && upsertResult.length > 0) {
    const row = upsertResult[0];
    return {
      ok: true,
      lock: withExpiry(row?.pseudo ?? pseudo, row?.updated_at ?? new Date().toISOString()),
    };
  }

  const existing = await sql`
    SELECT pseudo, updated_at
    FROM ip_pseudo_locks
    WHERE ip = ${ip}
    LIMIT 1
  `;
  const row = existing[0];
  return {
    ok: false,
    pseudo: row?.pseudo ?? null,
    lock: withExpiry(row?.pseudo ?? null, row?.updated_at ?? null),
  };
}
