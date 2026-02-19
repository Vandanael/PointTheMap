import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  shouldRunSessionCleanup,
  cleanupExpiredSessions,
  __testOnlyResetSessionCleanupState,
} from '../../netlify/functions/_session-cleanup.js';

describe('session cleanup sampling', () => {
  beforeEach(() => {
    __testOnlyResetSessionCleanupState();
  });

  it('runs when sample and interval conditions are met', () => {
    const run = shouldRunSessionCleanup({
      scope: 'start',
      now: 1000,
      minIntervalMs: 500,
      sampleRate: 1,
      random: () => 0,
    });
    expect(run).toBe(true);
  });

  it('skips when interval gate is not satisfied', () => {
    expect(
      shouldRunSessionCleanup({
        scope: 'submit',
        now: 1000,
        minIntervalMs: 5000,
        sampleRate: 1,
        random: () => 0,
      })
    ).toBe(true);

    expect(
      shouldRunSessionCleanup({
        scope: 'submit',
        now: 1500,
        minIntervalMs: 5000,
        sampleRate: 1,
        random: () => 0,
      })
    ).toBe(false);
  });

  it('skips when sample check fails', () => {
    const run = shouldRunSessionCleanup({
      scope: 'start',
      now: 1000,
      minIntervalMs: 500,
      sampleRate: 0.1,
      random: () => 0.9,
    });
    expect(run).toBe(false);
  });

  it('cleanup query failure does not throw', async () => {
    const sql = Object.assign(
      vi.fn(async () => {
        throw new Error('db down');
      }),
      {
        raw: true,
      }
    );
    const logger = { warn: vi.fn(), debug: vi.fn() };

    const ran = await cleanupExpiredSessions({
      sql: (...args) => sql(...args),
      logger,
      scope: 'start',
      now: 1000,
      sampleRate: 1,
      random: () => 0,
    });

    expect(ran).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });
});
