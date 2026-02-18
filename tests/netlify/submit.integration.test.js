import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const E2E_HEADER = 'x-e2e-bypass';
const E2E_TOKEN = 'test-bypass-token';

/**
 * @typedef {{
 *   token: string,
 *   targets: Array<Record<string, any>>,
 *   startTime: number,
 *   used: boolean,
 *   gameType: string,
 *   expiresAt: Date,
 *   csrfToken: string,
 *   playerId: string | null
 * }} SessionRow
 */

/**
 * @param {{ token: string, pseudo: string, gameType?: string }} params
 */
const buildSubmitBody = ({ token, pseudo, gameType = 'classic' }) => {
  const targets = ['Paris', 'London', 'Berlin', 'Rome', 'Madrid'];
  return {
    token,
    pseudo,
    gameType,
    payloadVersion: 1,
    rounds: targets.map((name) => ({
      capital: name,
      click: null,
      status: 'timeout',
      score: 0,
    })),
  };
};

/**
 * @param {{ token: string, pseudo: string, gameType?: string }} params
 */
const buildCountrySubmitBody = ({ token, pseudo, gameType = 'country' }) => {
  const targets = [
    { name: 'France', countryId: 'FRA' },
    { name: 'Germany', countryId: 'DEU' },
    { name: 'Spain', countryId: 'ESP' },
    { name: 'Italy', countryId: 'ITA' },
    { name: 'Portugal', countryId: 'PRT' },
  ];
  return {
    token,
    pseudo,
    gameType,
    payloadVersion: 1,
    rounds: targets.map((target) => ({
      country: target.name,
      countryId: target.countryId,
      click: null,
      status: 'timeout',
      score: 0,
    })),
  };
};

/**
 * @param {{ token: string, pseudo: string, gameType?: string }} params
 */
const buildCivilizationSubmitBody = ({ token, pseudo, gameType = 'civilization' }) => {
  const targets = [
    { name: 'Roman Empire', id: 'rome' },
    { name: 'Mongol Empire', id: 'mongol' },
    { name: 'Ottoman Empire', id: 'ottoman' },
    { name: 'Aztec Empire', id: 'aztec' },
    { name: 'Inca Empire', id: 'inca' },
  ];
  return {
    token,
    pseudo,
    gameType,
    payloadVersion: 1,
    rounds: targets.map((target) => ({
      civilization: target.name,
      civilizationId: target.id,
      click: null,
      status: 'timeout',
      score: 0,
    })),
  };
};

/**
 * @param {{ token: string, gameType?: string, csrfToken?: string, used?: boolean }} params
 * @returns {SessionRow}
 */
