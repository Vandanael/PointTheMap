import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const FUNCTIONS_DIR = join(ROOT, 'netlify/functions');

/** @param {string} dir */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (st.isFile() && full.endsWith('.js')) out.push(full);
  }
  return out;
}

const offenders = [];
for (const file of walk(FUNCTIONS_DIR)) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes("'../../src/") || line.includes('"../../src/') || line.includes("'../src/") || line.includes('"../src/')) {
      offenders.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
    }
  }
}

if (offenders.length > 0) {
  console.error('Import boundary violation: netlify/functions must not import src/*');
  for (const offender of offenders) {
    console.error(`- ${offender}`);
  }
  process.exit(1);
}

console.log('Import boundaries OK for netlify/functions');
