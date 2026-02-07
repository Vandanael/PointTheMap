/**
 * GeoJSON data loader for server-side validation
 * Caches data at module level (persists across warm Lambda invocations)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from './_utils.js';
import { GeoJSONSchema } from '../../lib/schemas/geojson.js';

const logger = createLogger('geo-data');

// Use a distinct name to avoid "Identifier '__dirname' has already been declared" when esbuild injects __dirname
const geoDataDir = dirname(fileURLToPath(import.meta.url));

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
    const filePath = resolve(geoDataDir, '../../public/data/countries.geojson');
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    const validated = GeoJSONSchema.safeParse(parsed);
    if (!validated.success) {
      logger.error('Invalid countries GeoJSON schema');
      countryLookup = new Map();
      return countryLookup;
    }
    const data = validated.data;
    countryLookup = new Map();

    for (const feature of data.features) {
      const idRaw = feature.properties.ISO_A3 ?? feature.properties.ADM0_A3;
      const id = typeof idRaw === 'string' ? idRaw : null;
      if (id) countryLookup.set(id, feature);
    }

    logger.info(`Loaded ${countryLookup.size} countries`);
    return countryLookup;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to load countries.geojson:', message);
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
    const filePath = resolve(geoDataDir, '../../public/data/civilizations.geojson');
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    const validated = GeoJSONSchema.safeParse(parsed);
    if (!validated.success) {
      logger.error('Invalid civilizations GeoJSON schema');
      civilizationLookup = new Map();
      return civilizationLookup;
    }
    const data = validated.data;
    civilizationLookup = new Map();

    for (const feature of data.features) {
      const idRaw = feature.properties.id ?? feature.properties.name;
      const id = typeof idRaw === 'string' ? idRaw : null;
      if (id) civilizationLookup.set(id, feature);
    }

    logger.info(`Loaded ${civilizationLookup.size} civilizations`);
    return civilizationLookup;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to load civilizations.geojson:', message);
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
