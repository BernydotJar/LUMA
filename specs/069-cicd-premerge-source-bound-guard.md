# LUMA-069 — Graph-authorized PR readiness and safe failure recovery

## Product/release story

As the enterprise release owner, I cannot merge a new LUMA source tree into the protected production branch until its exact source digest has a current, independently verified Graph Harness release approval. If CI fails before a new App Hosting rollout starts, the system must never attempt to roll back unrelated serving traffic or fabricate recovery.

## Original incident

- Liquid Glass v4 was previously **VERIFIED** in Firebase on SHA `6ddcae8ff2464782b7e4001c4cd5d60092dbb099` via Actions `38096269154`; both public domains served that SHA and production health was OK.
- GRUV product-line changes arrived on `main` at `7ef32ba9ff3c56896da536a86ca14286b99ddfb3` through PR #44. Its run `38102977587` passed `verify`, `security`, `firestore`, `identity-roles`, `browser` but production `deploy` refused with `Source changed since independent review`. This is correct fail-closed behavior, not a Liquid Glass v4 regression.
- `recover` subsequently returned `Recovery refused: another release changed traffic`, even though the failing deployment had never emitted `PROMOTION_STARTED`. This obscures the real preflight failure and introduces operational confusion.
- Required `main` checks covered only the five tests. They did not require source-bound independent review before merge.

## Changes

1. `scripts/release/pr-readiness.mjs`: fail-closed validation of exact source digest, unmodified critic/verifier evidence, and the complete append-only Graph gate. No auto-approval or fallback to a previous digest.
2. `.github/workflows/quality.yml`: a source-bound `release-readiness` check after the five core jobs, and dependency before deployment. The CI quality test also checks the release review bootstrap invariants.
3. `.github/workflows/source-attestation.yml`: independent `pull_request_target` status check using *trusted base* policy code to examine the synthetic PR merge checkout **as inert data only**. It requests read-only repository access, has no deployment tokens, and runs no PR scripts, package installs, browsers, or network-delivered user code. This is the check to require in branch protection **only after the workflow is present on `main` and its first run is confirmed**.
4. `scripts/release/quality_run.py`: one controlled bootstrap exception for preparing the first independent attestation. A run may have overall conclusion `failure` only when all five required jobs PASS, its **only** failed job is the new `release-readiness` check, and the PR deployment job is skipped. This is *not* merge approval: the PR check remains red until the signed source-matching Graph evidence is committed and CI reruns green.
5. `scripts/release/recovery-policy.mjs`, `apphosting.mjs`: if a release never recorded `PROMOTION_STARTED`, recovery records `RECOVERY_NOT_REQUIRED_NO_PROMOTION`, keeps the release status FAILED, makes no cloud API request, and does not invent a rollback. If promotion began, existing strict build/traffic checks and recovery are retained.
6. Tests: Vitest negative cases for missing/stale evidence and Graph failures, trusted workflow layout, Python bootstrap fail-closed branches, plus a subprocess recovery integration test with deliberately absent GCP credentials.

## Integrity boundaries

- **No unreviewed code is deployed.** Production must match the exact reviewed source digest, plus all five core jobs, independent Graph gate, keyless Google authentication, verified serving SHA and smoke tests.
- **No automatic source approval.** Independent human/model/deterministic verification and an append-only Graph receipt are required; the job only validates their presence/integrity.
- **No bypass of failed quality jobs.** Bootstrap is limited to a red source-readiness check; any failed `verify`, `security`, `firestore`, `identity-roles`, `browser`, or unrelated job blocks review creation.
- **No PR-supplied executable code in privileged workflow.** `pull_request_target` runs protected-base policy; candidate checkout is read as data. A future organizational code-owner approval policy would further protect against a maintainer with permission to forge metadata/evidence: hash integrity alone is not an independent human signature.
- **No `continue-on-error`**, no forced merge, no pushed Firebase changes without successful release gates.

## Gates

- Producer: code changes scoped to the source-bound PR readiness and safe recovery logic.
- Critic: adversarial code review of PR trust model, OIDC separation, source digest, Graph evidence, legitimate bootstrap and traffic recovery.
- Independent verifier: positive and negative Vitest, Python unit, TypeScript/lint, selected full suite, Graph event-hash verification, GitHub CI result, and a negative actual missing-attestation gate.
- Graph: `LUMA-069-pr-source-readiness`, independent-review PASS only from real test and critic receipts. This node does **not** declare `cicd-release` or `cicd-production` PASS.
- Production: retain currently verified v4 until the GRUV change and guard have their own approved source digest and all required remote checks.

## Rollout sequence (avoid deadlock)

1. Commit the stable guard source code; run all **five core** CI checks. The new same-workflow readiness check may deliberately fail until approval exists, and the branch is **not mergeable when a readiness check becomes required**.
2. Perform independent GRUV + guard code review against the **exact** tested digest, preserving raw model output and evidence-backed dispositions.
3. Issue a new `cicd-release` Graph approval bound to that digest, append it without rewriting historic events, and commit only review metadata.
4. Re-run PR CI so all six checks pass, then merge without bypassing any required status. After the trusted workflow exists on protected `main`, confirm its first run and add `source-attestation` to GitHub required contexts. Until then, the source-bound job inside quality workflow is defense-in-depth, not an independently trusted branch-protection check.
5. After protected merge and a successful main release workflow, verify live SHA on Firebase and `luma.lch-app.cloud`, smoke evidence, rollback-validation and the actual released Graph record. Any remaining source review blocker means HOLD on newer GRUV code.

## Definition of done

- Local code review and quality suite PASS, Graph node LUMA-069 audited.
- Trusted PR check configured and **enforced** in protected `main` after proof it runs from protected base.
- An independent, current digest approval exists for the future release, with no unsupported PASS claims.
- Five base checks + source readiness PASS on PR; production deploy + version/health checks prove the exact promoted merge commit.
- Until all apply, state remains **PARTIAL / GRUV HOLD** with Liquid Glass v4 protected.
