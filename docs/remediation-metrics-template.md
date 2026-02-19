# Remediation Metrics Template

## Metadata

- Date: 2026-02-19
- Branch: `fix/retry-queue-drop-terminal-401`
- Commit SHA: `5f34e058736ec5737168312b20e8b903ae93e1cd`
- Environment: Local workspace sandbox (`/home/yvanf/projects/point-the-map`)
- Operator: Codex

## Pre-Flight Baseline

### Submit endpoint baseline

- Function log p50 (ms): Not captured (no production/staging function log access in sandbox).
- Function log p95 (ms): Not captured (no production/staging function log access in sandbox).
- Local benchmark command: `npm run bench:submit:local -- --runs=100`
- Local benchmark p50 (ms): `0.145`
- Local benchmark p95 (ms): `0.525`
- Session cleanup executions/request: `0.46` (local synthetic in-process benchmark)

### Frontend baseline

- First-load CSS request count: `1` blocking stylesheet tag in built `dist/index.html`.
- Lighthouse FCP (ms): Not captured (`lighthouse` not installed in environment).
- Lighthouse LCP (ms): Not captured (`lighthouse` not installed in environment).
- Lighthouse blocking resources: Not captured (`lighthouse` not installed in environment).

## Gate Evidence

### Gate A (PR2 + PR3)

- Tests run:
  - `npm run typecheck`
  - `npx vitest run lib/config/game-modes.test.js lib/schemas/mode-enum.test.js lib/game-math/index.test.js`
- Result: Pass
- Notes: Typecheck blocker in `lib/config/game-modes.js` JSDoc placement was fixed; schema/scoring tests green.

### Gate B (PR4 + PR5)

- Before benchmark file: Not available (no pre-change benchmark artifact in sandbox).
- After benchmark file: `/tmp/submit-benchmark-local-after.json`
- Comparison command: `node scripts/bench/compare-submit-benchmark.mjs --before=<before.json> --after=<after.json>`
- p95 delta (ms): Not computed (missing baseline)
- p95 delta (%): Not computed (missing baseline)
- Pass threshold (`<= +20%` and `<= +200ms`): Not evaluated (missing baseline)
- Notes:
  - Boundary checks passed via `npm run check:boundaries`.
  - Data-layer direction + wrapper enforcement completed.
  - Local synthetic benchmark path added to avoid Netlify linking requirement.
  - Synthetic benchmark result: `p50=0.145ms`, `p95=0.525ms`, cleanup executions/request=`0.46`.

### Gate C (PR6 + PR8)

- Tests run:
  - `npm run test:run`
  - `npm run e2e:smoke`
- Timer/UX verification: `src/systems/TimerSystem.test.js` green (elapsed-time/tick behavior), smoke gameplay path green.
- Result: Pass
- Notes: Full Vitest run passed (`53` files, `941` tests).

### Gate D (PR9)

- Build result: Pass (`npm run build`)
- Visual regression result: Pass (`E2E_MODE=preview npx playwright test tests/e2e/visual-regression.spec.js --project=chromium`, `3` passed)
- CSS import check result: Pass (`Built CSS import check OK (2 files)`)
- CSP/regression notes: No unresolved CSS `@import` in built artifacts; no CSP regressions observed in local checks.

## Rollback Checks

- Workstream C rollback triggered? no
- Workstream E rollback triggered? no
- Workstream G rollback triggered? no
- If yes, remediation applied: n/a
