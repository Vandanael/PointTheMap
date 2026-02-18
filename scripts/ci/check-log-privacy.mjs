import { readFileSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const TARGETS = ['netlify/functions/submit.js', 'netlify/functions/start.js', 'netlify/functions/error-report.js'];

const offenders = [];

const SENSITIVE_RE = /\b(pseudo|token|csrf|rounds|click|authorization)\b/i;
const REDACTION_RE = /(redactForLog|redactToken|\[redacted\])/;

for (const relPath of TARGETS) {
  const fullPath = join(ROOT, relPath);
  let content = '';
  try {
    content = readFileSync(fullPath, 'utf8');
  } catch {
    continue;
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.includes('logger.')) continue;
    if (!/logger\.(debug|info|log|warn|error)\(/.test(line)) continue;
    if (REDACTION_RE.test(line)) continue;
    const withoutStrings = line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '');
    if (!SENSITIVE_RE.test(withoutStrings)) continue;
    offenders.push(`${relative(ROOT, fullPath)}:${i + 1}: ${line.trim().slice(0, 180)}`);
  }
}

if (offenders.length > 0) {
  console.error('Log privacy check failed: sensitive logger payload without explicit redaction marker.');
  for (const offender of offenders) console.error(`- ${offender}`);
  process.exit(1);
}

console.log('Log privacy check OK');
