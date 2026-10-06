# Persistent Twin — Independent Verifier Adjudication

Date: 2026-10-05
Graph: LUMA-PERSISTENT-TWIN-01

## Decision

**PASS_WITH_RISKS for the code release.**

The release goal is proven by reproducible tests: authenticated learner state is durable and keyed by a verified Firebase UID; direct Firestore client reads are denied; onboarding and event replay are idempotent; server-side scoring ignores a forged client `correctCount`; evidence changes the persisted Next Best Action; and the previous action survives a server round-trip so the route-change explanation remains visible after reload.

## Granite critic

Granite 3.3 returned `PASS_WITH_RISKS`. That verdict is consistent with the release decision. Its useful boundary findings are:

- production Firestore rules still require deployment,
- Coach Studio has not yet been authorized against the learner collection,
- this evidence model is not an anti-cheat certification system.

## Granite verifier discrepancy

Granite 4 returned `core_release_proven=true` and `PASS_WITH_RISKS`, but it also classified the undeployed production rules as a blocker and described a denied Firestore request as client exposure.

Those two statements are not used as release authority:

1. HTTP 403 `PERMISSION_DENIED` demonstrates the direct client path is blocked, not exposed.
2. The graph explicitly scopes this as a code release; production rules deployment is an acknowledged deployment boundary, not a claim made by this release.

## Release authority

The release gate is based on the deterministic evidence:

- `npm run verify`: PASS.
- Unit tests: 27 passed.
- Firestore emulator: 2/2 passed with replay, retry, persisted route-change and isolation assertions.
- Authenticated API smoke: direct Firestore 403, unauthenticated API 401, A/B isolation, event replay idempotency, onboarding retry idempotency, route-change after reload, and server-derived scoring.
- Adaptive browser: 4/4 desktop + mobile.
- Showcase/WCAG: 17/17 Chromium.
- Production dependency audit: 0 vulnerabilities.

No blocking defect remains for the stated code-release scope.
