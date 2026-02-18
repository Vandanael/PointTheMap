#!/usr/bin/env node
/**
 * Validate capitals dataset integrity and canonical fixes.
 */

import { capitals } from '../src/data/capitals.js';

/** @type {Set<string>} */
const ALLOWED_DUPLICATE_COUNTRY_IDS = new Set(['UNK', 'ZAF']);

/** @type {Record<string, string>} */
const REQUIRED_ENTRY_COUNTRY_IDS = {
  Abuja: 'NGA',
  Mbabane: 'SWZ',
  Lagos: 'UNK',
  Cayenne: 'UNK',
};

/** @type {Array<string>} */
const errors = [];

if (!Array.isArray(capitals) || capitals.length === 0) {
  errors.push('capitals dataset is empty or invalid.');
}

for (const [index, capital] of capitals.entries()) {
  const label = `index ${index}`;
  if (!capital || typeof capital !== 'object') {
    errors.push(`${label}: entry must be an object`);
    continue;
  }
  if (typeof capital.name !== 'string' || capital.name.trim().length === 0) {
    errors.push(`${label}: missing name`);
  }
  if (typeof capital.country !== 'string' || capital.country.trim().length === 0) {
    errors.push(`${label}: missing country`);
  }
  if (typeof capital.countryId !== 'string' || capital.countryId.trim().length === 0) {
    errors.push(`${label}: missing countryId`);
  }
  if (!Number.isFinite(capital.lat) || capital.lat < -90 || capital.lat > 90) {
    errors.push(`${label}: invalid latitude ${capital.lat}`);
  }
  if (!Number.isFinite(capital.lng) || capital.lng < -180 || capital.lng > 180) {
    errors.push(`${label}: invalid longitude ${capital.lng}`);
  }
  if (typeof capital.popular !== 'boolean') {
    errors.push(`${label}: popular must be boolean`);
  }
}

/** @type {Map<string, number>} */
const countryIdCounts = new Map();
for (const capital of capitals) {
  countryIdCounts.set(capital.countryId, (countryIdCounts.get(capital.countryId) || 0) + 1);
}

for (const [countryId, count] of countryIdCounts.entries()) {
  if (count > 1 && !ALLOWED_DUPLICATE_COUNTRY_IDS.has(countryId)) {
    errors.push(`countryId ${countryId} appears ${count} times`);
  }
}

for (const [name, expectedCountryId] of Object.entries(REQUIRED_ENTRY_COUNTRY_IDS)) {
  const matches = capitals.filter((capital) => capital.name === name);
  if (matches.length !== 1) {
    errors.push(`expected exactly one entry for ${name}, found ${matches.length}`);
    continue;
  }
  if (matches[0].countryId !== expectedCountryId) {
    errors.push(`${name} must have countryId=${expectedCountryId}, found ${matches[0].countryId}`);
  }
}

if (errors.length > 0) {
  console.error('Capitals dataset validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`OK capitals: ${capitals.length} entries validated.`);
