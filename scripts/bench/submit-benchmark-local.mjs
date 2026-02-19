import { performance } from 'node:perf_hooks';

process.env.NODE_ENV = 'development';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
process.env.CONTEXT = 'dev';
process.env.NETLIFY_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'bench-secret';
process.env.E2E_BYPASS_ENABLED = '1';
process.env.E2E_BYPASS_TOKEN = process.env.E2E_BYPASS_TOKEN || 'BENCH_BYPASS_TOKEN';
process.env.SESSION_CLEANUP_SAMPLE_RATE = process.env.SESSION_CLEANUP_SAMPLE_RATE || '1';
process.env.SESSION_CLEANUP_INTERVAL_MS = process.env.SESSION_CLEANUP_INTERVAL_MS || '1';

const args = new Map(
  process.argv.slice(2).map((entry) => {
    const [k, ...rest] = entry.split('=');
    return [k, rest.join('=')];
  })
);

const runs = Number.parseInt(args.get('--runs') || process.env.BENCH_RUNS || '100', 10);
if (!Number.isFinite(runs) || runs <= 0) throw new Error(`Invalid runs value: ${runs}`);

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
};

const createSql = () => {
  const state = {
    sessions: new Map(),
    scores: [],
    rateLimits: new Map(),
    ipPseudoLocks: new Map(),
    cleanupRuns: 0,
  };

  const normalize = (raw) => raw.replace(/\s+/g, ' ').trim().toLowerCase();

  const execute = async (query, values) => {
    if (query.startsWith('delete from sessions where expires_at <= now()')) {
      state.cleanupRuns += 1;
      return [];
    }

    if (query.startsWith('insert into sessions')) {
      const [token, targetsJson, startTime, gameType, expiresAt, csrfToken, playerId] = values;
      const targets = JSON.parse(String(targetsJson));
      state.sessions.set(token, {
        token,
        targets,
        startTime: Number(startTime) - 120_000,
        used: false,
        gameType,
        expiresAt,
        csrfToken,
        playerId: playerId ?? null,
      });
      return [];
    }

    if (query.startsWith('delete from rate_limits where expires_at < now()')) return [];

    if (query.startsWith('insert into rate_limits')) {
      const key = values[0];
      const prev = state.rateLimits.get(key) || { count: 0 };
      const next = { count: prev.count + 1 };
      state.rateLimits.set(key, next);
      return [{ count: next.count }];
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

    if (query.startsWith('update players')) return [];
    if (query.startsWith('delete from sessions where token =')) return [];

    return [];
  };

  const sql = (strings, ...values) => {
    const query = normalize(strings.join(' '));
    return execute(query, values);
  };

  sql.transaction = async (queries) => {
    await Promise.all(queries);
  };
  sql.__state = state;
  return sql;
};

const buildRoundsFromTargets = (targets = []) =>
  targets.slice(0, 5).map((target) => ({
    capital: target.name,
    click: null,
    status: 'timeout',
    score: 0,
  }));

const { default: startHandler } = await import('../../netlify/functions/start.js');
const { default: submitHandler } = await import('../../netlify/functions/submit.js');
const { __testOnlyResetSessionCleanupState } = await import('../../netlify/functions/_session-cleanup.js');

__testOnlyResetSessionCleanupState();
const sql = createSql();

const durations = [];
const statuses = [];

for (let i = 0; i < runs; i += 1) {
  const startReq = new Request('http://local/.netlify/functions/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gameType: 'classic' }),
  });
  const startRes = await startHandler(startReq, { sql, ip: '127.0.0.1' });
  if (startRes.status !== 200) throw new Error(`Start failed on run ${i + 1}: ${startRes.status}`);
  const startPayload = await startRes.json();
  const token = startPayload?.data?.token;
  const csrfToken = startPayload?.data?.csrfToken;
  const targets = startPayload?.data?.targets || [];
  if (!token || !csrfToken) throw new Error(`Missing token/csrf on run ${i + 1}`);

  const submitReq = new Request('http://local/.netlify/functions/submit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
      'x-e2e-bypass': process.env.E2E_BYPASS_TOKEN,
    },
    body: JSON.stringify({
      token,
      pseudo: 'AAAAA',
      gameType: 'classic',
      payloadVersion: 1,
      rounds: buildRoundsFromTargets(targets),
    }),
  });

  const t0 = performance.now();
  const submitRes = await submitHandler(submitReq, { sql, ip: '127.0.0.1' });
  const elapsed = performance.now() - t0;
  if (submitRes.status !== 200) {
    const failureBody = await submitRes.text();
    throw new Error(`Submit failed on run ${i + 1}: ${submitRes.status} body=${failureBody}`);
  }
  durations.push(elapsed);
  statuses.push(submitRes.status);
}

const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
const cleanupRuns = sql.__state.cleanupRuns;

console.log(
  JSON.stringify(
    {
      mode: 'local-inprocess',
      runs,
      statuses,
      metricsMs: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        avg,
        p50: percentile(durations, 50),
        p95: percentile(durations, 95),
      },
      cleanup: {
        totalExecutions: cleanupRuns,
        executionsPerRequest: cleanupRuns / (runs * 2),
      },
    },
    null,
    2
  )
);
