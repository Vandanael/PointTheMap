/**
 * Build public/data/civilizations.geojson from aourednik/historical-basemaps.
 * Run: node scripts/build-civilizations-geojson.js
 */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import simplify from '@turf/simplify';
import union from '@turf/union';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson';
const SIMPLIFY_TOLERANCE = 0.02;
const OUT_PATH = join(__dirname, '../public/data/civilizations.geojson');

async function fetchGeoJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + url);
  return res.json();
}

function featureMatchesName(feature, nameInBasemap) {
  const name = feature.properties && (feature.properties.NAME || feature.properties.SUBJECTO);
  if (name == null) return false;
  return String(name).trim() === String(nameInBasemap).trim();
}

function mergeGeometries(features) {
  if (features.length === 0) return null;
  if (features.length === 1) return features[0].geometry;
  let acc = features[0];
  for (let i = 1; i < features.length; i++) {
    try {
      acc = union(acc, features[i]);
    } catch (_) {}
  }
  return acc && acc.geometry ? acc.geometry : null;
}

function buildFeature(id, name, geometry) {
  if (!geometry || !geometry.coordinates) return null;
  const simplified = simplify(
    { type: 'Feature', properties: {}, geometry },
    { tolerance: SIMPLIFY_TOLERANCE, highQuality: true }
  );
  return {
    type: 'Feature',
    properties: { id, name },
    geometry: simplified.geometry,
  };
}

async function main() {
  const { civilizations } = await import('../civilizations.js');
  const { BASEMAP_MAPPING } = await import('./civilizations-basemap-mapping.js');
  const fileCache = new Map();
  const features = [];
  const missing = [];
  const noMatch = [];

  for (const civ of civilizations) {
    const mapping = BASEMAP_MAPPING[civ.id];
    if (!mapping) {
      missing.push(civ.id);
      continue;
    }
    const url = BASE_URL + '/' + mapping.filename;
    if (!fileCache.has(url)) {
      try {
        fileCache.set(url, await fetchGeoJSON(url));
      } catch (e) {
        console.warn('Fetch failed ' + mapping.filename + ':', e.message);
        noMatch.push(civ.id);
        continue;
      }
    }
    const fc = fileCache.get(url);
    const matching = (fc.features || []).filter(function (f) {
      return featureMatchesName(f, mapping.nameInBasemap);
    });
    if (matching.length === 0) {
      noMatch.push(civ.id);
      continue;
    }
    const merged = mergeGeometries(matching);
    const feature = buildFeature(civ.id, civ.name, merged);
    if (feature) features.push(feature);
  }

  const collection = { type: 'FeatureCollection', name: 'civilizations', features };
  writeFileSync(OUT_PATH, JSON.stringify(collection, null, 2), 'utf-8');
  console.log('Wrote ' + features.length + ' features to ' + OUT_PATH);
  if (missing.length) console.warn('No mapping:', missing.join(', '));
  if (noMatch.length) console.warn('No/match failed:', noMatch.join(', '));
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
enerated ${outputPath}`);
console.log(`   Total countries: ${countries.length}`);
console.log(`   Popular: ${countries.filter(c => c.popular).length}`);
console.log(`   Obscure: ${countries.filter(c => !c.popular).length}`);
