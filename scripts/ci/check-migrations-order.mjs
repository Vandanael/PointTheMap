import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const migrationsDir = join(process.cwd(), 'netlify', 'database', 'migrations');
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('No SQL migration files found in netlify/database/migrations');
  process.exit(1);
}

const pattern = /^(\d{3})_[a-z0-9_]+\.sql$/;
const parsed = [];

for (const file of files) {
  const match = pattern.exec(file);
  if (!match) {
    console.error(`Invalid migration filename: ${file}`);
    console.error('Expected format: NNN_description.sql (lowercase, 3-digit prefix)');
    process.exit(1);
  }
  parsed.push({ file, prefix: Number.parseInt(match[1], 10) });
}

for (let i = 1; i < parsed.length; i += 1) {
  if (parsed[i].prefix <= parsed[i - 1].prefix) {
    console.error(
      `Migration order error: ${parsed[i - 1].file} then ${parsed[i].file} (prefix not strictly increasing)`
    );
    process.exit(1);
  }
}

const prefixes = new Set(parsed.map((entry) => entry.prefix));
if (prefixes.size !== parsed.length) {
  console.error('Duplicate migration prefix detected');
  process.exit(1);
}

const expectedStart = 1;
const expectedEnd = expectedStart + parsed.length - 1;
for (let expected = expectedStart; expected <= expectedEnd; expected += 1) {
  if (!prefixes.has(expected)) {
    console.error(`Missing migration prefix: ${String(expected).padStart(3, '0')}`);
    process.exit(1);
  }
}

console.log(`Migration naming/order OK (${parsed.length} files)`);
