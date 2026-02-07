#!/usr/bin/env node
/**
 * Inspect basemap names for a given historical-basemaps GeoJSON file.
 * Usage: node scripts/inspect-basemap-names.js <filename> [filter]
 */
import { argv, exit } from 'node:process';

const BASE_URL = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson';

const filename = argv[2];
const filter = (argv[3] || '').toLowerCase();

if (!filename) {
  console.error('Usage: node scripts/inspect-basemap-names.js <filename> [filter]');
  exit(1);
}

const url = `${BASE_URL}/${filename}`;

const res = await fetch(url);
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${url}`);
  exit(1);
}

const data = await res.json();
const features = Array.isArray(data?.features) ? data.features : [];
const names = new Set();

for (const f of features) {
  const props = f?.properties || {};
  const name = props.NAME ?? props.SUBJECTO;
  if (typeof name === 'string') {
    names.add(name.trim());
  }
}

const out = [...names].filter((n) => !filter || n.toLowerCase().includes(filter));
out.sort((a, b) => a.localeCompare(b));

if (out.length === 0) {
  console.log('No names found for the given filter.');
  exit(0);
}

for (const name of out) {
  console.log(name);
}
