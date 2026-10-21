# Release readiness — segregated authorization

**Product decision:** NO-GO. Code change reviewable at source SHA `3fe24da039ec379967ab8ddd338dbaedf5ad0e38`. This report does not grant production deployment, merge, or enablement.

**Current PR chain:** #70 (Glass), #72 (controls), #73 (revocation) and #77 (this regression/test evidence) remain stacked. #71 is the separate integration/release-control PR; Graph Harness #5 supplies the independent gate implementation but does not confer human approval.

**Permissions exercised:** Cloud Sandbox can read/write this registered QA branch and run tests; audited `git_push` works. GitHub connector reports administrative repo access. The local `gh` CLI token was invalid; we did not print/restore credentials or weaken branch protection.

**Staging-only scope:** a dedicated LiveKit Cloud QA project, a separate Firebase staging project, synthetic Firebase users, and an explicit protected GitHub environment are prerequisites. Production GCP/LUMA and payment-provider identities must not be reused as test principals.

**CI:** branch push must trigger GitHub Actions; the exact final PR head and required checks must be re-inspected after evidence commits. Local tests and a green GitHub Action job cannot override Graph Harness NO_GO.

**Rollback and release approval:** no rollout or rollback performed. Require runtime SHA attestation, signed human/independent acceptance, full customer UAT, retained CI artifacts, protected production environment approval and rollback drill before GO.
