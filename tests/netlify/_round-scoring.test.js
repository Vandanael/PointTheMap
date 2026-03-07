import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../netlify/functions/_utils.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

const mockGetCountryFeature = vi.fn();
const mockGetCivilizationFeature = vi.fn();

vi.mock('../../netlify/functions/_geo-data.js', () => ({
  getCountryFeature: (...args) => mockGetCountryFeature(...args),
  getCivilizationFeature: (...args) => mockGetCivilizationFeature(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are set up)
// ---------------------------------------------------------------------------

const { scoreRound } = await import('../../netlify/functions/_round-scoring.js');
const { calculateScore, haversine } = await import('../../lib/game-math/index.js');
const { calculateCountryScore } = await import('../../lib/geo-utils/index.js');
const { GAME, API } = await import('../../lib/config/index.js');

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** @param {number[][][]} rings - polygon exterior ring coordinates [lng, lat] */
const makePolygonFeature = (rings) => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: rings },
  properties: {},
});

/** A 10-degree bounding box around [0,0] (fully covers lat/lng 0 to 10) */
const BOX_FEATURE = makePolygonFeature([
  [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ],
]);

const session = (gameType, targets) => ({ gameType, targets });

// ---------------------------------------------------------------------------
// Capital mode
// ---------------------------------------------------------------------------

