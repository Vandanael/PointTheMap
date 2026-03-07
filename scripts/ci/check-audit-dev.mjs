import { execSync } from 'node:child_process';

const ALLOWED_PACKAGES = new Set(['ajv', 'eslint', '@eslint-community/eslint-utils']);

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
  if (!ALLOWED_PACKAGES.has(key)) {
    fail(`Unexpected vulnerability package in audit report: ${key}`);
  }
}

console.log(`Audit CI strict check OK (only allowed dev-toolchain packages: ${keys.join(', ')}).`);
