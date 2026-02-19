import { readFileSync } from 'fs';

const args = new Map(
  process.argv.slice(2).map((entry) => {
    const [k, ...rest] = entry.split('=');
    return [k, rest.join('=')];
  })
);

const beforePath = args.get('--before');
const afterPath = args.get('--after');
const maxPctRaw = Number.parseFloat(args.get('--max-pct') || '20');
const maxAbsRaw = Number.parseFloat(args.get('--max-abs-ms') || '200');

if (!beforePath || !afterPath) {
  console.error('Usage: node scripts/bench/compare-submit-benchmark.mjs --before=before.json --after=after.json [--max-pct=20] [--max-abs-ms=200]');
  process.exit(1);
}

const before = JSON.parse(readFileSync(beforePath, 'utf8'));
const after = JSON.parse(readFileSync(afterPath, 'utf8'));

const p95Before = Number(before?.metricsMs?.p95);
const p95After = Number(after?.metricsMs?.p95);
if (!Number.isFinite(p95Before) || !Number.isFinite(p95After)) {
  console.error('Invalid benchmark files: expected metricsMs.p95 in both JSON files');
  process.exit(1);
}

const deltaMs = p95After - p95Before;
const deltaPct = p95Before > 0 ? (deltaMs / p95Before) * 100 : 0;
const pctLimitMs = p95Before * (maxPctRaw / 100);
const strictLimitMs = Math.min(pctLimitMs, maxAbsRaw);
const pass = deltaMs <= strictLimitMs;

const summary = {
  p95Before,
  p95After,
  deltaMs,
  deltaPct,
  limits: {
    maxPct: maxPctRaw,
    maxAbsMs: maxAbsRaw,
    strictLimitMs,
  },
  pass,
};

console.log(JSON.stringify(summary, null, 2));

if (!pass) {
  console.error(
    `p95 regression too high: +${deltaMs.toFixed(2)}ms (${deltaPct.toFixed(2)}%), limit ${strictLimitMs.toFixed(2)}ms`
  );
  process.exit(1);
}
