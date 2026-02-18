import { execSync } from 'node:child_process';

const ALLOWED_KEYS = new Set(['ajv', 'eslint', '@eslint-community/eslint-utils']);
const ALLOWED_GHSA = 'GHSA-2g4f-4pwh-qvx6';

/**
 * @param {string} message
 */
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

let report;
try {
  const raw = execSync('npm audit --json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  report = JSON.parse(raw);
} catch (error) {
  const out = error?.stdout ? String(error.stdout) : '';
  if (!out) {
    fail(`Failed to run npm audit: ${String(error)}`);
  }
  report = JSON.parse(out);
}

const metadata = report?.metadata?.vulnerabilities || {};
if ((metadata.high || 0) > 0 || (metadata.critical || 0) > 0) {
  fail(`Security audit failed: high=${metadata.high || 0}, critical=${metadata.critical || 0}.`);
}

const vulnerabilities = report?.vulnerabilities || {};
const keys = Object.keys(vulnerabilities);
if (keys.length === 0) {
  console.log('Audit CI strict check OK (0 vulnerabilities).');
  process.exit(0);
}

for (const key of keys) {
  if (!ALLOWED_KEYS.has(key)) {
    fail(`Unexpected vulnerability package in audit report: ${key}`);
  }
}

const ajv = vulnerabilities.ajv;
if (!ajv) {
  fail('Expected ajv advisory missing; audit shape changed.');
}

const hasOnlyExpectedGhsa = Array.isArray(ajv.via)
  ? ajv.via.every(
      (entry) => typeof entry !== 'string' && String(entry.url || '').includes(ALLOWED_GHSA)
    )
  : false;
if (!hasOnlyExpectedGhsa) {
  fail(`Unexpected ajv advisory details; expected only ${ALLOWED_GHSA}.`);
}

const ajvNodes = Array.isArray(ajv.nodes) ? ajv.nodes : [];
if (
  ajvNodes.length === 0 ||
  !ajvNodes.every((node) => node === 'node_modules/eslint/node_modules/ajv')
) {
  fail(`Unexpected ajv node path(s): ${ajvNodes.join(', ') || '(none)'}`);
}

const eslint = vulnerabilities.eslint;
if (!eslint || eslint.isDirect !== true) {
  fail('Expected direct eslint advisory missing or malformed.');
}

const eslintUtils = vulnerabilities['@eslint-community/eslint-utils'];
if (!eslintUtils) {
  fail('Expected @eslint-community/eslint-utils advisory missing.');
}

console.log(`Audit CI strict check OK (only expected ${ALLOWED_GHSA} via eslint toolchain).`);
