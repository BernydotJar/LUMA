# Defects and blockers

| ID | Priority | Status | Reproduction and disposition |
|---|---|---|---|
| QA-SEC-001 | P0 | FIXED_IN_SOURCE / NOT_DEPLOYED | Instructor moderation ban inherits old `enrollment_revoked` reason on Firestore merge. Red: 2/3 tests fail. Green: 3/3 after explicit `instructor_removed` and stale-job deletion. |
| QA-ENV-001 | P0 | BLOCKED | LiveKit Cloud environment + protected QA secrets absent; cannot prove JWT revocation/replay rejection in Cloud. |
| QA-ENV-002 | P0 | BLOCKED | No distinct Firebase staging with tested authorized user journeys and runtime source SHA. |
| QA-REL-001 | P0 | BLOCKED | Exact-head independent four-axis reviewer, full customer journeys and release authorization incomplete. Graph Harness reports 82 blockers. |
| QA-CX-001 | P1 | NOT_TESTED | Authenticated Liquid Glass controls, mobile safe areas and teacher/student real WebRTC actions not exercised. |
| QA-CAP-001 | P1 | NOT_TESTED | 10/50 peer concurrency, network loss and failover not tested on a real Cloud provider. |

**Causality:** release/environment gaps are not mislabeled as confirmed source vulnerabilities; QA-SEC-001 is a reproducible source bug, not yet a proven live customer incident.
