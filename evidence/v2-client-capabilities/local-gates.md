# LUMA V2 Client Capabilities — Local Gate Receipt

Product baseline: `0cf029b2d107bb95deb18cad921a17ae8033be82` (Liquid Glass v3 plus the integrated product-preview route).

## Deterministic gates

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm run test:run`: 120 PASS; 23 Firestore-emulator tests intentionally skipped outside emulator.
- Firestore stateful gate: 23/23 PASS across ProviderEvent ledger (8), commerce enrollment orchestration (6), live program delivery (6), persistent Learning Twin store (3).
- Production build: PASS; Next.js generated 36 routes including the new commerce, program delivery, engagement, content-intelligence and health endpoints.
- `npm audit --omit=dev --audit-level=high`: 0 production vulnerabilities.
- Focused Playwright capability/WCAG/Spanish gate: 15 PASS, 1 expected mobile skip.
- Full Playwright regression on the final rebased baseline: 81 PASS, 5 expected skips, 0 failed. The WCAG sweep explicitly waits for the canonical `/` → `/learn` redirect before Axe analysis.

## Full local browser regression

A prior shared-workstation run exposed retry-only flakes under parallel load. After rebasing onto Liquid Glass v3 and cleaning the runner, the full Playwright regression completed with final status `passed` and zero failed tests. Isolated GitHub Actions CI remains the authoritative release browser gate.

## Release rule

No new graph node is promoted to DONE from this receipt alone. Final graph closure requires isolated CI plus independent code/security review on the exact remote product commit.


## Independent-review repair cycle

The first Codex review found four actionable defects and the fixer adds regression coverage for each:

- preserve tenant + program scope when returning private live-session metadata;
- paginate the entire learner cohort so the oldest/inactive learners are not dropped from intervention ranking;
- reject non-finite live-session durations;
- bind Stripe invoice subscription lifecycle events by subscription ID before per-invoice PaymentIntent IDs.

Fixer gates: 115 unit/integration PASS, 21/21 Firestore stateful PASS, production build PASS, production audit 0 vulnerabilities, and 13 targeted capability/WCAG browser tests PASS with 1 expected mobile WCAG skip. Full browser regression is delegated to isolated GitHub Actions for the exact fixer commit because the shared workstation became resource-saturated during the parallel full-suite run.


## Second independent-review repair cycle

The second Codex code review identified five additional edge cases; all are repaired with regression coverage:

- Hotmart `SUBSCRIPTION_CANCELLATION` reads the documented top-level `data.subscriber` identity and uses the stable subscriber code for subscription lifecycle binding;
- Stripe delayed Checkout payments activate on `checkout.session.async_payment_succeeded`;
- Stripe partial refunds are persisted as `commerce.payment.partially_refunded` and do not revoke entitlement, while full refunds still revoke;
- learner offering lookup no longer applies a global 250-document limit before tenant/program filtering;
- upcoming session lookup filters by future timestamp before pagination so more than 100 historical sessions cannot hide a future session.

Second fixer gates: 120 unit/integration PASS, 23/23 Firestore stateful PASS, production build PASS, production audit 0 vulnerabilities, and 13 targeted capability/WCAG browser tests PASS with 1 expected mobile WCAG skip on a fresh production server. Full browser regression is delegated to isolated GitHub Actions for the exact next review head.
