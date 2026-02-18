# Operations Runbook

## API Envelope
All function responses use:
- Success: `{ ok: true, data, meta? }`
- Error: `{ ok: false, error: { code, message, details? } }`

Response header: `x-api-version: 2`.

## Submit Idempotency
- `scores.session_token` is unique and non-null.
- Re-submitting the same session token returns a replayed success response only after session and CSRF validation.
- Replay responses include `meta.idempotentReplay = true`.

## Submit Auth and Session Retention
- `submit` validates session token + CSRF token before any replay response is returned.
- Successful submissions do not immediately delete the backing session row; session is retained until TTL expiry to allow secure idempotent replay with CSRF validation.
- Session rows are cleaned up opportunistically by `start`/`submit` (`DELETE ... WHERE expires_at <= NOW()`) and can be cleaned by periodic DB maintenance jobs.
- If replay must be disabled temporarily during incident response, keep score insert path enabled and return `session_used` for repeated submits.

## Key Operational Signals
Track these counters from logs/metrics:
- `submit.idempotent_replay`
- `csrf_mismatch`
- `db_connection_error`
- `rate_limited`
- `invalid_payload`
- `token.issued`
- `token.rate_limited`
- `submit.bypass_blocked`
- `submit.pseudo_lock_conflict`

## Common Incident Checks
1. `db_connection_error` spike:
- Verify `NETLIFY_DATABASE_URL` and Neon status.
- Check circuit breaker behavior in `netlify/functions/_circuit-breaker.js`.

2. Unexpected leaderboard drift:
- Confirm UTC day boundary behavior in `netlify/functions/leaderboard.js`.

3. Duplicate-score suspicion:
- Verify `scores_session_token_unique` exists.
- Query duplicates by `session_token` (should be zero).

## SLO / Alert Baselines
Use these as initial alert thresholds (rolling 15-minute windows unless noted):
- Availability SLO (critical functions): `>= 99.5%` success.
- `submit` 5xx rate: alert at `> 2%`.
- `generate-player-token` 5xx rate: alert at `> 1%`.
- `service_unavailable` (`submit` breaker short-circuit): alert at `>= 10` events / 15m.
- `db_connection_error` aggregate: alert at `>= 20` events / 15m.
- `token.rate_limited`: warn-only trend alert at `>= 100` events / hour.
- `submit.pseudo_lock_conflict`: warn-only trend alert at `>= 50` events / hour.

## Runbook Drills
Run quarterly in staging and document results:
1. DB outage drill:
- Simulate DB unavailability.
- Verify `submit` returns stable `503` envelopes and breaker short-circuits.
- Confirm alert triggers and runbook paging path.
2. Abuse spike drill:
- Simulate token endpoint burst traffic.
- Verify `429` envelopes and rate-limit headers.
- Confirm trend alerts for `token.rate_limited`.
3. Error-report privacy drill:
- Submit payload with query params, email, IP, token-like strings.
- Verify stored `error_logs` values are redacted and URLs are query-free.
- Verify retention cleanup endpoint removes old rows.

## Tracking / Privacy Baseline
- Plausible analytics runs in production without consent banner (cookieless policy baseline).
- Respect global privacy signals by default: GPC (`navigator.globalPrivacyControl`) and DNT (`doNotTrack`).
- Error monitoring uses `VITE_ERROR_MONITORING_SAMPLE_RATE` (default `1`) to cap telemetry volume.
- `/.netlify/functions/error-report` is write-only on hot path; retention deletion is handled by `/.netlify/functions/cleanup-error-logs`.

## Remediation Governance Links
- `docs/remediation-program-roadmap.md`
- `docs/remediation-traceability-matrix.md`
- `docs/remediation-definition-of-done.md`
- `docs/remediation-risk-register.md`
