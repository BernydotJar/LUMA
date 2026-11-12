# LUMA required quality check reconciliation (2026-11-10)

The protection of main requires more check contexts than its quality workflow defines. This
source-only CI repair restores those contexts without weakening branch protection.

The coach-rbac, institution-intake, institution-browser and institution-approval jobs execute
current authorization, institutional-grant, browser denial and reviewer transaction tests.
The learning-auth-uat job adds real Auth/Firestore emulator learning checks and Chromium
login/guest-room checks, BUT IT IS NOT THE INDEPENDENT 13-CASE CUSTOMER UAT, LIVEKIT
CLOUD TEST OR PROOF OF PRODUCTION READINESS.

The independent product acceptance engine is copied as policy-only source from the
existing PR #71 integration branch, including its 21 adversarial product-acceptance self-tests. A green
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

## 2026-11-11 adversarial hardening / cross-run recovery

- The current CI policy has 16 jobs: 11 real product/security checks, predeploy and
  independent release-readiness, source promotion, postdeploy acceptance, and a separate
  recovery job. Protected attestation code now expects the extra PR-only skipped jobs.
- The candidate release promotion job never finalizes based on an HTTP 200 or green
  build alone. It captures the current promotion ledger and returns. A separate bounded
  postdeploy job must verify the deployed SHA, browser routes, signed customer journeys
  performed after this exact PROMOTION_STARTED event, same build and GitHub run ID,
  then and only then call finalize.
- The separate rollback-on-failed-acceptance job uses the real promotion ledger to
  recover the previously verified build when postdeploy checks fail, time out or are
  cancelled. If the ledger is absent or the prior build cannot be independently
  verified, recovery refuses to guess and requires an operator incident response.
- Candidate checkout proof bytes are never trusted once an external protected UAT
  artifact root is provided. Each artifact is constrained to that root and hashed.
- A protected UAT artifact cannot be selected by number alone: verify registered
  GitHub workflow ID and exact path, main branch, own repository identity, source SHA,
  completed/successful workflow_dispatch, independently allowlisted actors, artifact
  identity, unexpired status and creation after promotion (postdeploy).
- Signed UAT action/journey receipts must declare the independently authenticated
  workflow run ID. Production receipts also bind the current promotion GitHub run ID,
  build ID, and execution after the promotion start event.
- The protected variables LUMA_ACCEPTANCE_WORKFLOW_ID,
  LUMA_ACCEPTANCE_WORKFLOW_PATH, LUMA_ACCEPTANCE_TRUSTED_ACTORS,
  LUMA_ACCEPTANCE_ARTIFACT_RUN_ID (predeploy), and
  LUMA_ACCEPTANCE_POSTDEPLOY_ARTIFACT_RUN_ID (postdeploy) are NOT provisioned by
  this PR. No independent UAT receipt is fabricated; production remains fail closed.
- The separate protected source-attestation check is observed in GitHub on the
  exact current PR commit SHA with GitHub Actions app ID 15368, although it
  legitimately fails without the independent signature. This is a live readback,
  not an assertion that approval exists.

## 2026-11-11 release reliability and provenance repair

App Hosting is split into prepare and promote. Preparation completes Cloud
Build, captures the last verified serving build and its provenance, and
persists an artifact before any rollout begins. The independent recovery job
downloads that pre-promotion ledger; it no longer depends on a postpromotion
artifact that could fail to upload. Recovery rejects foreign run/SHA/build
and refuses to guess an unverified rollback target.

Postdeploy waits for a separately dispatched, trusted UAT workflow created
after PROMOTION_STARTED. It validates workflow identity and path, main branch,
exact source SHA, actors, success, artifact identity and timestamp; it then
passes the verified run ID to the existing evidence checker. Absent a genuine
independent run, the bounded wait fails and guarded recovery is scheduled.
No user impersonation, synthetic customer evidence, secret or signature is
created by this patch. A real protected UAT workflow and reviewer identity
must be configured separately before any product production GO.

Branch protection reconciliation now matches both required context and the
GitHub Actions app ID 15368, replacing only incorrect bindings while
preserving unrelated required contexts.

All of these changes are source-only pending GitHub Actions on the new SHA,
independent source review and a real customer UAT.

### One-time serving baseline risk

The live /api/version points to historical GitHub run 40066291759, which
currently reports overall FAILURE. Source-only changes do not establish it
as a verified rollback target. The preflight therefore FAILS CLOSED when
previous.knownGood cannot be established from the current production build
labels and authenticated successful main-branch release. A separate baseline
certification or independently reviewed recovery policy is needed to promote
safely for the first time; do not reinterpret live HTTP 200 as acceptance.
