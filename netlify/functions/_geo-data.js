/**
 * GeoJSON data loader for server-side validation
 * Caches data at module level (persists across warm Lambda invocations)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {Map<string, Object> | null} */
let countryLookup = null;

/** @type {Map<string, Object> | null} */
let civilizationLookup = null;

/**
 * Load and index countries GeoJSON (lazy, cached)
 * @returns {Map<string, Object>}
 */
function loadCountries() {
  if (countryLookup) return countryLookup;

  try {
    const filePath = resolve(__dirname, '../../public/data/countries.geojson');
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    countryLookup = new Map();

    for (const feature of data.features) {
      const id = feature.properties.ISO_A3 || feature.properties.ADM0_A3;
      if (id) countryLookup.set(id, feature);
    }

    console.log(`[geo-data] Loaded ${countryLookup.size} countries`);
    return countryLookup;
  } catch (err) {
    console.error('[geo-data] Failed to load countries.geojson:', err.message);
    countryLookup = new Map();
    return countryLookup;
  }
}

/**
 * Load and index civilizations GeoJSON (lazy, cached)
 * @returns {Map<string, Object>}
 */
function loadCivilizations() {
  if (civilizationLookup) return civilizationLookup;

  try {
    const filePath = resolve(__dirname, '../../public/data/civilizations.geojson');
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    civilizationLookup = new Map();

    for (const feature of data.features) {
      const id = feature.properties.id || feature.properties.name;
      if (id) civilizationLookup.set(id, feature);
    }

    console.log(`[geo-data] Loaded ${civilizationLookup.size} civilizations`);
    return civilizationLookup;
  } catch (err) {
    console.error('[geo-data] Failed to load civilizations.geojson:', err.message);
    civilizationLookup = new Map();
    return civilizationLookup;
  }
}

/**
 * Get country GeoJSON feature by ISO A3 code
 * @param {string} countryId - ISO A3 code
 * @returns {Object | undefined}
 */
export function getCountryFeature(countryId) {
  return loadCountries().get(countryId);
}

/**
 * Get civilization GeoJSON feature by ID
 * @param {string} civId - Civilization ID
 * @returns {Object | undefined}
 */
export function getCivilizationFeature(civId) {
  return loadCivilizations().get(civId);
}
