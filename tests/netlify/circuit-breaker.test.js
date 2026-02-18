import { afterEach, describe, expect, it } from 'vitest';

import {
  getDbBreakerStats,
  isDbBreakerOpen,
  recordDbBreakerShortCircuit,
  recordDbFailure,
  resetDbBreakerForTests,
} from '../../netlify/functions/_circuit-breaker.js';

afterEach(() => {
  resetDbBreakerForTests();
});

describe('db circuit breaker', () => {
  it('opens after threshold of connection failures and tracks counters', () => {
    recordDbFailure(new Error('database connection timeout 1'));
    recordDbFailure(new Error('database connection timeout 2'));

    expect(isDbBreakerOpen()).toBe(false);

    recordDbFailure(new Error('database connection timeout 3'));

    expect(isDbBreakerOpen()).toBe(true);
    const stats = getDbBreakerStats();
    expect(stats.connectionFailures).toBe(3);
    expect(stats.openCount).toBe(1);
    expect(stats.recentFailureCount).toBe(3);
  });

  it('ignores non-connection errors', () => {
    recordDbFailure(new Error('syntax error near select'));

    const stats = getDbBreakerStats();
    expect(stats.connectionFailures).toBe(0);
    expect(stats.openCount).toBe(0);
    expect(stats.recentFailureCount).toBe(0);
    expect(isDbBreakerOpen()).toBe(false);
  });

  it('tracks short-circuit events', () => {
    recordDbBreakerShortCircuit();
    recordDbBreakerShortCircuit();

    expect(getDbBreakerStats().shortCircuitCount).toBe(2);
  });
});
