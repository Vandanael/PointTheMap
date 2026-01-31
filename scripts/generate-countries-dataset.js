/**
 * Generate countries.js dataset from countries.geojson
 * Extracts country names and classifies them as popular/obscure
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Popular countries (well-known, large population, or frequently visited)
const POPULAR_COUNTRIES = new Set([
  // Large/influential countries
  'United States of America', 'China', 'India', 'Russia', 'Brazil', 'Japan',
  'Germany', 'United Kingdom', 'France', 'Italy', 'Spain', 'Canada', 'Australia',
  'Mexico', 'South Korea', 'Indonesia', 'Turkey', 'Saudi Arabia', 'Argentina',
  'South Africa', 'Egypt', 'Nigeria', 'Iran', 'Thailand', 'Poland',

  // Western Europe
  'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway',
  'Denmark', 'Finland', 'Portugal', 'Greece', 'Ireland', 'Czechia',

  // Other notable
  'Israel', 'United Arab Emirates', 'Singapore', 'New Zealand', 'Chile',
  'Colombia', 'Peru', 'Venezuela', 'Ukraine', 'Romania', 'Vietnam',
  'Philippines', 'Malaysia', 'Pakistan', 'Bangladesh', 'Morocco'
]);

// Read GeoJSON
const geojsonPath = join(__dirname, '../public/data/countries.geojson');
const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8'));

// Extract countries
const countries = geojson.features
  .map(feature => {
    const name = feature.properties.NAME || feature.properties.ADMIN;
    const iso = feature.properties.ISO_A3;
    const population = feature.properties.POP_EST || 0;

    return {
      name,
      countryId: iso,
      popular: POPULAR_COUNTRIES.has(name),
      population
    };
  })
  .filter(c => c.name && c.name !== '-99') // Filter invalid entries
  .sort((a, b) => {
    // Sort by popular first, then alphabetically
    if (a.popular !== b.popular) return a.popular ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

// Generate countries.js file
const outputPath = join(__dirname, '../countries.js');
const output = `/**
 * PointTheMap - World Countries Database
 * ======================================
 * ${countries.length} countries for Country mode
 *
 * Structure:
 * - name: Country name (English)
 * - countryId: ISO 3166-1 alpha-3 code
 * - popular: true = major/well-known country (${countries.filter(c => c.popular).length} countries)
 *            false = less known country (${countries.filter(c => !c.popular).length} countries)
 *
 * Source: Natural Earth Data (110m resolution)
 *
 * @typedef {{ name: string, countryId: string, popular: boolean }} CountryEntry
 */

export const countries = [
${countries.map(c => `  { name: "${c.name}", countryId: "${c.countryId}", popular: ${c.popular} }`).join(',\n')}
];

/**
 * Get country by ID
 * @param {string} countryId - ISO 3166-1 alpha-3 code
 * @returns {CountryEntry|undefined}
 */
export function getCountryById(countryId) {
  return countries.find(c => c.countryId === countryId);
}

/**
 * Get country by name
 * @param {string} name - Country name
 * @returns {CountryEntry|undefined}
 */
export function getCountryByName(name) {
  return countries.find(c => c.name === name);
}
`;

writeFileSync(outputPath, output, 'utf-8');

console.log(`✅ Generated ${outputPath}`);
console.log(`   Total countries: ${countries.length}`);
console.log(`   Popular: ${countries.filter(c => c.popular).length}`);
console.log(`   Obscure: ${countries.filter(c => !c.popular).length}`);
