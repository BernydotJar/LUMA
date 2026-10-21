# LUMA Live Classroom — release readiness

**Decision:** NO-GO. No production changes authorized or performed.

## Source/CI status at 2026-10-20 inspection

- GitHub `main`: `5c82285251be18c9cf876ae5fd8c307075904029` at independent public git ref query.
- PR #70 open, #71 open, #72 draft, #73 draft. Graph Harness #5 open.
- PR #73 source `ae9f984e07c222a88344300926f1ca0dab2725ad`: CI jobs verify/security/identity-roles/firestore/browser passed; deploy skipped.
- PR #71 source `3690c42af3fee4da79b955b1892130899fbf4734`: verify/security/identity-roles/firestore/coach-rbac/institution-browser/institution-approval/browser/institution-intake passed. Required `release-readiness` failed with `Source changed since independent review`; deploy skipped.
- Graph Harness PR #5 evaluator source `b3e991eaff98822defdd20287fa110586953abde`; local product-acceptance result **NO_GO** with 20 critical actions, 82 blockers.

## Hosted inspection and limitations

- Both LUMA HTTP hosts reachable and guest media token/moderation requests denied 401.
- Authenticated Firebase CLI read-only `apphosting:backends:list` found backend `luma` in `us-central1`.
- **No independently verified rollout commit/build SHA was obtained**. Do not infer production SHA from GitHub `main`, an HTTP 200, the backend creation/update timestamps, or a hosted UI route.
- PR #73's source `apphosting.yaml` contains `LUMA_LIVE_CLASSROOM_ENABLED=false`; published runtime flag state was not separately attested.
- No provisioned LiveKit Cloud QA credentials or approved customer UAT identities were available within this test runner.

## Release sequence

1. Confirm real Cloud project, billing/quota approval and isolated staging configuration; credentials remain in a secret manager.
2. Execute six-person authorized customer class, P0 refund/institution revocation plus old/refreshed JWT replay and complete screen share/teacher moderation interactions.
3. Attest deployed staging/production SHA from Firebase App Hosting rollout/build provider records; run Graph Harness per critical action with independent evidence.
4. Obtain independent review on final source digest, pass required CI/predeploy, approve rollback and privacy retention policy; only then release/enable Cloud.

Never change branch protection or pretend a reviewer/attestation exists.
