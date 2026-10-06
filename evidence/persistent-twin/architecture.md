# LUMA Persistent Learning Twin — Architecture Evidence

Date: 2026-10-05
Graph: LUMA-PERSISTENT-TWIN-01

## Product invariant

The authenticated learner's durable learning state is a server-owned projection of verified learning evidence. The learner UI may fall back to the deterministic local projection when offline or unauthenticated, but browser storage is not authoritative for an authenticated learner.

## Source of truth

Authenticated learner:
- Materialized state: `learners/{uid}`
- Append-only evidence ledger: `learners/{uid}/events/{eventId}`
- Authority: Firebase Admin SDK inside Next.js Node route handlers.
- Identity boundary: Firebase ID token is verified server-side; the document key comes from the verified token UID, never a learner ID supplied by the browser.

Guest/demo learner:
- Deterministic local projection remains available so the showcase and unauthenticated product are usable.
- Local state is explicitly a fallback, not the authenticated source of truth.

## Write path

1. Onboarding creates the initial deterministic LearnerState.
2. Authenticated onboarding PUTs to `/api/learning/plan`.
3. The server materializes the record under the verified UID.
4. A practice produces a client event with a unique `eventId` and raw answers.
5. The client keeps a pending local receipt until persistence succeeds.
6. `/api/learning/events` verifies the ID token and recomputes the score from the answer key.
7. A Firestore transaction checks `events/{eventId}`.
8. New event: append ledger event + update materialized learner state and version.
9. Replay: return the current projection without applying the event a second time.
10. The Next Best Action is recomputed from the server-owned state.

## Security boundaries

- Firestore client rules are deny-all.
- Browser clients do not write the learner collection directly.
- API routes use Firebase Admin and verified Firebase ID tokens.
- A browser-provided `correctCount` is not trusted; the server derives the result from submitted answer IDs.
- Learner identity is derived from the verified token.
- Production dependency audit: 0 vulnerabilities after compatible transitive overrides.

## Resilience

- The practice receipt is written locally first.
- For authenticated learners, an unsynced event is kept as `luma-pending-learning-event`.
- The learner home retries the pending event before fetching the persistent plan.
- Replays are safe because `eventId` is idempotent.

## Verified behaviors

- Unauthenticated learning-plan request: 401.
- Two Firebase-authenticated emulator users are isolated.
- Firestore materialized state persists independently for each UID.
- Duplicate evidence replay leaves the learner version unchanged.
- Successful P.A.S. evidence changes the Next Best Action.
- Client-declared scoring cannot override the server rubric.
- Canonical A/B/C adaptive behavior remains green on desktop and mobile.
- Existing showcase and WCAG regression remain green.

## Explicit remaining boundary

The learner is now backed by one durable authority, but the current Coach Studio demo still uses its existing showcase intelligence rather than this authenticated learner collection. Unifying coach and learner reads requires a role-authorized coach API/custom-claims policy and is intentionally not exposed without that authorization layer.

Production Firestore rules also need to be deployed with the application release; emulator verification proves behavior but is not evidence that the production ruleset is already active.

## Hardening after Producer baseline

The release verifier added four durability/integrity guarantees before graph closure:

- Repeating the same onboarding payload for the same `journeyId` is transactionally idempotent and does not reset learner version.
- The materialized learner record stores the prior ranked action when evidence changes the route, so `Tu ruta cambió` survives a server round-trip and reload.
- Attempt telemetry is reduced to known P.A.S. keys and bounded non-negative integers before it enters the ledger.
- The authenticated API smoke directly probes Firestore without credentials and requires HTTP 403, in addition to requiring API 401 without a Firebase token.

These checks strengthen the persistent source of truth without changing the deterministic learning engine.
