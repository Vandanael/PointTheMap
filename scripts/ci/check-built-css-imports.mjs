import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const distAssets = join(process.cwd(), 'dist', 'assets');

const cssFiles = [];
for (const name of readdirSync(distAssets)) {
  const full = join(distAssets, name);
  const st = statSync(full);
  if (st.isFile() && name.endsWith('.css')) cssFiles.push(full);
}

const offenders = [];
for (const file of cssFiles) {
  const content = readFileSync(file, 'utf8');
  if (/^\s*@import\s+/m.test(content)) offenders.push(file);
}

if (offenders.length > 0) {
  console.error('Found unresolved CSS @import directives in built assets:');
  offenders.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log(`Built CSS import check OK (${cssFiles.length} files)`);
