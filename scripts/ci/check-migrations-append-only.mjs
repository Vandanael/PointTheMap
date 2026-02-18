import { execSync } from 'node:child_process';

const MIGRATIONS_DIR = 'netlify/database/migrations';
const FILE_PATTERN = /^netlify\/database\/migrations\/(\d{3})_[a-z0-9_]+\.sql$/;

const run = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/**
 * @param {string} msg
 */
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

let hasBaseRef = true;
try {
  run('git rev-parse --verify origin/main');
} catch {
  hasBaseRef = false;
}

const isStrictLocal = process.env.CHECK_MIGRATIONS_STRICT === '1';
if (!process.env.CI && !isStrictLocal) {
  console.warn('Skipping append-only migration history check locally (enforced in CI).');
  process.exit(0);
}

if (!hasBaseRef) {
  if (process.env.CI) {
    fail('Missing origin/main ref in CI. Ensure checkout uses fetch-depth: 0.');
  }
  fail('Missing origin/main ref. Run `git fetch origin main` before strict migration checks.');
}

let rawDiff = '';
try {
  rawDiff = run(`git diff --name-status --find-renames origin/main...HEAD -- ${MIGRATIONS_DIR}`);
} catch {
  rawDiff = '';
}

if (!rawDiff) {
  console.log('Migration append-only check OK (no migration file changes detected).');
  process.exit(0);
}

const lines = rawDiff
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

/** @type {Array<{status: string, path: string}>} */
const changes = [];
for (const line of lines) {
  const parts = line.split('\t');
  const status = parts[0];
  if (status.startsWith('R')) {
    changes.push({ status: 'R', path: parts[2] || '' });
    continue;
  }
  changes.push({ status, path: parts[1] || '' });
}

const forbidden = changes.filter((change) => change.status !== 'A');
if (forbidden.length > 0) {
  const formatted = forbidden.map((c) => `- ${c.status}\t${c.path}`).join('\n');
  fail(
    `Historical migration edits are not allowed (append-only policy).\nForbidden changes:\n${formatted}`
  );
}

for (const change of changes) {
  if (!FILE_PATTERN.test(change.path)) {
    fail(`New migration filename does not match convention (NNN_description.sql): ${change.path}`);
  }
}

const baseFilesRaw = run(`git ls-tree -r --name-only origin/main ${MIGRATIONS_DIR}`);
const baseFiles = baseFilesRaw
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => FILE_PATTERN.test(line));

const toPrefix = (path) => Number.parseInt(path.match(FILE_PATTERN)?.[1] || '0', 10);
const maxBasePrefix = baseFiles.length > 0 ? Math.max(...baseFiles.map(toPrefix)) : 0;

const added = changes.map((change) => change.path);
for (const path of added) {
  const prefix = toPrefix(path);
  if (prefix <= maxBasePrefix) {
    fail(
      `New migration prefix must be greater than existing max (${String(maxBasePrefix).padStart(3, '0')}): ${path}`
    );
  }
}

console.log(`Migration append-only check OK (${added.length} new migration file(s)).`);
