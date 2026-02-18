/**
 * Acquire a pseudo lock for an IP in an atomic way.
 * If the IP is already locked by another pseudo, returns that existing pseudo.
 *
 * @param {{ sql: any, ip: string, pseudo: string }} params
 * @returns {Promise<{ ok: true } | { ok: false, pseudo: string | null }>}
 */
export async function acquirePseudoLock({ sql, ip, pseudo }) {
  const upsertResult = await sql`
    INSERT INTO ip_pseudo_locks (ip, pseudo, updated_at)
    VALUES (${ip}, ${pseudo}, NOW())
    ON CONFLICT (ip) DO UPDATE
      SET updated_at = NOW()
    WHERE ip_pseudo_locks.pseudo = EXCLUDED.pseudo
    RETURNING pseudo
  `;

  if (Array.isArray(upsertResult) && upsertResult.length > 0) {
    return { ok: true };
  }

  const existing = await sql`
    SELECT pseudo
    FROM ip_pseudo_locks
    WHERE ip = ${ip}
    LIMIT 1
  `;
  return {
    ok: false,
    pseudo: existing[0]?.pseudo ?? null,
  };
}
