# LUMA required quality check reconciliation (2026-11-10)

The protection of main requires more check contexts than its quality workflow defines. This
source-only CI repair restores those contexts without weakening branch protection.

The coach-rbac, institution-intake, institution-browser and institution-approval jobs execute
current authorization, institutional-grant, browser denial and reviewer transaction tests.
The learning-auth-uat job adds real Auth/Firestore emulator learning checks and Chromium
login/guest-room checks, BUT IT IS NOT THE INDEPENDENT 13-CASE CUSTOMER UAT, LIVEKIT
CLOUD TEST OR PROOF OF PRODUCTION READINESS.

The independent product acceptance engine is copied as policy-only source from the
existing PR #71 integration branch, including its 19 adversarial self-tests. A green
Operational acceptance contract self-test job means the negative policy works; its
9-module and 5-journey product inventory is explicitly BLOCKED.

The production-only product-acceptance-predeploy requires protected environment secrets,
authentic signed customer/reviewer evidence and complete source-bound journeys. Missing
evidence fails closed. The production deploy job depends on the predeploy job and independent
release-readiness. Candidate branches cannot promote production.

This PR does NOT change protected source-attestation, Ed25519 signing, production features,
tenant permissions or deployment credentials. The landing remains in PR #101. Before GO,
resolve Codex findings on the exact final SHA, obtain independent attestation, actual
customer business UAT and dual-origin postdeploy SHA parity.

## Adversarial repairs after Codex review

- The source-of-truth branch policy now explicitly includes the existing institution checks,
  authenticated learning check, exact acceptance-contract job name, release-readiness,
  and separately protected source-attestation. The deploy job separately insists on
  successful protected predeploy acceptance.
- Production promotion is not final until read-only UI/version inventory and the signed
  postdeploy acceptance evaluator PASS on the serving production SHA. Failure runs
  the existing guarded rollback/recovery path before release finalization.
- Signed private UAT proof bytes can be fetched from an independent GitHub Actions
  artifact run selected by the protected environment variable
  LUMA_ACCEPTANCE_ARTIFACT_RUN_ID, rather than requiring customer traces in the PR.
  The expected artifact name is luma-acceptance-private-evidence. The same protected
  trust-store and signed-receipts secrets must be available in the production environment.
  A missing run, absent artifact, mismatch, symlink escape or stale SHA fails closed.
- No GitHub environment variable, private proof or signature is provisioned by this
  source PR. Until independent evidence exists, production remains NO-GO.
