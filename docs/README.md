# Docs Index

This folder is intentionally minimal and only keeps operational documentation that still maps to the current codebase.

## Kept

- `docs/architecture.md` — current coordinator boundaries and module responsibilities.
- `docs/architecture/submit-flow.md` — Netlify submit handler module boundaries and request path.
- `docs/event-bus.md` — canonical EventBus contract usage.
- `docs/ui-flow.md` — UX flow overview across core modules.
- `docs/analytics-events.md` — production analytics event inventory.
- `docs/ENVIRONMENTS.md` — local vs production environment behavior.
- `docs/release-checklist.md` — shipping gates to run before release.
- `docs/database-migrations.md` — migration policy and apply/verify runbook.
- `docs/operations.md` — submit/runtime operations, idempotency, alerts, and incident checks.
- `docs/remediation-program-roadmap.md` — sprint-by-sprint remediation implementation plan.
- `docs/remediation-traceability-matrix.md` — finding-to-work-to-evidence mapping.
- `docs/remediation-definition-of-done.md` — strict completion policy (no half-done sprints).
- `docs/remediation-risk-register.md` — risk tracking and residual-risk targets.
- `docs/legacy-surface-inventory.md` — tracked compatibility surfaces and removal guardrails.

## Cleanup policy

- Remove docs that are post-mortem, one-off verification notes, or stale plans.
- Prefer short, source-of-truth docs over long snapshot documents that drift quickly.
