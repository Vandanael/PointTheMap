import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();

/**
 * @typedef {{ maxLines: number, prefix: string, exemptions?: string[] }} Rule
 */

/** @type {Rule[]} */
const RULES = [
  {
    prefix: 'src/ui/screens/',
    maxLines: 300,
  },
  {
    prefix: 'netlify/functions/submit.js',
    maxLines: 700,
  },
];

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  /** @type {string[]} */
  const out = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
        continue;
      }
      out.push(...walk(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(relative(ROOT, full));
    }
  }
  return out;
}

/**
 * @param {string} file
 * @returns {number}
 */
function lineCount(file) {
  const content = readFileSync(join(ROOT, file), 'utf8');
  if (!content) return 0;
  return content.split('\n').length;
}

const files = walk(ROOT);
/** @type {string[]} */
const errors = [];
/** @type {string[]} */
const warnings = [];

for (const rule of RULES) {
  const matched = files.filter((f) =>
    rule.prefix.endsWith('.js') ? f === rule.prefix : f.startsWith(rule.prefix)
  );

  for (const file of matched) {
    const lines = lineCount(file);
    if (lines <= rule.maxLines) continue;

    if (rule.exemptions?.includes(file)) {
      warnings.push(
        `WARN ${file}: ${lines} lines (limit ${rule.maxLines}) - temporary exemption active`
      );
      continue;
    }

    errors.push(`FAIL ${file}: ${lines} lines (limit ${rule.maxLines})`);
  }
}

if (warnings.length > 0) {
  console.log('File size governance warnings:');
  for (const warning of warnings) console.log(warning);
}

if (errors.length > 0) {
  console.error('File size governance failures:');
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log('File size governance check OK');
