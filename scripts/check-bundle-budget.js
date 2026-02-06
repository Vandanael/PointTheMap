import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const DIST_DIR = path.resolve('dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const DATA_DIR = path.join(DIST_DIR, 'data');
const PUBLIC_DATA_DIR = path.resolve('public', 'data');

const BUDGETS = {
  mainJsGzip: 120 * 1024,
  totalJsGzip: 250 * 1024,
  countriesGeojson: 300 * 1024,
  civilizationsGeojson: 450 * 1024,
};

const toKb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const gzipSize = (buffer) => zlib.gzipSync(buffer, { level: 9 }).length;

const listFiles = (dir, ext) => {
  if (!fs.existsSync(dir)) return [];
  /** @type {string[]} */
  const results = [];
  const walk = (current) => {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.forEach((entry) => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        return;
      }
      if (entry.isFile() && fullPath.endsWith(ext)) {
        results.push(fullPath);
      }
    });
  };
  walk(dir);
  return results;
};

const readFileSizeGzip = (filePath) => {
  const buf = fs.readFileSync(filePath);
  return gzipSize(buf);
};

const pickMainJsFile = (jsFiles) => {
  if (jsFiles.length === 0) return null;
  const preferred = jsFiles.filter((file) => {
    const base = path.basename(file).toLowerCase();
    return base.startsWith('index') || base.startsWith('main') || base.startsWith('entry');
  });
  const candidates = preferred.length > 0 ? preferred : jsFiles;
  return candidates.reduce((largest, file) => {
    const size = fs.statSync(file).size;
    if (!largest) return file;
    return size > fs.statSync(largest).size ? file : largest;
  }, null);
};

const getGeojsonPath = (name) => {
  const distPath = path.join(DATA_DIR, name);
  if (fs.existsSync(distPath)) return distPath;
  const publicPath = path.join(PUBLIC_DATA_DIR, name);
  if (fs.existsSync(publicPath)) return publicPath;
  return null;
};

const run = () => {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('dist/ not found. Run `npm run build` first.');
    process.exit(1);
  }

  const jsFiles = listFiles(ASSETS_DIR, '.js');
  if (jsFiles.length === 0) {
    console.error('No JS assets found in dist/assets.');
    process.exit(1);
  }

  const mainJsFile = pickMainJsFile(jsFiles);
  const mainJsGzip = mainJsFile ? readFileSizeGzip(mainJsFile) : 0;
  const totalJsGzip = jsFiles.reduce((sum, file) => sum + readFileSizeGzip(file), 0);

  const countriesPath = getGeojsonPath('countries.geojson');
  const civilizationsPath = getGeojsonPath('civilizations.geojson');

  const countriesSize = countriesPath ? fs.statSync(countriesPath).size : 0;
  const civilizationsSize = civilizationsPath ? fs.statSync(civilizationsPath).size : 0;

  const results = [
    {
      label: 'main JS (gzipped)',
      value: mainJsGzip,
      budget: BUDGETS.mainJsGzip,
    },
    {
      label: 'total JS (gzipped)',
      value: totalJsGzip,
      budget: BUDGETS.totalJsGzip,
    },
    {
      label: 'countries.geojson',
      value: countriesSize,
      budget: BUDGETS.countriesGeojson,
    },
    {
      label: 'civilizations.geojson',
      value: civilizationsSize,
      budget: BUDGETS.civilizationsGeojson,
    },
  ];

  const failures = results.filter((r) => r.value > r.budget);

  console.log('Bundle Budget Report');
  console.log('---------------------');
  results.forEach((r) => {
    const status = r.value > r.budget ? 'FAIL' : 'OK';
    console.log(`${status} ${r.label}: ${toKb(r.value)} (budget ${toKb(r.budget)})`);
  });

  if (!countriesPath) {
    console.warn('WARN countries.geojson not found in dist/data or public/data.');
  }
  if (!civilizationsPath) {
    console.warn('WARN civilizations.geojson not found in dist/data or public/data.');
  }

  if (mainJsFile) {
    console.log(`Main JS file: ${path.relative(process.cwd(), mainJsFile)}`);
  }

  if (failures.length > 0) {
    process.exit(1);
  }
};

run();
