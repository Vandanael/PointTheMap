# E2E Testing Guide

This project uses Playwright for end-to-end testing to ensure all game modes work correctly.

## Quick Start

### Test Locally (Dev Server)

```bash
# Run all E2E tests
npm run e2e:dev

# Run only smoke tests (fast)
npm run e2e:smoke

# Run specific test file
npm run e2e:dev tests/e2e/country-mode.spec.js
```

### Test Production Build

```bash
# Build and test production preview
npm run e2e:preview
```

### Test Netlify Deployment

The E2E tests work for **both pre-production and production** - same tests, different URLs.

#### Deploy Previews (Pre-production) - Full Suite Recommended

```bash
# Run ALL 12 E2E tests before merging (~1-2 minutes)
./scripts/e2e-deploy.sh https://deploy-preview-123--pointthemap.netlify.app

# Or just smoke tests for quick check
./scripts/e2e-deploy.sh https://deploy-preview-123--pointthemap.netlify.app --smoke
```

**Why full suite?** Catches bugs before they reach production.

#### Production Deploys - Smoke Tests Recommended

```bash
# Quick health check after production deploy (~30 seconds)
./scripts/e2e-deploy.sh https://pointthemap.net --smoke

# Run full suite if smoke tests fail or for major releases
./scripts/e2e-deploy.sh https://pointthemap.net
```

**Why smoke only?** Fast verification that critical paths work. Run full suite if issues detected.

#### Specific Test on Any Environment

```bash
# Test specific functionality (e.g., country mode fix)
./scripts/e2e-deploy.sh https://pointthemap.net --test country-mode
```

## Test Coverage

### Critical Paths (Smoke Tests)

- ✅ **smoke.spec.js** - Classic game flow (@smoke tag)

### Game Modes

- ✅ **country-mode.spec.js** - Country mode loads and accepts clicks
- ✅ **start-modes.spec.js** - All game mode selection works
  - Capitals mode
  - Countries mode
  - Civilizations mode
  - Stadiums mode
- ✅ **daily-mode.spec.js** - Daily challenge mode

### Game Flow

- ✅ **game-flow.spec.js** - Complete classic game flow
- ✅ **submit-flow.spec.js** - Score submission (mocked)
- ✅ **resume.spec.js** - Resume/discard in-progress games

## Debugging Failed Tests

### View Test Results

```bash
# Show last test report
npx playwright show-report

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests with debug mode
npx playwright test --debug
```

### Common Issues

#### Question Modal Not Appearing

**Symptom:** Test fails waiting for `#question-modal`
**Cause:** Missing i18n functions (getCountryDisplayName, getStadiumName)
**Fix:** Ensure all i18n functions are properly imported in bootstrap.js

#### App Init Timeout

**Symptom:** Test fails waiting for `appReady`
**Cause:** JavaScript error during initialization
**Fix:** Check browser console logs in test output

#### Map Click Not Registering

**Symptom:** Test times out on map click
**Cause:** GeoJSON not loaded or map not initialized
**Fix:** Check MapSystem initialization and GeoJSON loading

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - id: resolve_preview
        run: node scripts/ci/resolve-preview-url.mjs
      - env:
          E2E_BASE_URL: ${{ steps.resolve_preview.outputs.preview_url }}
        run: node scripts/ci/preflight-e2e-target.mjs
      - env:
          E2E_BASE_URL: ${{ steps.resolve_preview.outputs.preview_url }}
        run: npm run e2e:preview
```

### Netlify Post-Deploy Hook

Test deployments automatically after Netlify builds:

```bash
# In Netlify UI: Site settings > Build & deploy > Post processing > Snippet injection
# Or use Netlify Build Plugins
```

## Writing New Tests

### Test Structure

```javascript
import { test, expect } from '@playwright/test';

test('test name', async ({ page }) => {
  // 1. Navigate and wait for app ready
  await page.goto('/');
  await page.waitForFunction(() => document.body.dataset.appReady === 'true', { timeout: 30000 });

  // 2. Interact with UI
  await page.locator('#start-modal').click();

  // 3. Assert expected behavior
  await expect(page.locator('#question-modal')).toBeVisible();
});
```

### Smoke Test Tag

Add `@smoke` to critical tests:

```javascript
test('critical path @smoke', async ({ page }) => {
  // ...
});
```

## Monitoring Deployments

### Testing Strategy Summary

**The same E2E tests run against any URL - the tests don't change, only the target environment.**

| Environment      | Recommended Tests | Duration | When to Run                  |
| ---------------- | ----------------- | -------- | ---------------------------- |
| Deploy Preview   | Full suite (12)   | 1-2 min  | Before merging PR            |
| Production       | Smoke tests (2)   | 30 sec   | After each production deploy |
| Production (bug) | Full suite (12)   | 1-2 min  | When smoke tests fail        |

### After Each Deploy

**Deploy Previews:**

1. Check Netlify deploy log for build success
2. Run full E2E suite: `./scripts/e2e-deploy.sh <preview-url>`
3. If all tests pass, safe to merge
4. For quick check: `./scripts/e2e-deploy.sh <preview-url> --smoke`

**Production:**

1. Check Netlify deploy log for build success
2. Run smoke tests: `./scripts/e2e-deploy.sh https://pointthemap.net --smoke`
3. If smoke tests pass, deployment is healthy ✅
4. If smoke tests fail, run full suite to identify issue

### Quick Health Check

```bash
# 30-second smoke test on production
./scripts/e2e-deploy.sh https://pointthemap.net --smoke
```

This catches 90% of critical issues (initialization errors, mode crashes, UI rendering).
