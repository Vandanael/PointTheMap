import { describe, it, expect } from 'vitest';
import {
  toDomainModel,
  toPersistenceModel,
  isPersistenceModel,
  isDomainModel,
} from './sessionModel.js';

describe('Session Domain Model', () => {
  describe('toDomainModel', () => {
    it('should convert persistence model to domain model', () => {
      const persistenceSession = {
        token: 'test-token-123',
        capitals: [
          { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
          { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278 },
        ],
        startTime: 1234567890,
        used: false,
        gameType: 'classic',
        csrfToken: 'csrf-123',
      };

      const domainSession = toDomainModel(persistenceSession);

      expect(domainSession).toEqual({
        token: 'test-token-123',
        targets: [
          { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
          { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278 },
        ],
        startTime: 1234567890,
        used: false,
        gameType: 'classic',
        csrfToken: 'csrf-123',
      });

      // Verify "capitals" field is removed
      expect(domainSession).not.toHaveProperty('capitals');
      // Verify "targets" field exists
      expect(domainSession).toHaveProperty('targets');
    });

    it('should handle country targets', () => {
      const persistenceSession = {
        token: 'country-token',
        capitals: [
          { name: 'France', countryId: 'FRA', popular: true },
          { name: 'Germany', countryId: 'DEU', popular: true },
        ],
        startTime: 1234567890,
        used: false,
        gameType: 'country',
      };

      const domainSession = toDomainModel(persistenceSession);

      expect(domainSession.targets).toEqual([
        { name: 'France', countryId: 'FRA', popular: true },
        { name: 'Germany', countryId: 'DEU', popular: true },
      ]);
    });

    it('should handle stadium targets', () => {
      const persistenceSession = {
        token: 'stadium-token',
        capitals: [
          { name: 'Stade de France', city: 'Paris', country: 'France', lat: 48.9244, lng: 2.36 },
          { name: 'Wembley', city: 'London', country: 'UK', lat: 51.556, lng: -0.2795 },
        ],
        startTime: 1234567890,
        used: false,
        gameType: 'stadium',
      };

      const domainSession = toDomainModel(persistenceSession);

      expect(domainSession.targets).toEqual([
        { name: 'Stade de France', city: 'Paris', country: 'France', lat: 48.9244, lng: 2.36 },
        { name: 'Wembley', city: 'London', country: 'UK', lat: 51.556, lng: -0.2795 },
      ]);
    });

    it('should handle civilization targets', () => {
      const persistenceSession = {
        token: 'civ-token',
        capitals: [
          { id: 'roman_empire', name: 'Roman Empire', popular: true },
          { id: 'ottoman_empire', name: 'Ottoman Empire', popular: true },
        ],
        startTime: 1234567890,
        used: false,
        gameType: 'civilization',
      };

      const domainSession = toDomainModel(persistenceSession);

      expect(domainSession.targets).toEqual([
        { id: 'roman_empire', name: 'Roman Empire', popular: true },
        { id: 'ottoman_empire', name: 'Ottoman Empire', popular: true },
      ]);
    });

    it('should preserve optional fields', () => {
      const persistenceSession = {
        token: 'test-token',
        capitals: [],
        startTime: 1234567890,
        used: false,
        gameType: 'classic',
        csrfToken: 'csrf-token',
        playerId: 'player-123',
      };

      const domainSession = toDomainModel(persistenceSession);

      expect(domainSession.csrfToken).toBe('csrf-token');
      expect(domainSession.playerId).toBe('player-123');
    });

    it('should handle empty targets array', () => {
      const persistenceSession = {
        token: 'empty-token',
        capitals: [],
        startTime: 1234567890,
        used: false,
        gameType: 'classic',
      };

      const domainSession = toDomainModel(persistenceSession);

      expect(domainSession.targets).toEqual([]);
    });
  });

  describe('toPersistenceModel', () => {
    it('should convert domain model to persistence model', () => {
      const domainSession = {
        token: 'test-token-123',
        targets: [
          { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
          { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278 },
        ],
        startTime: 1234567890,
        used: false,
        gameType: 'classic',
        csrfToken: 'csrf-123',
      };

      const persistenceSession = toPersistenceModel(domainSession);

      expect(persistenceSession).toEqual({
        token: 'test-token-123',
        capitals: [
          { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
          { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278 },
        ],
        startTime: 1234567890,
        used: false,
        gameType: 'classic',
        csrfToken: 'csrf-123',
      });

      // Verify "targets" field is removed
      expect(persistenceSession).not.toHaveProperty('targets');
      // Verify "capitals" field exists
      expect(persistenceSession).toHaveProperty('capitals');
    });

    it('should be reversible with toDomainModel', () => {
      const original = {
        token: 'test-token',
        capitals: [{ name: 'Paris', country: 'France', lat: 48, lng: 2 }],
        startTime: 1234567890,
        used: false,
        gameType: 'classic',
      };

      // Round trip: persistence → domain → persistence
      const domain = toDomainModel(original);
      const restored = toPersistenceModel(domain);

      expect(restored).toEqual(original);
    });
  });

  describe('isPersistenceModel', () => {
    it('should return true for persistence model', () => {
      const session = {
        token: 'test',
        capitals: [],
        startTime: 123,
        used: false,
        gameType: 'classic',
      };

      expect(isPersistenceModel(session)).toBe(true);
    });

    it('should return false for domain model', () => {
      const session = {
        token: 'test',
        targets: [],
        startTime: 123,
        used: false,
        gameType: 'classic',
      };

      expect(isPersistenceModel(session)).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isPersistenceModel(null)).toBe(false);
      expect(isPersistenceModel(undefined)).toBe(false);
      expect(isPersistenceModel('string')).toBe(false);
      expect(isPersistenceModel(123)).toBe(false);
    });
  });

  describe('isDomainModel', () => {
    it('should return true for domain model', () => {
      const session = {
        token: 'test',
        targets: [],
        startTime: 123,
        used: false,
        gameType: 'classic',
      };

      expect(isDomainModel(session)).toBe(true);
    });

    it('should return false for persistence model', () => {
      const session = {
        token: 'test',
        capitals: [],
        startTime: 123,
        used: false,
        gameType: 'classic',
      };

      expect(isDomainModel(session)).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isDomainModel(null)).toBe(false);
      expect(isDomainModel(undefined)).toBe(false);
      expect(isDomainModel('string')).toBe(false);
      expect(isDomainModel(123)).toBe(false);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve all target data through mapping', () => {
      const originalTargets = [
        {
          name: 'Paris',
          country: 'France',
          lat: 48.8566,
          lng: 2.3522,
          popular: true,
          extraField: 'preserved',
        },
      ];

      const persistence = {
        token: 'test',
        capitals: originalTargets,
        startTime: 123,
        used: false,
        gameType: 'classic',
      };

      const domain = toDomainModel(persistence);

      // Verify deep equality of target data
      expect(domain.targets).toEqual(originalTargets);
      expect(domain.targets[0].extraField).toBe('preserved');
    });

    it('should not mutate original objects', () => {
      const persistence = {
        token: 'test',
        capitals: [{ name: 'Paris' }],
        startTime: 123,
        used: false,
        gameType: 'classic',
      };

      const originalCapitals = persistence.capitals;
      const domain = toDomainModel(persistence);

      // Verify original object is not mutated
      expect(persistence.capitals).toBe(originalCapitals);
      expect(persistence).toHaveProperty('capitals');
    });
  });
});
