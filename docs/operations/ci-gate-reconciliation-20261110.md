# LUMA required quality check reconciliation (2026-11-10)

The protection of main requires more check contexts than its quality workflow defines. This
source-only CI repair restores those contexts without weakening branch protection.

The coach-rbac, institution-intake, institution-browser and institution-approval jobs execute
current authorization, institutional-grant, browser denial and reviewer transaction tests.
The learning-auth-uat job adds real Auth/Firestore emulator learning checks and Chromium
login/guest-room checks, BUT IT IS NOT THE INDEPENDENT 13-CASE CUSTOMER UAT, LIVEKIT
CLOUD TEST OR PROOF OF PRODUCTION READINESS.

The independent product acceptance engine is copied as policy-only source from the
existing PR #71 integration branch, including its 18 adversarial self-tests. A green
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
