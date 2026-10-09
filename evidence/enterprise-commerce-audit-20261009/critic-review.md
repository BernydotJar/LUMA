# LUMA 2026-10-09 — Adversarial Critic / Independent-Verification Boundary

**Scope:** New commerce access trace, modelled provider economics, explainable learner risk, CSS build regression, and enterprise decision materials.

## Producer

Selected changes that preserve the existing commerce adapters and enrollment domain. Added configurable economics, trace with authorized global administrator and tenant validation, evidence-gated learner risk, documentation and minimum CSS/compiler corrections.

## Critic — findings and outcome

| Test target | Attacker / failure case | Fix, test and remaining gap |
| --- | --- | --- |
| Economics | User omits merchant rates or supplies invalid refunds | Reject all null/undefined/negative values, require sum of refund and chargeback rates <= 100; unit tests PASS |
| Data leakage | Query valid entitlement ID under wrong tenant | Reject missing tenant entitlement, do not fetch mismatched learner Twin or echo raw event buyer email; mock tests PASS |
| Auth bypass | Unauthenticated or invalid Firebase token reaches access trace | Global admin is required; invalid token maps to 401. Real Firebase Auth emulator integration pending |
| Risk false evidence | Initial onboarding model projects low mastery without genuine scored practice | Risk uses explicit insufficient-evidence state and verified practice event gating; unit tests PASS |
| Out-of-order/repeated commerce | Duplicate purchase/refund, Stripe invoice aliases, late payment and cancellation | Existing tests cover adapter mapping and orchestrator structure; 44 actual Firestore emulator tests SKIPPED because Firebase CLI requires Java 21, sandbox has Java 17 |
| Webhook replay/forgery | Invalid HMAC or Hottok, bounced deliveries | Existing signed adapter and webhook-security tests PASS; merchant sandbox receipt NOT YET VERIFIED |
| Operational failure | Firestore down, provider unavailable or permanent webhook failure | Retryable code paths inspected; injection, alerting and reconciliation owner NOT YET VERIFIED |
| Commercial misuse | Claim Stripe always cheaper | No rates hard-coded; all fees customer inputs, no price savings claim |
| Real learner IDOR | Public sample route and protected back-office scopes | `/studio/learners/mariana` renders sample publicly; connecting real PII requires server-side coach/tenant guard. Pilot BLOCKER |
| Learning entitlement bypass | Direct learning endpoint with only Firebase identity | Tenant/program entitlement enforcement across full learner API surfaces requires pilot authorization audit. Pilot BLOCKER |
| Reliability/marketing | Infer active learner capacity from HTTP concurrency=80 | Explicitly prohibited; measured load, tested recovery, actual costs absent. Pilot BLOCKER |
| E2E flakiness | Enterprise route pass after timeout | Browser smoke had two clean passes and one flaky retry; NOT a clean E2E gate |
| Build | CSS Module invalid global html selector + memory-limited Turbopack | Move global style into global CSS; use validated Webpack build. `npm run build` PASS |
| Invoice/accounting | Model equals actual settlement | Not claimed; tax, FX, additional dispute fees, AI costs and settlement timing excluded explicitly |

## Independent verifier status

Unit verification and compiler/build were performed using tools separate from the code authoring logic, and results are captured verbatim in logs. **This does not constitute an organizationally independent adversarial reviewer or provider sandbox acceptance.** Independent external Graph Harness reviewer and live merchant/tenant/recovery gates remain PENDING. No fictitious independent PASS or deployment approval was recorded.

**Release Gate:** SOURCE_REVIEW_READY; ENTERPRISE_PILOT_BLOCKED. Approval cannot be inferred from this evidence pack.

## Continuing hardening slice — 2026-10-09

- **Producer:** Opt-in `entitled` access policy now checks a verified Firebase UID, purchaser email, configured tenant, effective active enrollment and expiration for authenticated learner plan/events, tutor and Content Intelligence. The default `showcase` mode deliberately preserves public demo behavior.
- **Critic:** Repeated authorization checks must fail closed on invalid tenant configuration, unverified email, revoked/expired enrollment, wrong tenant or absent Firestore; unit tests added. `claimByEmail` now supports tenant filtering so a login to tenant A does not automatically link all eligible tenant B enrollments.
- **Fixer:** Tutor client passes bearer token for signed-in users and displays friendly auth/entitlement messages; `test.slow()` addresses the known first cold Playwright test timeout, but browser retry must be measured again.
- **Independent-verifier evidence:** 197 unit tests pass and 44 Firestore emulator tests remain skipped locally (Java 17); TypeScript/ESLint pass. Next.js Webpack compiled all pages, TypeScript and static generation, but file tracing ended with ENOMEM. Do not mark build PASS for this hardening slice based solely on prior build success.
- **Graph Harness:** Existing append-only ledger validated at event #631, checkpoint `855aa600-8745-4af9-8800-ed8a265a8b71`. No independent reviewer or enterprise readiness release pass fabricated.
- **Remaining blocking findings:** Real learner state is keyed globally by Firebase UID rather than tenant/program; RAG corpus query is not independently proven tenant-partitioned; provider credentials/signed receipts, cross-tenant penetration tests, load, backup/restore and local emulator validation are outstanding.

**Gate:** source candidate remains under review; pilot activation and real-money checkout remain BLOCKED.
