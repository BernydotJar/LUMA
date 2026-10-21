# Confirmed defects and gaps

## Verified provider limitation: LiveKit OSS JWT replay

- **Reproduction:** create instructor and two learners with active 5-minute JWTs, join local OSS; call `RemoveParticipant` with explicit cutoff, then reuse the expelled learner's JWT.
- **Observed:** learner A disconnected, instructor and learner B stayed; expelled learner immediately reconnected with old token.
- **Severity for OSS-as-production architecture:** P0 security limitation. **For the proposed LiveKit Cloud architecture:** Cloud behavior remains untested; do not classify it as a Cloud bug.
- **Remediation:** use intended Cloud service, test `revoke_token_ts` plus LUMA entitlement/webhook barrier and fail closed on any unauthorized replay. Do not approve OSS-based design on this evidence.

## Acceptance blockers (not misrepresented as source defects)
- P0: missing Cloud-connected, Firebase-authenticated instructor+learners class and commercial/institutional revocation E2E.
- P0: missing deployment SHA attestation and exact-SHA independent four-axis acceptance; Graph Harness returned 82 blockers.
- P0 release policy: PR #71 `release-readiness` failed; deploy skipped.
- P1: no authenticated visual/accessible bottom-toolbar QA with camera/microphone/video state.
- P1: load 10/50 and real-network resilience not executed.
- P1: recurring reconciliation/expiration scheduler and operational webhook retry acceptance not demonstrated.

Local harness setup required JRE21 for Firebase Emulator and a physical `node_modules` directory for Next/Turbopack. Both local harness setup obstacles were resolved and are **not** classified as LUMA product defects.

No unsupported claim of a newly reproduced LUMA application bug is made.
