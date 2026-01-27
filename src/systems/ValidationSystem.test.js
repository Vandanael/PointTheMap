import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationSystem, getValidationSystem, validationSystem } from './ValidationSystem.js';

describe('ValidationSystem', () => {
  let system;

  beforeEach(() => {
    system = new ValidationSystem();
  });

  describe('Pseudo Validation', () => {
    it('should accept valid pseudos', () => {
      expect(system.validatePseudo('ABC').valid).toBe(true);
      expect(system.validatePseudo('ABCD').valid).toBe(true);
      expect(system.validatePseudo('ABCDE').valid).toBe(true);
    });

    it('should reject pseudos that are too short', () => {
      const result = system.validatePseudo('AB');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least');
    });

    it('should reject pseudos that are too long', () => {
      const result = system.validatePseudo('ABCDEF');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at most');
    });

    it('should reject pseudos with lowercase letters', () => {
      const result = system.validatePseudo('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('uppercase');
    });

    it('should reject pseudos with numbers', () => {
      const result = system.validatePseudo('ABC1');
      expect(result.valid).toBe(false);
    });

    it('should reject pseudos with special characters', () => {
      expect(system.validatePseudo('AB-C').valid).toBe(false);
      expect(system.validatePseudo('AB_C').valid).toBe(false);
      expect(system.validatePseudo('AB C').valid).toBe(false);
    });

    it('should reject empty or null pseudos', () => {
      expect(system.validatePseudo('').valid).toBe(false);
      expect(system.validatePseudo(null).valid).toBe(false);
      expect(system.validatePseudo(undefined).valid).toBe(false);
    });

    it('should reject non-string pseudos', () => {
      expect(system.validatePseudo(123).valid).toBe(false);
      expect(system.validatePseudo({}).valid).toBe(false);
      expect(system.validatePseudo([]).valid).toBe(false);
    });

    it('should handle whitespace trimming', () => {
      const result = system.validatePseudo('  ABC  ');
      // Should validate the trimmed value
      expect(result.valid).toBe(true);
    });

    it('should provide helpful error messages', () => {
      const tooShort = system.validatePseudo('AB');
      const tooLong = system.validatePseudo('ABCDEF');
      const lowercase = system.validatePseudo('abc');

      expect(tooShort.error).toBeDefined();
      expect(tooLong.error).toBeDefined();
      expect(lowercase.error).toBeDefined();
    });
  });

  describe('Latitude Validation', () => {
    it('should accept valid latitudes', () => {
      expect(system.validateLatitude(0).valid).toBe(true);
      expect(system.validateLatitude(45).valid).toBe(true);
      expect(system.validateLatitude(-45).valid).toBe(true);
      expect(system.validateLatitude(90).valid).toBe(true);
      expect(system.validateLatitude(-90).valid).toBe(true);
    });

    it('should reject latitudes out of range', () => {
      const tooHigh = system.validateLatitude(91);
      const tooLow = system.validateLatitude(-91);

      expect(tooHigh.valid).toBe(false);
      expect(tooLow.valid).toBe(false);
      expect(tooHigh.error).toContain('between');
    });

    it('should reject non-numeric latitudes', () => {
      expect(system.validateLatitude('45').valid).toBe(false);
      expect(system.validateLatitude(null).valid).toBe(false);
      expect(system.validateLatitude(undefined).valid).toBe(false);
    });

    it('should reject infinite and NaN values', () => {
      expect(system.validateLatitude(Infinity).valid).toBe(false);
      expect(system.validateLatitude(-Infinity).valid).toBe(false);
      expect(system.validateLatitude(NaN).valid).toBe(false);
    });

    it('should provide details in error', () => {
      const result = system.validateLatitude(100);
      expect(result.details).toBeDefined();
      expect(result.details.value).toBe(100);
      expect(result.details.min).toBe(-90);
      expect(result.details.max).toBe(90);
    });
  });

  describe('Longitude Validation', () => {
    it('should accept valid longitudes', () => {
      expect(system.validateLongitude(0).valid).toBe(true);
      expect(system.validateLongitude(90).valid).toBe(true);
      expect(system.validateLongitude(-90).valid).toBe(true);
      expect(system.validateLongitude(180).valid).toBe(true);
      expect(system.validateLongitude(-180).valid).toBe(true);
    });

    it('should reject longitudes out of range', () => {
      const tooHigh = system.validateLongitude(181);
      const tooLow = system.validateLongitude(-181);

      expect(tooHigh.valid).toBe(false);
      expect(tooLow.valid).toBe(false);
    });

    it('should reject non-numeric longitudes', () => {
      expect(system.validateLongitude('90').valid).toBe(false);
      expect(system.validateLongitude(null).valid).toBe(false);
    });

    it('should reject infinite and NaN values', () => {
      expect(system.validateLongitude(Infinity).valid).toBe(false);
      expect(system.validateLongitude(-Infinity).valid).toBe(false);
      expect(system.validateLongitude(NaN).valid).toBe(false);
    });
  });

  describe('Coordinates Validation', () => {
    it('should accept valid coordinate pairs', () => {
      expect(system.validateCoordinates(48.8566, 2.3522).valid).toBe(true); // Paris
      expect(system.validateCoordinates(51.5074, -0.1278).valid).toBe(true); // London
      expect(system.validateCoordinates(-33.8688, 151.2093).valid).toBe(true); // Sydney
    });

    it('should reject invalid latitude', () => {
      const result = system.validateCoordinates(100, 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Latitude');
    });

    it('should reject invalid longitude', () => {
      const result = system.validateCoordinates(0, 200);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Longitude');
    });

    it('should validate both coordinates', () => {
      expect(system.validateCoordinates(0, 0).valid).toBe(true);
      expect(system.validateCoordinates(90, 180).valid).toBe(true);
      expect(system.validateCoordinates(-90, -180).valid).toBe(true);
    });
  });

  describe('Click Validation', () => {
    it('should accept null clicks (timeout)', () => {
      expect(system.validateClick(null).valid).toBe(true);
    });

    it('should accept valid click objects', () => {
      const click = { lat: 48.8566, lng: 2.3522 };
      expect(system.validateClick(click).valid).toBe(true);
    });

    it('should reject invalid click objects', () => {
      expect(system.validateClick({}).valid).toBe(false);
      expect(system.validateClick({ lat: 48.8566 }).valid).toBe(false);
      expect(system.validateClick({ lng: 2.3522 }).valid).toBe(false);
    });

    it('should reject non-object clicks', () => {
      expect(system.validateClick('invalid').valid).toBe(false);
      expect(system.validateClick(123).valid).toBe(false);
    });

    it('should validate coordinates in click', () => {
      const invalidLat = { lat: 100, lng: 0 };
      const invalidLng = { lat: 0, lng: 200 };

      expect(system.validateClick(invalidLat).valid).toBe(false);
      expect(system.validateClick(invalidLng).valid).toBe(false);
    });
  });

  describe('Token Validation', () => {
    it('should accept non-empty string tokens', () => {
      expect(system.validateToken('abc123').valid).toBe(true);
      expect(system.validateToken('valid-token-123').valid).toBe(true);
    });

    it('should reject empty tokens', () => {
      expect(system.validateToken('').valid).toBe(false);
      expect(system.validateToken('   ').valid).toBe(false);
    });

    it('should reject null or undefined tokens', () => {
      expect(system.validateToken(null).valid).toBe(false);
      expect(system.validateToken(undefined).valid).toBe(false);
    });

    it('should reject non-string tokens', () => {
      expect(system.validateToken(123).valid).toBe(false);
      expect(system.validateToken({}).valid).toBe(false);
    });
  });

  describe('Game Duration Validation', () => {
    it('should accept reasonable durations', () => {
      expect(system.validateGameDuration(20000).valid).toBe(true); // 20s
      expect(system.validateGameDuration(60000).valid).toBe(true); // 1min
      expect(system.validateGameDuration(300000).valid).toBe(true); // 5min
    });

    it('should reject too short durations', () => {
      const result = system.validateGameDuration(1000); // 1s
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should reject too long durations', () => {
      const result = system.validateGameDuration(11 * 60 * 1000); // 11min
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should reject non-numeric durations', () => {
      expect(system.validateGameDuration('100').valid).toBe(false);
      expect(system.validateGameDuration(null).valid).toBe(false);
    });

    it('should reject infinite durations', () => {
      expect(system.validateGameDuration(Infinity).valid).toBe(false);
      expect(system.validateGameDuration(-Infinity).valid).toBe(false);
    });

    it('should provide duration details in error', () => {
      const result = system.validateGameDuration(1000);
      expect(result.details).toBeDefined();
      expect(result.details.duration).toBe(1000);
      expect(result.details.minimum).toBeDefined();
    });
  });

  describe('Round Validation', () => {
    it('should accept valid rounds', () => {
      const round = {
        capital: 'Paris',
        status: 'completed',
        click: { lat: 48.8566, lng: 2.3522 },
      };
      expect(system.validateRound(round, 0).valid).toBe(true);
    });

    it('should accept timeout rounds', () => {
      const round = {
        capital: 'Paris',
        status: 'timeout',
        click: null,
      };
      expect(system.validateRound(round, 0).valid).toBe(true);
    });

    it('should reject rounds without capital', () => {
      const round = { status: 'completed' };
      const result = system.validateRound(round, 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('capital');
    });

    it('should reject rounds with invalid status', () => {
      const round = {
        capital: 'Paris',
        status: 'invalid-status',
      };
      const result = system.validateRound(round, 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('status');
    });

    it('should validate click coordinates', () => {
      const round = {
        capital: 'Paris',
        status: 'completed',
        click: { lat: 100, lng: 0 }, // Invalid
      };
      const result = system.validateRound(round, 0);
      expect(result.valid).toBe(false);
    });

    it('should include round index in error messages', () => {
      const round = { capital: null, status: 'completed' };
      const result = system.validateRound(round, 2);
      expect(result.error).toContain('3'); // Round index 2 = Round 3
    });
  });

  describe('Rounds Array Validation', () => {
    const validRounds = [
      { capital: 'Paris', status: 'completed', click: { lat: 48, lng: 2 } },
      { capital: 'London', status: 'completed', click: { lat: 51, lng: 0 } },
      { capital: 'Berlin', status: 'completed', click: { lat: 52, lng: 13 } },
      { capital: 'Rome', status: 'timeout', click: null },
      { capital: 'Madrid', status: 'completed', click: { lat: 40, lng: -3 } },
    ];

    it('should accept valid rounds array', () => {
      expect(system.validateRounds(validRounds).valid).toBe(true);
    });

    it('should reject non-array rounds', () => {
      expect(system.validateRounds('not-array').valid).toBe(false);
      expect(system.validateRounds(null).valid).toBe(false);
    });

    it('should reject wrong number of rounds', () => {
      const tooFew = validRounds.slice(0, 3);
      const tooMany = [...validRounds, validRounds[0]];

      expect(system.validateRounds(tooFew).valid).toBe(false);
      expect(system.validateRounds(tooMany).valid).toBe(false);
    });

    it('should validate each round', () => {
      const invalidRounds = [...validRounds];
      invalidRounds[2] = { ...invalidRounds[2], capital: null };

      const result = system.validateRounds(invalidRounds);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('3'); // Round 3
    });

    it('should validate capitals match expected', () => {
      const expectedCapitals = [
        { name: 'Paris' },
        { name: 'London' },
        { name: 'Berlin' },
        { name: 'Rome' },
        { name: 'Madrid' },
      ];

      expect(system.validateRounds(validRounds, expectedCapitals).valid).toBe(true);
    });

    it('should reject mismatched capitals', () => {
      const expectedCapitals = [
        { name: 'Paris' },
        { name: 'London' },
        { name: 'WRONG' }, // Mismatch
        { name: 'Rome' },
        { name: 'Madrid' },
      ];

      const result = system.validateRounds(validRounds, expectedCapitals);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('3'); // Round 3
      expect(result.error).toContain('WRONG');
    });
  });

  describe('Session Validation', () => {
    const validSession = {
      token: 'valid-token-123',
      pseudo: 'ABC',
      rounds: [
        { capital: 'Paris', status: 'completed', click: { lat: 48, lng: 2 } },
        { capital: 'London', status: 'completed', click: { lat: 51, lng: 0 } },
        { capital: 'Berlin', status: 'completed', click: { lat: 52, lng: 13 } },
        { capital: 'Rome', status: 'timeout', click: null },
        { capital: 'Madrid', status: 'completed', click: { lat: 40, lng: -3 } },
      ],
    };

    it('should accept valid sessions', () => {
      expect(system.validateSession(validSession).valid).toBe(true);
    });

    it('should reject invalid tokens', () => {
      const session = { ...validSession, token: '' };
      expect(system.validateSession(session).valid).toBe(false);
    });

    it('should reject invalid pseudos', () => {
      const session = { ...validSession, pseudo: 'ab' };
      expect(system.validateSession(session).valid).toBe(false);
    });

    it('should reject invalid rounds', () => {
      const session = { ...validSession, rounds: [] };
      expect(system.validateSession(session).valid).toBe(false);
    });

    it('should validate duration if timestamps provided', () => {
      const session = {
        ...validSession,
        startTime: Date.now() - 100, // 100ms ago (too short)
        endTime: Date.now(),
      };
      expect(system.validateSession(session).valid).toBe(false);
    });

    it('should accept valid duration', () => {
      const session = {
        ...validSession,
        startTime: Date.now() - 60000, // 1 minute ago
        endTime: Date.now(),
      };
      expect(system.validateSession(session).valid).toBe(true);
    });

    it('should reject non-object sessions', () => {
      expect(system.validateSession(null).valid).toBe(false);
      expect(system.validateSession('session').valid).toBe(false);
    });
  });

  describe('Quick Validation Helpers', () => {
    it('should provide quick pseudo validation', () => {
      expect(system.isValidPseudoFormat('ABC')).toBe(true);
      expect(system.isValidPseudoFormat('ab')).toBe(false);
    });

    it('should provide quick coordinates validation', () => {
      expect(system.areValidCoordinates(48, 2)).toBe(true);
      expect(system.areValidCoordinates(100, 0)).toBe(false);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance with getValidationSystem', () => {
      const instance1 = getValidationSystem();
      const instance2 = getValidationSystem();

      expect(instance1).toBe(instance2);
    });

    it('should export pre-initialized singleton', () => {
      expect(validationSystem).toBeInstanceOf(ValidationSystem);
    });
  });

  describe('Edge Cases', () => {
    it('should handle edge coordinates', () => {
      expect(system.validateCoordinates(90, 180).valid).toBe(true);
      expect(system.validateCoordinates(-90, -180).valid).toBe(true);
      expect(system.validateCoordinates(0, 0).valid).toBe(true);
    });

    it('should handle floating point coordinates', () => {
      expect(system.validateCoordinates(48.856614, 2.3522219).valid).toBe(true);
    });

    it('should handle edge durations', () => {
      expect(system.validateGameDuration(15000).valid).toBe(true); // Exactly at minimum
      expect(system.validateGameDuration(600000).valid).toBe(true); // Exactly at maximum
    });
  });
});
