# LUMA-069 — pre-merge source readiness verification

## Source/provenance

The existing verified Firebase runtime still serves SHA `6ddcae8ff2464782b7e4001c4cd5d60092dbb099`. The newer GRUV merge SHA `7ef32ba9ff3c56896da536a86ca14286b99ddfb3` passed five core checks but failed **before any new rollout**, because the release attestation was bound to the previous source digest. Issue #52 is the release-governance tracker. Do not confuse verified Liquid Glass v4 production with unpromoted GRUV source.

## Executed targeted gates

- **26/26 PASS** in `release-tests.log`: existing deployment policy/review-gate tests and new PR-readiness, recovery policy, subprocess no-cloud recovery tests.
- **7/7 PASS** in `bootstrap-tests.log`: all five quality jobs must pass, and ONLY the new source-attestation check may fail while an independent code review is initially prepared. Wrong SHA, missing jobs or other failures reject the review.
- Targeted ESLint: PASS (`lint.exit=0`).
- `node scripts/release/pr-readiness.mjs` on the current unapproved source: exit code **1** with `Source changed since independent review` (`source-rejection.log`). This is the expected safe outcome, not a successful release.
- The offline recovery test deliberately supplies nonexistent Google Cloud credentials and proves a pre-promotion failure records `RECOVERY_NOT_REQUIRED_NO_PROMOTION` without invoking any cloud API or changing status to VERIFIED.

## Pending (do not claim PASS)

- Complete repository TypeScript and build checks must pass in GitHub CI. The local workstation has high RAM pressure, and local TypeScript did not produce a reliable completed result; no PASS is claimed from its incomplete log.
- The independent IBM Granite code review, independent Graph verifier and Graph node closure must be attached to this exact committed source.
- Once the source attestation is created and committed, the PR must rerun all required GitHub checks and become green before merge.
- The separate `pull_request_target` trusted check must exist on `main` and be observed running successfully *before* adding its `source-attestation` check name to branch protection.
- The newer GRUV source is still HOLD for production pending an exact-source independent approval and rollout verification.
