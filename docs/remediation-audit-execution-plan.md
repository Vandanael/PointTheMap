# Audit Remediation Execution Plan

## Summary

Implement validated audit remediations in strict safety order:

1. Remove consistency risks in shared config/schema/scoring and cleanup hot path.
2. Apply architecture/maintainability refactors (boundaries, timer, CSS/i18n modularization).
3. Keep gameplay behavior stable and all tests green.

## Pre-Flight Baseline (Mandatory)

### Submit baseline

1. Capture function metrics p50/p95 from logs.
2. Run local benchmark with fixed payload (`N=100`): `npm run bench:submit -- --runs=100`.
3. Count cleanup executions per request in sampled logs.
4. Local fallback when Netlify runtime is unavailable: `npm run bench:submit:local -- --runs=100`.

### Frontend baseline

1. Record first-load CSS request count on production preview.
2. Run one Lighthouse pass and capture FCP/LCP and blocking resources.

Use `docs/remediation-metrics-template.md` for evidence.

## Workstreams and PR Slices

### PR1: Baseline and Guard Rails

1. Benchmark script for `/submit`.
2. Pre/post metrics template.
3. Visual baseline capture instructions for start/map/result screens.

### PR2: Workstream A (Mode Enum DRY)

1. Add `MODE_VALUES` in `lib/config/game-modes.js`.
2. Add `lib/schemas/_mode-enum.js` helper (non-empty tuple-safe for Zod).
3. Replace duplicated mode arrays in:
   - `lib/schemas/start.js`
   - `lib/schemas/submit.js`
   - `lib/schemas/leaderboard.js`

### PR3: Workstream B (Scoring Canonicalization)

1. `calculateScoreV2` defaults to canonical `SCORING_FORMULA`.
2. Keep override support for tests.

### PR4: Workstream C (Session Cleanup Sampling)

1. Add `netlify/functions/_session-cleanup.js`.
2. Replace per-request cleanup in:
   - `netlify/functions/start.js`
   - `netlify/functions/submit/database.js`
3. Dual gate:
   - in-memory interval (`lastRunAt`)
   - probabilistic sampling (cold-start resilient)

### PR5: Workstream D (Data Layer Direction Fix)

1. Canonical raw datasets in `lib/data/*`.
2. `src/data/*` kept as thin client wrappers.
3. Enforce boundaries:
   - server functions cannot import `src/**`
   - `lib/data/**` cannot import client utilities

### PR6: Workstream F (Architecture Nits + SessionModel)

1. API boundary guard: whitelist mapping only, no object spread from DB rows.
2. Add contract checks to prevent internal DB key leaks.
3. Fix direct import in `lib/config/visual-constants.js`.

### PR7: Workstream E (Timer Elapsed-Time Refactor)

1. Elapsed-time timer based on `performance.now()` with `Date.now()` fallback.
2. Remaining time derived from `now - startedAt`.
3. Remove `tickCount * 50` dependencies.

### PR8: Workstream E (Tick Interval Tuning + UX)

1. Tick interval from `50ms` to `100ms`.
2. If stutter appears, use hybrid:
   - logic tick `100ms`
   - UI interpolation with `requestAnimationFrame`

### PR9: Workstream G (Modularization + CSS Cascade)

1. Split `src/styles/styles.css` into modules preserving cascade order.
2. Split `src/i18n.js` while preserving public API.
3. Run visual regression on start/map/result screens.

## Hard Gates

### Gate A (after PR2 + PR3)

Schema/scoring stable and deploy-safe.

### Gate B (after PR4 + PR5)

Backend latency/boundaries improved and deploy-safe.

### Gate C (after PR6 + PR8)

Architecture/timer stable and deploy-safe.

### Gate D (after PR9)

UI/build integrity validated and final deploy-safe.

## Stop and Rollback Conditions

1. Workstream C: `/submit` p95 regression above `+20%` or `+200ms`.
2. Workstream E: measurable stutter or timing visual failures.
3. Workstream G: CSP/build regression, extra blocking CSS requests, or unresolved `@import`.

## Execution Status (2026-02-19)

1. Code increments for PR2-PR9 are implemented in this branch and validated by local quality gates.
2. Gate A/C/D evidence is captured in `docs/remediation-metrics-template.md`.
3. Gate B boundary checks are captured and local synthetic benchmark evidence is captured in `docs/remediation-metrics-template.md` (`bench:submit:local`).
