#!/bin/bash
# E2E testing script for Netlify deployments
# Usage:
#   ./scripts/e2e-deploy.sh <url>                    # Run all E2E tests
#   ./scripts/e2e-deploy.sh <url> --smoke            # Run only smoke tests
#   ./scripts/e2e-deploy.sh <url> --test country    # Run specific test
#
# Examples:
#   ./scripts/e2e-deploy.sh https://deploy-preview-123--pointthemap.netlify.app
#   ./scripts/e2e-deploy.sh https://pointthemap.net --smoke

set -e

URL="${1}"
MODE="${2:-all}"
TEST_FILE="${3:-}"

if [ -z "$URL" ]; then
  echo "❌ Error: URL is required"
  echo ""
  echo "Usage:"
  echo "  ./scripts/e2e-deploy.sh <url>                    # Run all E2E tests"
  echo "  ./scripts/e2e-deploy.sh <url> --smoke            # Run only smoke tests"
  echo "  ./scripts/e2e-deploy.sh <url> --test <testname>  # Run specific test"
  echo ""
  echo "Examples:"
  echo "  ./scripts/e2e-deploy.sh https://deploy-preview-123--pointthemap.netlify.app"
  echo "  ./scripts/e2e-deploy.sh https://pointthemap.net --smoke"
  echo "  ./scripts/e2e-deploy.sh https://pointthemap.net --test country-mode"
  exit 1
fi

echo "🚀 Running E2E tests against: $URL"
echo ""

# Set environment variables for Playwright
export E2E_MODE=preview
export E2E_BASE_URL="$URL"

case "$MODE" in
  --smoke)
    echo "📋 Running smoke tests..."
    npx playwright test --grep @smoke
    ;;
  --test)
    if [ -z "$TEST_FILE" ]; then
      echo "❌ Error: Test name required with --test"
      exit 1
    fi
    echo "📋 Running test: $TEST_FILE"
    npx playwright test "tests/e2e/${TEST_FILE}.spec.js"
    ;;
  all|*)
    echo "📋 Running all E2E tests..."
    npx playwright test
    ;;
esac

echo ""
echo "✅ E2E tests completed successfully!"
