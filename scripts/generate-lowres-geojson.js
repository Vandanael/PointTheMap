/**
 * Generate low-res GeoJSON files for faster rendering.
 * Output:
 *  - public/data/countries.low.geojson
 *  - public/data/civilizations.low.geojson
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import simplify from '@turf/simplify';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../public/data');

const FILES = [
  { src: 'countries.geojson', out: 'countries.low.geojson', tolerance: 0.08 },
  { src: 'civilizations.geojson', out: 'civilizations.low.geojson', tolerance: 0.12 },
];

function loadGeoJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function saveGeoJSON(path, data) {
  writeFileSync(path, JSON.stringify(data), 'utf-8');
}

function simplifyFeatureCollection(geojson, tolerance) {
  const out = { ...geojson, features: [] };
  for (const feature of geojson.features || []) {
    try {
      const simplified = simplify(feature, {
        tolerance,
        highQuality: false,
        mutate: false,
      });
      out.features.push(simplified);
    } catch {
      // Fall back to original feature if simplification fails
      out.features.push(feature);
    }
  }
  return out;
}

for (const { src, out, tolerance } of FILES) {
  const inputPath = join(DATA_DIR, src);
  const outputPath = join(DATA_DIR, out);
  const geojson = loadGeoJSON(inputPath);

  const simplified = simplifyFeatureCollection(geojson, tolerance);

  saveGeoJSON(outputPath, simplified);
  console.log(`Generated ${out} (tolerance=${tolerance})`);
}
