# Submit Flow Architecture

## Purpose

`netlify/functions/submit.js` is now an orchestration entrypoint for score submission.
It delegates each concern to focused modules under `netlify/functions/submit/`.

## Module ownership

| Module | Responsibility |
|---|---|
| `submit.js` | Request orchestration, dependency wiring, top-level error catch |
| `helpers.js` | Metrics envelope, error envelope adapter, idempotent replay helper |
| `database.js` | DB client init + best-effort session TTL cleanup |
| `guards.js` | Circuit-breaker gate + rate-limit gate |
| `payload.js` | Body parse + schema validation + payload normalization |
| `session.js` | Active session lookup + persistence-to-domain mapping |
| `sessionGuards.js` | CSRF/session/game-type/time-based guard checks |
| `rounds.js` | Round validation, plausibility check, scoring + total score |
| `pseudoLock.js` | Pseudo lock enforcement by IP |
| `transaction.js` | Atomic persistence, rank lookup, replay-on-unique-conflict path |

## Request path

1. `submit.js` validates HTTP method and production bypass constraints.
2. `database.js` initializes SQL and performs stale-session cleanup.
3. `guards.js` enforces breaker/rate-limit (or bypass path).
4. `payload.js` parses and validates request body.
5. `session.js` loads active session.
6. `sessionGuards.js` enforces CSRF/replay/game-type/timing checks.
7. `rounds.js` validates/scales rounds and computes score payload.
8. `pseudoLock.js` enforces pseudo ownership per IP.
9. `transaction.js` commits results and calculates rank.
10. `helpers.js` metrics wrapper emits standardized success/reject/failure telemetry.

## Invariants

- **Idempotent replay:** duplicate submit transaction conflicts return stored score payload when available.
- **Single-use session:** used or expired sessions are rejected.
- **Protected hot paths:** rank query and rate-limit cleanup queries are covered by index guard tests.
- **Bypass isolation:** E2E bypass is blocked in production and only affects guard path behavior.

## Operational notes

- Main file-size governance is enforced by `scripts/ci/check-file-size-governance.mjs`.
- Submit module boundaries are protected by `scripts/ci/check-function-import-boundaries.mjs`.
- End-to-end verification gates remain in CI/local release flow:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:run`
  - `npm run build`
