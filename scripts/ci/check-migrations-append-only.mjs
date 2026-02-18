import { execSync } from 'node:child_process';

const MIGRATIONS_DIR = 'netlify/database/migrations';
const FILE_PATTERN = /^netlify\/database\/migrations\/(\d{3})_[a-z0-9_]+\.sql$/;
const LEGACY_ALLOWED_RENAMES = new Map([
  [
    'netlify/database/migrations/001_add_csrf_token.sql',
    'netlify/database/migrations/002_add_csrf_token.sql',
  ],
  [
    'netlify/database/migrations/002_add_game_type_varchar20.sql',
    'netlify/database/migrations/003_add_game_type_varchar20.sql',
  ],
  [
    'netlify/database/migrations/002_add_player_tokens.sql',
    'netlify/database/migrations/004_add_player_tokens.sql',
  ],
  [
    'netlify/database/migrations/003_add_error_logs.sql',
    'netlify/database/migrations/005_add_error_logs.sql',
  ],
  [
    'netlify/database/migrations/004_rename_sessions_capitals_to_targets.sql',
    'netlify/database/migrations/006_rename_sessions_capitals_to_targets.sql',
  ],
  [
    'netlify/database/migrations/005_add_session_token_to_scores.sql',
    'netlify/database/migrations/007_add_session_token_to_scores.sql',
  ],
]);

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

/** @type {Array<{status: string, path: string, oldPath?: string}>} */
const changes = [];
for (const line of lines) {
  const parts = line.split('\t');
  const status = parts[0];
  if (status.startsWith('R')) {
    changes.push({ status: 'R', oldPath: parts[1] || '', path: parts[2] || '' });
    continue;
  }
  changes.push({ status, path: parts[1] || '' });
}

const isAllowedLegacyRename = (change) =>
  change.status === 'R' &&
  typeof change.oldPath === 'string' &&
  LEGACY_ALLOWED_RENAMES.get(change.oldPath) === change.path;

const forbidden = changes.filter(
  (change) => change.status !== 'A' && !isAllowedLegacyRename(change)
);
if (forbidden.length > 0) {
  const formatted = forbidden
    .map((c) => (c.status === 'R' ? `- R\t${c.oldPath}\t${c.path}` : `- ${c.status}\t${c.path}`))
    .join('\n');
  fail(
    `Historical migration edits are not allowed (append-only policy).\nForbidden changes:\n${formatted}`
  );
}

for (const change of changes) {
  if (!FILE_PATTERN.test(change.path)) {
    fail(`New migration filename does not match convention (NNN_description.sql): ${change.path}`);
  }
}

for (const change of changes.filter((c) => c.status === 'R')) {
  if (!isAllowedLegacyRename(change)) {
    continue;
  }
  if (!FILE_PATTERN.test(change.oldPath || '')) {
    fail(`Legacy migration rename old path is invalid: ${change.oldPath}`);
  }
}

const baseFilesRaw = run(`git ls-tree -r --name-only origin/main ${MIGRATIONS_DIR}`);
const baseFiles = baseFilesRaw
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => FILE_PATTERN.test(line));

const toPrefix = (path) => Number.parseInt(path.match(FILE_PATTERN)?.[1] || '0', 10);
const maxBasePrefix = baseFiles.length > 0 ? Math.max(...baseFiles.map(toPrefix)) : 0;

const added = changes.filter((change) => change.status === 'A').map((change) => change.path);
for (const path of added) {
  const prefix = toPrefix(path);
  if (prefix <= maxBasePrefix) {
    fail(
      `New migration prefix must be greater than existing max (${String(maxBasePrefix).padStart(3, '0')}): ${path}`
    );
  }
}

const acceptedLegacyRenames = changes.filter((change) => isAllowedLegacyRename(change)).length;
if (acceptedLegacyRenames > 0) {
  console.log(
    `Accepted ${acceptedLegacyRenames} approved legacy migration rename(s) during numbering cleanup.`
  );
}

console.log(`Migration append-only check OK (${added.length} new migration file(s)).`);
