# LUMA — Issuance/closure and Cloud proof-integrity QA

**Engineering check: PASS for scoped fixes. Enterprise product decision: NO-GO.**

**Code revision under test:** e15e5450a6cb7f5275d9eaf34476b5206b56142c
**GitHub reviewed code commit:** 21cb995c141e2ca803cd922fa86bcba07fdc180f
**Verified identical Git tree:** 55679478859d81301e81f405eb360bae54990272
**Base:** PR #71 enterprise candidate 99a9a7bae4089742fe341752c85c56e2e8a6126a

## Red then green defect verification

1. Original source allowed an in-flight instructor join request to return a JWT after
   another caller completed the session; reproducible deterministic regression **4 failed / 1 passed**.
2. Patched code reads current session inside Firestore reservation transactions and
   again after all provider signing and entitlement checks, preserving the close
   revocation roster. **5/5 deterministic PASS**.
3. Real Firestore Emulator execution of overlapping completion and pending room
   creation, already-closed session, and room close-fence: **3/3 PASS**.
4. Cloud QA proof integrity verifier rejects historical PASS reuse, wrong
   SHA/run/attempt, stale timestamps, incomplete/duplicate checks and invalid
   project or status: **7/7 PASS**.

## QA overall

Full source Vitest: **528 PASS, 113 SKIPPED** (including three emulator-only tests
run separately). TypeScript PASS. Full ESLint PASS with bounded Node heap; initial
unbounded ESLint attempt was killed by workstation memory pressure and is not
counted as a success.

Real authorized LiveKit Cloud provider-only test, at source e15e5450a6cb7f5275d9eaf34476b5206b56142c: **18/18 PASS**
and child process exit 0. The test uses synthetic Chromium audio/video identities,
voluntary learner departure, explicit token cutoff, cached JWT replay rejection,
room closure and a separate positive-control connection. This confirms provider
behavior still holds. It does **not** execute the patched LUMA backend in a deployed
Firebase staging application; that requires dedicated authenticated UAT.

The original PR #88 Cloud artifacts were deliberately preserved unchanged.
This run's immutable local provider outputs and full evidence hashes are under
this new directory. The locally executed provider scenario does not carry
GitHub Actions run credentials, so it is not represented as protected CI proof.

## Independent acceptance

Graph Harness: **NO_GO, 20 actions / 82 blockers.**
No separately observed deployed runtime SHA or Ed25519-authenticated independent
review. Neither a green code suite nor a Cloud provider replay test authorizes
LiveKit enterprise production or promotion to main.

## Next full UAT

Run a real two-learners/one-instructor class in an isolated **deployed Firebase
staging** runtime; generate a token concurrently with instructor close and prove
the token API denies it, provider room cannot be recreated, and all existing
identities are revoked. Repeat after provider timeouts, refresh JWTs, webhook
replays and 10/50-participant load. Execute the reviewed manual Cloud QA
workflow from a protected ref with test-only secrets installed by a custodian,
then require a SHA-bound independent Graph Harness decision.
