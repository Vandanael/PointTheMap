#!/usr/bin/env node

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'synthetic-check-secret';
}

/** @param {string} method */
const makeReq = (method) => ({
  method,
  headers: {
    get() {
      return null;
    },
  },
  json: async () => ({}),
});

/**
 * @param {string} label
 * @param {number} expected
 * @param {number} actual
 */
const assertStatus = (label, expected, actual) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected status ${expected}, got ${actual}`);
  }
};

const checks = [];

const { default: submit } = await import('../../netlify/functions/submit.js');
checks.push(['submit GET', 405, (await submit(makeReq('GET'), {})).status]);

const { default: start } = await import('../../netlify/functions/start.js');
checks.push(['start GET', 405, (await start(makeReq('GET'), {})).status]);

const { default: errorReport } = await import('../../netlify/functions/error-report.js');
checks.push(['error-report GET', 405, (await errorReport(makeReq('GET'), {})).status]);

const { default: cleanupPseudoLocks } =
  await import('../../netlify/functions/cleanup-pseudo-locks.js');
checks.push([
  'cleanup-pseudo-locks GET',
  405,
  (await cleanupPseudoLocks(makeReq('GET'), {})).status,
]);

const { default: cleanupErrorLogs } = await import('../../netlify/functions/cleanup-error-logs.js');
checks.push(['cleanup-error-logs GET', 405, (await cleanupErrorLogs(makeReq('GET'), {})).status]);

const { default: tokenHandler } = await import('../../netlify/functions/generate-player-token.js');
checks.push([
  'generate-player-token POST without DB',
  503,
  (await tokenHandler(makeReq('POST'), {})).status,
]);

for (const [label, expected, actual] of checks) {
  assertStatus(label, expected, actual);
}

console.log(`Synthetic checks OK (${checks.length} checks)`);
