import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = [join(ROOT, 'src'), join(ROOT, 'lib')];
const DISALLOWED_PATTERNS = [/\bstate\.capitals\b/, /\bsession\.capitals\b/];
const DISALLOWED_FILES = [
  join(ROOT, 'src', 'config', 'index.js'),
  join(ROOT, 'src', 'config', 'features.js'),
  join(ROOT, 'src', 'config', 'visual-constants.js'),
  join(ROOT, 'src', 'lib', 'session', 'sessionModel.js'),
];

/** @param {string} dir */
function walk(dir) {
  /** @type {string[]} */
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...walk(full));
    } else if (st.isFile() && full.endsWith('.js') && !full.endsWith('.test.js')) {
      files.push(full);
    }
  }
  return files;
}

const offenders = [];
for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      for (const pattern of DISALLOWED_PATTERNS) {
        if (pattern.test(line)) {
          offenders.push(`${relative(ROOT, file)}:${index + 1}: ${line.trim()}`);
        }
      }
    });
  }
}

for (const file of DISALLOWED_FILES) {
  try {
    const st = statSync(file);
    if (st.isFile()) {
      offenders.push(`${relative(ROOT, file)}: legacy shim file must not exist`);
    }
  } catch {
    // expected when removed
  }
}

if (offenders.length > 0) {
  console.error(
    'Legacy targets guard failed: do not use state.capitals/session.capitals in runtime code.'
  );
  for (const offender of offenders) {
    console.error(`- ${offender}`);
  }
  process.exit(1);
}

console.log('Legacy targets guard OK');
