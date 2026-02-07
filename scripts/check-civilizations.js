#!/usr/bin/env node
/**
 * Validate that civilizations data matches GeoJSON features used by civs mode.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { civilizations } from '../src/data/civilizations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const geojsonPath = path.join(__dirname, '../public/data/civilizations.geojson');

if (!fs.existsSync(geojsonPath)) {
  console.error(`Missing GeoJSON file: ${geojsonPath}`);
  process.exit(1);
}

const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
const features = Array.isArray(geojson?.features) ? geojson.features : [];

const civIds = civilizations.map((c) => c.id);
const civIdSet = new Set(civIds);
const featureIds = features.map((f) => f?.properties?.id).filter(Boolean);
const featureIdSet = new Set(featureIds);

const duplicateCivIds = civIds.filter((id, idx) => civIds.indexOf(id) !== idx);

const missingFeatures = civIds.filter((id) => !featureIdSet.has(id));
const extraFeatures = featureIds.filter((id) => !civIdSet.has(id));

const badFeatures = features
  .filter((f) => !f?.properties?.id || !f?.properties?.name || !f?.geometry)
  .map((f, index) => ({
    index,
    id: f?.properties?.id ?? null,
    name: f?.properties?.name ?? null,
    hasGeometry: Boolean(f?.geometry),
  }));

let hasErrors = false;

if (duplicateCivIds.length) {
  hasErrors = true;
  console.error(`Duplicate civilization ids in src/data/civilizations.js:`);
  console.error(duplicateCivIds.join(', '));
}

if (missingFeatures.length) {
  hasErrors = true;
  console.error(`Missing GeoJSON features for civilization ids:`);
  console.error(missingFeatures.join(', '));
}

if (extraFeatures.length) {
  hasErrors = true;
  console.error(`GeoJSON has features not listed in src/data/civilizations.js:`);
  console.error(extraFeatures.join(', '));
}

if (badFeatures.length) {
  hasErrors = true;
  console.error(`GeoJSON features missing id/name/geometry:`);
  console.error(badFeatures);
}

if (hasErrors) {
  process.exit(1);
}

console.log(
  `OK civilizations: ${civIds.length} entries, ${features.length} features, all matched.`
);
