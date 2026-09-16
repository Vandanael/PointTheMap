import { describe, it, expect } from 'vitest';
import { MAP, appendCartoKey, CARTO_TILE_TEMPLATES } from './map.js';

describe('appendCartoKey', () => {
  it('returns the URL untouched without a key', () => {
    expect(appendCartoKey(CARTO_TILE_TEMPLATES.dark)).toBe(CARTO_TILE_TEMPLATES.dark);
    expect(appendCartoKey(CARTO_TILE_TEMPLATES.dark, '')).toBe(CARTO_TILE_TEMPLATES.dark);
    expect(appendCartoKey(CARTO_TILE_TEMPLATES.dark, '   ')).toBe(CARTO_TILE_TEMPLATES.dark);
  });

  it('appends the key as a query parameter', () => {
    expect(appendCartoKey('https://a.example/{z}/{x}/{y}.png', 'abc123')).toBe(
      'https://a.example/{z}/{x}/{y}.png?key=abc123'
    );
  });

  it('uses & when the URL already has a query string', () => {
    expect(appendCartoKey('https://a.example/t.png?foo=1', 'abc123')).toBe(
      'https://a.example/t.png?foo=1&key=abc123'
    );
  });

  it('trims and URL-encodes the key', () => {
    expect(appendCartoKey('https://a.example/t.png', ' a b/c ')).toBe(
      'https://a.example/t.png?key=a%20b%2Fc'
    );
  });
});

describe('MAP basemap config', () => {
  it('keeps tile templates key-free (the key is injected at build time)', () => {
    expect(MAP.TILE_URL_DARK).toBe(CARTO_TILE_TEMPLATES.dark);
    expect(MAP.TILE_URL_LIGHT).toBe(CARTO_TILE_TEMPLATES.light);
    expect(MAP.TILE_URL_DARK).not.toContain('key=');
  });

  it('keeps CARTO + OpenStreetMap attribution (CARTO free-tier requirement)', () => {
    expect(MAP.ATTRIBUTION).toContain('openstreetmap.org');
    expect(MAP.ATTRIBUTION).toContain('carto.com/attributions');
    expect(MAP.TILE_FALLBACK_ATTRIBUTION).toContain('openstreetmap.org');
  });
});
