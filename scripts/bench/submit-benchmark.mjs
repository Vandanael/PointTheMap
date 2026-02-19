import { performance } from 'node:perf_hooks';

const args = new Map(
  process.argv.slice(2).map((entry) => {
    const [k, ...rest] = entry.split('=');
    return [k, rest.join('=')];
  })
);

const baseUrl = args.get('--base-url') || process.env.BENCH_BASE_URL || 'http://127.0.0.1:8888';
const runs = Number.parseInt(args.get('--runs') || process.env.BENCH_RUNS || '20', 10);

if (!Number.isFinite(runs) || runs <= 0) {
  throw new Error(`Invalid runs value: ${runs}`);
}

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
};

const buildRoundsFromTargets = (targets = []) =>
  targets.slice(0, 5).map((target) => ({
    capital: target.name,
    click: null,
    status: 'timeout',
    score: 0,
  }));

const headers = { 'content-type': 'application/json' };
const durations = [];
const statuses = [];

for (let i = 0; i < runs; i += 1) {
  const pseudo = `BM${String(i).padStart(3, '0')}`.slice(0, 5);

  const startResp = await fetch(`${baseUrl}/.netlify/functions/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ gameType: 'classic' }),
  });

  if (!startResp.ok) {
    throw new Error(`Start failed on run ${i + 1}: ${startResp.status}`);
  }

  const startJson = await startResp.json();
  const token = startJson?.data?.token;
  const csrfToken = startJson?.data?.csrfToken;
  const targets = startJson?.data?.targets || [];
  if (!token || !csrfToken) throw new Error(`Missing session token/csrf on run ${i + 1}`);

  const submitBody = {
    token,
    pseudo,
    gameType: 'classic',
    payloadVersion: 1,
    rounds: buildRoundsFromTargets(targets),
  };

  const t0 = performance.now();
  const submitResp = await fetch(`${baseUrl}/.netlify/functions/submit`, {
    method: 'POST',
    headers: { ...headers, 'x-csrf-token': csrfToken },
    body: JSON.stringify(submitBody),
  });
  const elapsed = performance.now() - t0;

  durations.push(elapsed);
  statuses.push(submitResp.status);
}

const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
console.log(
  JSON.stringify(
    {
      baseUrl,
      runs,
      statuses,
      metricsMs: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        avg,
        p50: percentile(durations, 50),
        p95: percentile(durations, 95),
      },
    },
    null,
    2
  )
);
