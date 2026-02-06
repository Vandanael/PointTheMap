import { readFileSync, statSync } from 'fs';
import { resolve } from 'path';

const files = ['countries.geojson', 'civilizations.geojson'];
const dataDir = resolve(process.cwd(), 'public', 'data');

const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(2);

for (const file of files) {
  const path = resolve(dataDir, file);
  const stats = statSync(path);
  const raw = readFileSync(path, 'utf-8');
  let featureCount = 'unknown';
  try {
    const parsed = JSON.parse(raw);
    featureCount = Array.isArray(parsed.features) ? parsed.features.length : 'unknown';
  } catch {
    featureCount = 'invalid-json';
  }
  console.log(`${file}: ${mb(stats.size)} MB (features: ${featureCount})`);
}
