/**
 * Add countryId field to capitals.js by matching with countries.geojson
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { frenchToEnglish } from './country-name-mappings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read files
const capitalsPath = join(__dirname, '../capitals.js');
const geojsonPath = join(__dirname, '../public/data/countries.geojson');

const capitalsContent = readFileSync(capitalsPath, 'utf-8');
const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8'));

// Extract capitals array from the file
const capitalsMatch = capitalsContent.match(/export const capitals = \[([\s\S]*?)\];/);
if (!capitalsMatch) {
  console.error('Could not find capitals array');
  process.exit(1);
}

// Parse capitals (simple regex-based parsing)
const capitals = [];
const capitalRegex =
  /\{\s*name:\s*"([^"]+)"\s*,\s*country:\s*"([^"]+)"\s*,\s*lat:\s*([-\d.]+)\s*,\s*lng:\s*([-\d.]+)\s*,\s*popular:\s*(true|false)\s*\}/g;

let match;
while ((match = capitalRegex.exec(capitalsMatch[1])) !== null) {
  capitals.push({
    name: match[1],
    country: match[2],
    lat: parseFloat(match[3]),
    lng: parseFloat(match[4]),
    popular: match[5] === 'true',
  });
}

console.log(`Found ${capitals.length} capitals`);

// Create mapping from English country name to ISO code
const engNameToId = {};
geojson.features.forEach((feature) => {
  const name = feature.properties.ADMIN || feature.properties.NAME;
  let isoCode = feature.properties.ISO_A3;

  // Fix known issues
  if (isoCode === '-99') {
    if (name === 'France') isoCode = 'FRA';
    else if (name === 'Norway') isoCode = 'NOR';
  }

  engNameToId[name] = isoCode;
});

// Add countryId to each capital
capitals.forEach((capital) => {
  // Translate French name to English
  const englishName = frenchToEnglish[capital.country];

  if (!englishName) {
    console.warn(`⚠️  No English translation for: ${capital.country}`);
    capital.countryId = 'UNK';
    return;
  }

  // Get ISO code from GeoJSON
  const countryId = engNameToId[englishName];

  if (!countryId) {
    console.warn(`⚠️  No ISO code found for: ${capital.country} (${englishName})`);
    capital.countryId = 'UNK';
    return;
  }

  capital.countryId = countryId;
});

// Generate new capitals.js content
const header = `/**
 * PointTheMap - Comprehensive World Capitals Database
 * =====================================================
 * 197 capitales mondiales (États membres ONU + observateurs)
 *
 * Structure:
 * - name: Nom de la capitale
 * - country: Nom du pays
 * - countryId: Code ISO 3166-1 alpha-3 du pays
 * - lat: Latitude (format décimal, précision 4 décimales)
 * - lng: Longitude (format décimal, précision 4 décimales)
 * - popular: true = capitale majeure connue mondialement (50 villes)
 *            false = capitale moins connue (147 villes)
 *
 * Coordonnées GPS: Centre-ville administratif ou monument emblématique
 * Source: OpenStreetMap, GeoNames
 *
 * @typedef {{ name: string, country: string, countryId: string, lat: number, lng: number, popular: boolean }} CapitalEntry
 */

export const capitals = [
`;

const capitalEntries = capitals
  .map(
    (c) =>
      `  { name: "${c.name}", country: "${c.country}", countryId: "${c.countryId}", lat: ${c.lat}, lng: ${c.lng}, popular: ${c.popular} }`
  )
  .join(',\n');

const footer = `
];
`;

const newContent = header + capitalEntries + footer;

// Write new file
writeFileSync(capitalsPath, newContent, 'utf-8');

console.log(`✅ Updated capitals.js with countryId field`);
console.log(`   Total capitals: ${capitals.length}`);
console.log(`   Missing countryId: ${capitals.filter((c) => c.countryId === 'UNK').length}`);
