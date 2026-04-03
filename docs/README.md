# Docs Index

This folder keeps operational and product documentation that maps to the current codebase.

## Product & Feature Specs

- `docs/product-spec.md` — Game overview: modes, scoring summary, player journey, environment notes. Start here for product handover.
- `docs/scoring-spec.md` — Authoritative scoring spec: sigmoid formula, time bonus, category thresholds, server validation.

## Architecture

- `docs/architecture.md` — Coordinator pattern, module boundaries, key rules for `src/app/`.
- `docs/architecture/submit-flow.md` — Netlify submit handler module boundaries and request path.

## Developer Reference

- `docs/event-bus.md` — Canonical EventBus contract (single source: `src/core/eventTypes.js`).
- `docs/ui-flow.md` — UX flow across core modules (Start → Round Loop → Game Over).
- `docs/analytics-events.md` — Production Plausible event inventory.
- `docs/ENVIRONMENTS.md` — Local dev vs production behavior (mock API, CSP, env vars).

## Operations

- `docs/operations.md` — API envelope, submit idempotency, auth/session retention, SLO baselines, incident checks, runbook drills, privacy baseline.
- `docs/release-checklist.md` — Pre-release gates to run before every ship.
- `docs/database-migrations.md` — Migration policy (append-only) and apply/verify runbook.

## Governance (Remediation Archive)

These docs record the completed remediation program (11 sprints, all findings resolved). Reference-only; do not modify.

- `docs/legacy-surface-inventory.md` — Legacy compatibility surfaces, removal guardrails.
- `docs/remediation-program-roadmap.md` — Sprint-by-sprint delivery plan.
- `docs/remediation-traceability-matrix.md` — Finding-to-work-to-evidence mapping.
- `docs/remediation-definition-of-done.md` — Sprint completion policy.
- `docs/remediation-risk-register.md` — Risk tracking and residual-risk targets.
- `docs/remediation-audit-execution-plan.md` — Gated execution plan and execution status.
- `docs/remediation-metrics-template.md` — Pre/post baseline and gate evidence.

## Cleanup Policy

- Remove docs that are post-mortem, one-off verification notes, or stale plans.
- Prefer short, source-of-truth docs over long snapshot documents that drift quickly.
- Remediation governance docs are archived — do not add new entries; the program is complete.