const buildSession = ({ token, gameType = 'classic', csrfToken = 'csrf-token', used = false }) => ({
  token,
  targets: [
    { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
    { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
    { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405 },
    { name: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964 },
    { name: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038 },
  ],
  startTime: Date.now() - 90_000,
  used,
  gameType,
  expiresAt: new Date(Date.now() + 60_000),
  csrfToken,
  playerId: null,
});

/**
 * @param {{ token: string, gameType?: string, csrfToken?: string, used?: boolean }} params
 * @returns {SessionRow}
 */
const buildCountrySession = ({
  token,
  gameType = 'country',
  csrfToken = 'csrf-token',
  used = false,
}) => ({
  token,
  targets: [
    { name: 'France', countryId: 'FRA', popular: true },
    { name: 'Germany', countryId: 'DEU', popular: true },
    { name: 'Spain', countryId: 'ESP', popular: true },
    { name: 'Italy', countryId: 'ITA', popular: true },
    { name: 'Portugal', countryId: 'PRT', popular: true },
  ],
  startTime: Date.now() - 90_000,
  used,
  gameType,
  expiresAt: new Date(Date.now() + 60_000),
  csrfToken,
  playerId: null,
});

/**
 * @param {{ token: string, gameType?: string, csrfToken?: string, used?: boolean }} params
 * @returns {SessionRow}
 */
const buildCivilizationSession = ({
  token,
  gameType = 'civilization',
  csrfToken = 'csrf-token',
  used = false,
}) => ({
  token,
  targets: [
    { name: 'Roman Empire', id: 'rome', popular: true },
    { name: 'Mongol Empire', id: 'mongol', popular: true },
    { name: 'Ottoman Empire', id: 'ottoman', popular: true },
    { name: 'Aztec Empire', id: 'aztec', popular: false },
    { name: 'Inca Empire', id: 'inca', popular: false },
  ],
  startTime: Date.now() - 90_000,
  used,
  gameType,
  expiresAt: new Date(Date.now() + 60_000),
  csrfToken,
  playerId: null,
});

/**
 * @param {{
 *   sessions?: SessionRow[],
 *   failOnInsertScore?: boolean
 * }} [options]
 */
const createFakeSql = (options = {}) => {
  const state = {
    sessions: new Map((options.sessions || []).map((s) => [s.token, structuredClone(s)])),
    scores: [],
    players: new Map(),
    rateLimits: new Map(),
    ipPseudoLocks: new Map(),
  };

  /**
   * @param {string} raw
   */
  const normalize = (raw) => raw.replace(/\s+/g, ' ').trim().toLowerCase();

  /**
   * @param {string} query
   * @param {any[]} values
   */
  const execute = async (query, values) => {
    if (query.startsWith('delete from rate_limits where expires_at < now()')) {
      return [];
    }

    if (query.startsWith('insert into rate_limits')) {
      const key = values[0];
      const prev = state.rateLimits.get(key) || { count: 0 };
      const next = { count: prev.count + 1, expiresAt: values[1] };
      state.rateLimits.set(key, next);
      return [{ count: next.count }];
    }

    if (query.includes('from scores') && query.includes('where session_token =')) {
      const token = values[0];
      const existing = [...state.scores]
        .filter((score) => score.sessionToken === token)
        .sort((a, b) => b.id - a.id)[0];
      if (!existing) return [];
      return [
        {
          score: existing.score,
          time: existing.time,
          rounds: existing.rounds,
          game_type: existing.gameType,
        },
      ];
    }

    if (query.includes('from sessions') && query.includes('where token =')) {
      const token = values[0];
      const session = state.sessions.get(token);
      if (!session) return [];
      if (session.expiresAt <= new Date()) return [];
      return [
        {
          token: session.token,
          targets: session.targets,
          start_time: String(session.startTime),
          used: session.used,
          game_type: session.gameType,
          expires_at: session.expiresAt,
          csrf_token: session.csrfToken,
          player_id: session.playerId,
        },
      ];
    }

    if (query.startsWith('insert into ip_pseudo_locks')) {
      const [ip, pseudo, ttlHours] = values;
      const existing = state.ipPseudoLocks.get(ip);
      const now = Date.now();
      const ttlMs = (Number(ttlHours) || 0) * 60 * 60 * 1000;
      const isExpired = existing ? now - existing.updatedAtMs > ttlMs : false;
      if (!existing || existing.pseudo === pseudo || isExpired) {
        const next = { pseudo, updatedAtMs: now };
        state.ipPseudoLocks.set(ip, next);
        return [{ pseudo: next.pseudo, updated_at: new Date(next.updatedAtMs).toISOString() }];
      }
      return [];
    }

    if (query.includes('from ip_pseudo_locks') && query.includes('where ip =')) {
      const ip = values[0];
      const lock = state.ipPseudoLocks.get(ip);
      return lock
        ? [{ pseudo: lock.pseudo, updated_at: new Date(lock.updatedAtMs).toISOString() }]
        : [];
    }

    if (query.startsWith('update sessions set used = true where token =')) {
      const token = values[0];
      const session = state.sessions.get(token);
      if (session && !session.used) session.used = true;
      return [];
    }

    if (query.startsWith('insert into scores')) {
      if (options.failOnInsertScore) {
        throw new Error('forced_insert_failure');
      }
      const [pseudo, score, time, rounds, timestamp, gameType, sessionToken, ip, playerId] = values;
      const duplicate = state.scores.some((existing) => existing.sessionToken === sessionToken);
      if (duplicate) {
        const err = /** @type {Error & { code?: string }} */ (new Error('duplicate key value'));
        err.code = '23505';
        throw err;
      }
      state.scores.push({
        id: state.scores.length + 1,
        pseudo,
        score,
        time,
        rounds,
        timestamp,
        gameType,
        sessionToken,
        ip,
        playerId,
      });
      return [];
    }

    if (query.startsWith('update players')) {
      return [];
    }

    if (query.startsWith('delete from sessions where token =')) {
      const token = values[0];
      state.sessions.delete(token);
      return [];
    }

    if (query.startsWith('select count(*) + 1 as rank from scores')) {
      const [gameType, totalScore, gameDuration] = values;
      let better = 0;
      for (const score of state.scores) {
        if (score.gameType !== gameType) continue;
        if (score.score > totalScore || (score.score === totalScore && score.time < gameDuration)) {
          better += 1;
        }
      }
      return [{ rank: String(better + 1) }];
    }

    return [];
  };

  const sql = (strings, ...values) => {
    const query = normalize(strings.join(' '));
    return {
      query,
      values,
      run: () => execute(query, values),
      then(resolve, reject) {
        return execute(query, values).then(resolve, reject);
      },
    };
  };

  sql.transaction = async (queries) => {
    const snapshot = structuredClone({
      sessions: Array.from(state.sessions.entries()),
      scores: state.scores,
      players: Array.from(state.players.entries()),
      rateLimits: Array.from(state.rateLimits.entries()),
      ipPseudoLocks: Array.from(state.ipPseudoLocks.entries()),
    });
    try {
      for (const q of queries) {
        if (q && typeof q.run === 'function') {
          await q.run();
        } else {
          await q;
        }
      }
    } catch (error) {
      state.sessions = new Map(snapshot.sessions);
      state.scores = snapshot.scores;
      state.players = new Map(snapshot.players);
      state.rateLimits = new Map(snapshot.rateLimits);
      state.ipPseudoLocks = new Map(snapshot.ipPseudoLocks);
      throw error;
    }
  };

  return { sql, state };
};

/**
 * @param {{
 *   body: any,
 *   csrfToken?: string,
 *   bypass?: boolean
 * }} params
 */
const makeRequest = ({ body, csrfToken = 'csrf-token', bypass = true }) => {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-csrf-token': csrfToken,
  });
  if (bypass) headers.set(E2E_HEADER, E2E_TOKEN);
  return new Request('http://localhost/.netlify/functions/submit', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
};

beforeEach(() => {
  process.env.E2E_BYPASS_ENABLED = '1';
  process.env.E2E_BYPASS_TOKEN = E2E_TOKEN;
});

afterEach(() => {
  delete process.env.E2E_BYPASS_ENABLED;
  delete process.env.E2E_BYPASS_TOKEN;
  vi.restoreAllMocks();
});

describe('submit integration', () => {
  it('enforces pseudo lock across concurrent submissions from same IP', async () => {
    const fake = createFakeSql({
      sessions: [buildSession({ token: 'token-A' }), buildSession({ token: 'token-B' })],
    });

    vi.resetModules();
    vi.doMock('../../netlify/functions/db.js', () => ({
      getDatabase: vi.fn(() => fake.sql),
    }));
    const { default: handler } = await import('../../netlify/functions/submit.js');

    const reqA = makeRequest({ body: buildSubmitBody({ token: 'token-A', pseudo: 'ALFA' }) });
    const reqB = makeRequest({ body: buildSubmitBody({ token: 'token-B', pseudo: 'BETA' }) });

    const [resA, resB] = await Promise.all([
      handler(reqA, { ip: '203.0.113.5' }),
      handler(reqB, { ip: '203.0.113.5' }),
    ]);
    const bodyA = await resA.json();
    const bodyB = await resB.json();

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const conflictBody = resA.status === 409 ? bodyA : bodyB;
    expect(conflictBody.error.code).toBe('pseudo_already_set_for_this_ip');
    expect(conflictBody.error.details.pseudo).toBeTypeOf('string');
    expect(conflictBody.error.details.lock).toBeTruthy();
    expect(conflictBody.error.details.lock.pseudo).toBeTypeOf('string');
    expect(conflictBody.error.details.lock.updatedAt).toBeTypeOf('string');
    expect(conflictBody.error.details.lock.expiresAt).toBeTypeOf('string');
    expect(fake.state.scores).toHaveLength(1);
  });

  it('allows lock takeover after TTL expiry', async () => {
    const fake = createFakeSql({
      sessions: [buildSession({ token: 'token-expired-lock' })],
    });
    fake.state.ipPseudoLocks.set('203.0.113.7', {
      pseudo: 'OLD',
      updatedAtMs: Date.now() - 31 * 24 * 60 * 60 * 1000,
    });

    vi.resetModules();
    vi.doMock('../../netlify/functions/db.js', () => ({
      getDatabase: vi.fn(() => fake.sql),
    }));
    const { default: handler } = await import('../../netlify/functions/submit.js');

    const req = makeRequest({
      body: buildSubmitBody({ token: 'token-expired-lock', pseudo: 'NEWW' }),
    });
    const res = await handler(req, { ip: '203.0.113.7' });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(fake.state.ipPseudoLocks.get('203.0.113.7')?.pseudo).toBe('NEWW');
  });

  it('rolls back submit transaction when score insert fails', async () => {
    const session = buildSession({ token: 'token-fail' });
    const fake = createFakeSql({
      sessions: [session],
      failOnInsertScore: true,
    });

    vi.resetModules();
    vi.doMock('../../netlify/functions/db.js', () => ({
      getDatabase: vi.fn(() => fake.sql),
    }));
    const { default: handler } = await import('../../netlify/functions/submit.js');

    const req = makeRequest({ body: buildSubmitBody({ token: 'token-fail', pseudo: 'ALFA' }) });
    const res = await handler(req, { ip: '198.51.100.7' });
    expect(res.status).toBe(500);

    const storedSession = fake.state.sessions.get('token-fail');
    expect(storedSession).toBeTruthy();
    expect(storedSession?.used).toBe(false);
    expect(fake.state.scores).toHaveLength(0);
  });

  it('returns idempotent replay when same session token is submitted again', async () => {
    const fake = createFakeSql({
      sessions: [buildSession({ token: 'token-idempotent' })],
    });

    vi.resetModules();
    vi.doMock('../../netlify/functions/db.js', () => ({
      getDatabase: vi.fn(() => fake.sql),
    }));
    const { default: handler } = await import('../../netlify/functions/submit.js');

    const first = await handler(
      makeRequest({ body: buildSubmitBody({ token: 'token-idempotent', pseudo: 'ALFA' }) }),
      { ip: '198.51.100.8' }
    );
    const second = await handler(
      makeRequest({ body: buildSubmitBody({ token: 'token-idempotent', pseudo: 'ALFA' }) }),
      { ip: '198.51.100.8' }
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.ok).toBe(true);
    expect(body.meta?.idempotentReplay).toBe(true);
    expect(fake.state.scores).toHaveLength(1);
  });

  it('rejects replay when csrf token does not match', async () => {
    const fake = createFakeSql({
      sessions: [buildSession({ token: 'token-csrf-replay' })],
    });

    vi.resetModules();
    vi.doMock('../../netlify/functions/db.js', () => ({
      getDatabase: vi.fn(() => fake.sql),
    }));
    const { default: handler } = await import('../../netlify/functions/submit.js');

    const first = await handler(
      makeRequest({ body: buildSubmitBody({ token: 'token-csrf-replay', pseudo: 'ALFA' }) }),
      { ip: '198.51.100.33' }
    );
    const second = await handler(
      makeRequest({
        body: buildSubmitBody({ token: 'token-csrf-replay', pseudo: 'ALFA' }),
        csrfToken: 'wrong-csrf-token',
      }),
      { ip: '198.51.100.33' }
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(403);
    const payload = await second.json();
    expect(payload.error.code).toBe('csrf_mismatch');
  });

  it('rejects country submission when countryId does not match session target IDs', async () => {
    const fake = createFakeSql({
      sessions: [buildCountrySession({ token: 'token-country-id-check' })],
    });

    vi.resetModules();
    vi.doMock('../../netlify/functions/db.js', () => ({
      getDatabase: vi.fn(() => fake.sql),
    }));
    const { default: handler } = await import('../../netlify/functions/submit.js');

    const body = buildCountrySubmitBody({ token: 'token-country-id-check', pseudo: 'ALFA' });
    body.rounds[0].countryId = 'BRA';
    const res = await handler(makeRequest({ body }), { ip: '198.51.100.42' });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe('invalid_rounds');
    expect(payload.error.message).toMatch(/country id mismatch/i);
  });

  it('accepts country submission when IDs match even if display names differ', async () => {
    const fake = createFakeSql({
      sessions: [buildCountrySession({ token: 'token-country-name-diff' })],
    });

    vi.resetModules();
    vi.doMock('../../netlify/functions/db.js', () => ({
      getDatabase: vi.fn(() => fake.sql),
    }));
    const { default: handler } = await import('../../netlify/functions/submit.js');

    const body = buildCountrySubmitBody({ token: 'token-country-name-diff', pseudo: 'ALFA' });
    body.rounds[0].country = 'France (localized)';
    const res = await handler(makeRequest({ body }), { ip: '198.51.100.43' });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(fake.state.scores).toHaveLength(1);
  });

  it('rejects civilization submission when civilizationId does not match session target IDs', async () => {
    const fake = createFakeSql({
      sessions: [buildCivilizationSession({ token: 'token-civ-id-check' })],
    });

    vi.resetModules();
    vi.doMock('../../netlify/functions/db.js', () => ({
      getDatabase: vi.fn(() => fake.sql),
    }));
    const { default: handler } = await import('../../netlify/functions/submit.js');

    const body = buildCivilizationSubmitBody({ token: 'token-civ-id-check', pseudo: 'ALFA' });
    body.rounds[2].civilizationId = 'wrong-id';
    const res = await handler(makeRequest({ body }), { ip: '198.51.100.44' });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe('invalid_rounds');
    expect(payload.error.message).toMatch(/civilization id mismatch/i);
  });
});
