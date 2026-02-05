/**
 * Optimize countries.geojson for smaller size without breaking map behavior.
 * - Reduces coordinate precision (3 decimals ≈ 111 m, acceptable for country boundaries)
 * - Keeps only properties required by MapSystem and generate-countries-dataset.js:
 *   ISO_A3, ADM0_A3, NAME, ADMIN, POP_EST
 * Output: overwrites public/data/countries.geojson (minified JSON).
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GEOJSON_PATH = join(__dirname, '../public/data/countries.geojson');

const COORD_DECIMALS = 3; // 0.001° ≈ 111 m
const KEEP_PROPERTIES = ['ISO_A3', 'ADM0_A3', 'NAME', 'ADMIN', 'POP_EST'];

function roundCoord(coord) {
  if (typeof coord === 'number') {
    return Math.round(coord * 10 ** COORD_DECIMALS) / 10 ** COORD_DECIMALS;
  }
  if (Array.isArray(coord)) {
    return coord.map(roundCoord);
  }
  return coord;
}

function stripProperties(properties) {
  const out = {};
  for (const key of KEEP_PROPERTIES) {
    if (key in properties) out[key] = properties[key];
  }
  return out;
}

const geojson = JSON.parse(readFileSync(GEOJSON_PATH, 'utf-8'));

geojson.features = geojson.features.map((feature) => ({
  type: feature.type,
  properties: stripProperties(feature.properties),
  geometry: {
    type: feature.geometry.type,
    coordinates: roundCoord(feature.geometry.coordinates),
  },
}));

writeFileSync(GEOJSON_PATH, JSON.stringify(geojson), 'utf-8');
console.log('Optimized', GEOJSON_PATH);
