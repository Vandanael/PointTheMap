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
```bash
# Test any deployed URL (production, preview, branch deploy)
npm run e2e:deploy -- <url>

# Examples:
npm run e2e:deploy -- https://pointthemap.net
npm run e2e:deploy -- https://deploy-preview-123--pointthemap.netlify.app

# Run only smoke tests on deployment
./scripts/e2e-deploy.sh https://pointthemap.net --smoke

# Run specific test on deployment
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
      - run: npm run e2e:dev
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
  await page.waitForFunction(
    () => document.body.dataset.appReady === 'true',
    { timeout: 30000 }
  );

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

### After Each Deploy
1. Check Netlify deploy log for build success
2. Run smoke tests: `npm run e2e:deploy -- <url> --smoke`
3. If smoke tests pass, deployment is healthy
4. For major changes, run full E2E suite

### Quick Health Check
```bash
# 30-second smoke test on production
./scripts/e2e-deploy.sh https://pointthemap.net --smoke
```

This catches 90% of critical issues (initialization errors, mode crashes, UI rendering).
