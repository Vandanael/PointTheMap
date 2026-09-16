import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MAP } from '@lib/config/index.js';

/**
 * `tileUrls.js` reads `import.meta.env.VITE_CARTO_API_KEY` once at module load,
 * so each case stubs the env and re-imports the module.
 * @param {string} key
 */
const loadWithKey = async (key) => {
  vi.resetModules();
  vi.stubEnv('VITE_CARTO_API_KEY', key);
  return import('./tileUrls.js');
};

describe('tileUrls', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('appends the build-time CARTO key to both themes', async () => {
    const { getCartoTileUrl, HAS_CARTO_API_KEY } = await loadWithKey('test-key-123');

    expect(HAS_CARTO_API_KEY).toBe(true);
    expect(getCartoTileUrl('dark')).toBe(`${MAP.TILE_URL_DARK}?key=test-key-123`);
    expect(getCartoTileUrl('light')).toBe(`${MAP.TILE_URL_LIGHT}?key=test-key-123`);
  });

  it('returns keyless templates when no key is configured', async () => {
    const { getCartoTileUrl, HAS_CARTO_API_KEY } = await loadWithKey('');

    expect(HAS_CARTO_API_KEY).toBe(false);
    expect(getCartoTileUrl('dark')).toBe(MAP.TILE_URL_DARK);
    expect(getCartoTileUrl('light')).toBe(MAP.TILE_URL_LIGHT);
  });

  it('treats a whitespace-only key as missing', async () => {
    const { getCartoTileUrl, HAS_CARTO_API_KEY } = await loadWithKey('   ');

    expect(HAS_CARTO_API_KEY).toBe(false);
    expect(getCartoTileUrl('dark')).toBe(MAP.TILE_URL_DARK);
  });
});