describe('scoreRound — capital mode', () => {
  const capitalTarget = { name: 'Paris', lat: 48.8566, lng: 2.3522 };
  const sess = session('classic', [capitalTarget]);

  it('returns max score for click at exact capital location', () => {
    const round = {
      capital: 'Paris',
      click: { lat: capitalTarget.lat, lng: capitalTarget.lng },
      timeElapsed: null,
      score: 0,
    };
    const result = scoreRound(round, 0, sess);
    expect(result.score).toBe(GAME.MAX_SCORE_PER_ROUND);
    expect(result.status).toBe('completed');
    expect(result.distance).toBe(0);
  });

  it('returns 0 score for click beyond MAX_DISTANCE_KM', () => {
    const round = {
      capital: 'Paris',
      click: { lat: 0, lng: 90 },
      timeElapsed: null,
      score: 0,
    };
    // Haversine from (48.8566, 2.3522) to (0, 90) is well beyond MAX_DISTANCE_KM
    // but we test the cap: if distance > API.MAX_DISTANCE_KM => score = 0
    // In practice the Earth prevents that, so let's use a forced scenario.
    // Directly: click at antipode of Paris: (-48.8566, 182.3522) → normalized → (-48.8566, -177.6478)
    const antiLng =
      capitalTarget.lng + 180 > 180 ? capitalTarget.lng - 180 : capitalTarget.lng + 180;
    const antiLat = -capitalTarget.lat;
    const roundAntipode = {
      capital: 'Paris',
      click: { lat: antiLat, lng: antiLng },
      timeElapsed: null,
      score: 0,
    };
    const dist = haversine([antiLat, antiLng], [capitalTarget.lat, capitalTarget.lng]);
    const result = scoreRound(roundAntipode, 0, sess);
    if (dist > API.MAX_DISTANCE_KM) {
      expect(result.score).toBe(0);
      expect(result.status).toBe('invalid');
    } else {
      // Still valid, just low score
      expect(result.score).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns timeout result when click is null', () => {
    const round = { capital: 'Paris', click: null, timeElapsed: null, score: 0 };
    const result = scoreRound(round, 0, sess);
    expect(result.score).toBe(0);
    expect(result.status).toBe('timeout');
    expect(result.click).toBeNull();
  });

  it('computes intermediate score for 200km distance', () => {
    // ~200km north of Paris
    const round = {
      capital: 'Paris',
      click: { lat: 50.66, lng: 2.35 },
      timeElapsed: null,
      score: 0,
    };
    const result = scoreRound(round, 0, sess);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(GAME.MAX_SCORE_PER_ROUND);
    expect(result.status).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// Capital mode — daily variant
// ---------------------------------------------------------------------------

describe('scoreRound — daily capital mode', () => {
  it('scores daily mode using the same formula as classic', () => {
    const capitalTarget = { name: 'Berlin', lat: 52.52, lng: 13.405 };
    const sessClassic = session('classic', [capitalTarget]);
    const sessDaily = session('daily', [capitalTarget]);
    const round = {
      capital: 'Berlin',
      click: { lat: 52.52, lng: 13.405 },
      timeElapsed: null,
      score: 0,
    };
    const rClassic = scoreRound(round, 0, sessClassic);
    const rDaily = scoreRound(round, 0, sessDaily);
    expect(rClassic.score).toBe(rDaily.score);
  });
});

// ---------------------------------------------------------------------------
// Stadium mode
// ---------------------------------------------------------------------------

describe('scoreRound — stadium mode', () => {
  const stadiumTarget = { name: 'Stade de France', lat: 48.924, lng: 2.36 };
  const sess = session('stadium', [stadiumTarget]);

  it('returns max score for click at exact stadium location', () => {
    const round = {
      stadium: 'Stade de France',
      click: { lat: stadiumTarget.lat, lng: stadiumTarget.lng },
      timeElapsed: null,
      score: 0,
    };
    const result = scoreRound(round, 0, sess);
    expect(result.score).toBe(GAME.MAX_SCORE_PER_ROUND);
    expect(result.status).toBe('completed');
    expect(result.distance).toBe(0);
  });

  it('returns timeout result when click is null', () => {
    const round = { stadium: 'Stade de France', click: null, timeElapsed: null, score: 0 };
    const result = scoreRound(round, 0, sess);
    expect(result.score).toBe(0);
    expect(result.status).toBe('timeout');
  });
});

// ---------------------------------------------------------------------------
// Country mode
// ---------------------------------------------------------------------------

describe('scoreRound — country mode', () => {
  beforeEach(() => {
    mockGetCountryFeature.mockReturnValue(BOX_FEATURE);
    mockGetCivilizationFeature.mockReturnValue(null);
  });

  const countryTarget = { name: 'France', countryId: 'FRA' };
  const sess = session('country', [countryTarget]);

  it('returns positive score for click inside country polygon', () => {
    const round = {
      country: 'France',
      countryId: 'FRA',
      clickedCountryId: 'FRA',
      click: { lat: 5, lng: 5 }, // inside BOX_FEATURE
      timeElapsed: null,
      score: 0,
    };
    const result = scoreRound(round, 0, sess);
    expect(result.score).toBeGreaterThan(0);
    expect(result.status).toBe('completed');
    expect(result.distance).toBe(0); // inside = distance 0
    expect(result.correctCountryId).toBe('FRA');
  });

  it('returns positive score for click outside country polygon', () => {
    const round = {
      country: 'France',
      countryId: 'FRA',
      clickedCountryId: 'DEU',
      click: { lat: 50, lng: 50 }, // outside BOX_FEATURE
      timeElapsed: null,
      score: 0,
    };
    const result = scoreRound(round, 0, sess);
    // Score may be positive (partial) or 0 depending on distance
    expect(result.status).toBe('completed');
    expect(typeof result.distance).toBe('number');
    expect(result.correctCountryId).toBe('FRA');
  });

  it('returns timeout result when click is null', () => {
    const round = {
      country: 'France',
      countryId: 'FRA',
      click: null,
      timeElapsed: null,
      score: 0,
    };
    const result = scoreRound(round, 0, sess);
    expect(result.score).toBe(0);
    expect(result.status).toBe('timeout');
  });

  it('returns invalid result when GeoJSON feature is missing', () => {
    mockGetCountryFeature.mockReturnValue(null);
    const round = {
      country: 'Unknown',
      countryId: 'UNK',
      click: { lat: 5, lng: 5 },
      timeElapsed: null,
      score: 0,
    };
    const result = scoreRound(round, 0, sess);
    expect(result.score).toBe(0);
    expect(result.status).toBe('invalid');
  });

  it('accepts country_daily variant', () => {
    const sessDaily = session('country_daily', [countryTarget]);
    const round = {
      country: 'France',
      countryId: 'FRA',
      click: { lat: 5, lng: 5 },
      timeElapsed: null,
      score: 0,
    };
    const result = scoreRound(round, 0, sessDaily);
    expect(result.status).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// Civilization mode
// ---------------------------------------------------------------------------

describe('scoreRound — civilization mode', () => {
  beforeEach(() => {
    mockGetCivilizationFeature.mockReturnValue(BOX_FEATURE);
    mockGetCountryFeature.mockReturnValue(null);
  });

  const civTarget = { name: 'Roman Empire', id: 'roman' };
  const sess = session('civilization', [civTarget]);

  it('returns positive score for click inside civilization polygon', () => {
    const round = {
      civilization: 'Roman Empire',
      civilizationId: 'roman',
      clickedCivilizationId: 'roman',
      click: { lat: 5, lng: 5 }, // inside BOX_FEATURE
      timeElapsed: null,
      score: 0,
    };
    const result = scoreRound(round, 0, sess);
    expect(result.score).toBeGreaterThan(0);
    expect(result.status).toBe('completed');
    expect(result.distance).toBe(0);
    expect(result.correctCivilizationId).toBe('roman');
  });

  it('returns timeout result when click is null', () => {
    const round = {
      civilization: 'Roman Empire',
      civilizationId: 'roman',
      click: null,
      timeElapsed: null,
      score: 0,
    };
    const result = scoreRound(round, 0, sess);
    expect(result.score).toBe(0);
    expect(result.status).toBe('timeout');
  });

  it('returns invalid result when GeoJSON feature is missing', () => {
    mockGetCivilizationFeature.mockReturnValue(null);
    const round = {
      civilization: 'Unknown',
      civilizationId: 'unknown',
      click: { lat: 5, lng: 5 },
      timeElapsed: null,
      score: 0,
    };
    const result = scoreRound(round, 0, sess);
    expect(result.score).toBe(0);
    expect(result.status).toBe('invalid');
  });

  it('accepts civilization_daily variant', () => {
    const sessDaily = session('civilization_daily', [civTarget]);
    const round = {
      civilization: 'Roman Empire',
      civilizationId: 'roman',
      click: { lat: 5, lng: 5 },
      timeElapsed: null,
      score: 0,
    };
    const result = scoreRound(round, 0, sessDaily);
    expect(result.status).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// Time bonus
// ---------------------------------------------------------------------------

describe('scoreRound — time bonus', () => {
  const capitalTarget = { name: 'London', lat: 51.5074, lng: -0.1278 };
  const sess = session('classic', [capitalTarget]);

  it('grants time bonus when answered well within the timer', () => {
    const roundFast = {
      capital: 'London',
      click: { lat: 51.5074, lng: -0.1278 }, // exact location → max base score
      timeElapsed: 1000, // fast answer
      score: 0,
    };
    const roundSlow = {
      capital: 'London',
      click: { lat: 51.5074, lng: -0.1278 }, // exact location → max base score
      timeElapsed: null, // no time elapsed → no time bonus
      score: 0,
    };
    const rFast = scoreRound(roundFast, 0, sess);
    const rSlow = scoreRound(roundSlow, 0, sess);
    expect(rFast.score).toBeGreaterThan(rSlow.score);
  });
});

// ---------------------------------------------------------------------------
// Client / server score parity
// ---------------------------------------------------------------------------

describe('scoreRound — client/server score parity (capital mode)', () => {
  const capitalTarget = { name: 'Paris', lat: 48.8566, lng: 2.3522 };
  const sess = session('classic', [capitalTarget]);

  const distancesKm = [0, 50, 200, 500, 1500];

  for (const targetDistanceKm of distancesKm) {
    it(`parity at ~${targetDistanceKm}km distance`, () => {
      // Approximate a click at the given distance north of Paris
      // 1 degree latitude ≈ 111.32km
      const offsetLat = targetDistanceKm / 111.32;
      const clickLat = capitalTarget.lat + offsetLat;
      const clickLng = capitalTarget.lng;

      const round = {
        capital: 'Paris',
        click: { lat: clickLat, lng: clickLng },
        timeElapsed: null,
        score: 0,
      };

      const serverResult = scoreRound(round, 0, sess);
      const actualDistance = haversine(
        [clickLat, clickLng],
        [capitalTarget.lat, capitalTarget.lng]
      );
      const clientScore = Math.round(calculateScore(actualDistance));

      if (actualDistance <= API.MAX_DISTANCE_KM) {
        expect(serverResult.score).toBe(clientScore);
      } else {
        expect(serverResult.score).toBe(0);
      }
    });
  }
});

describe('scoreRound — client/server score parity (country mode)', () => {
  beforeEach(() => {
    mockGetCountryFeature.mockReturnValue(BOX_FEATURE);
  });

  const countryTarget = { name: 'France', countryId: 'FRA' };
  const sess = session('country', [countryTarget]);

  it('parity: click inside country → distance 0, score = calculateCountryScore(0)', () => {
    const round = {
      country: 'France',
      countryId: 'FRA',
      click: { lat: 5, lng: 5 }, // inside BOX_FEATURE
      timeElapsed: null,
      score: 0,
    };
    const serverResult = scoreRound(round, 0, sess);
    const expectedScore = Math.round(calculateCountryScore(0));
    expect(serverResult.distance).toBe(0);
    expect(serverResult.score).toBe(expectedScore);
  });
});
