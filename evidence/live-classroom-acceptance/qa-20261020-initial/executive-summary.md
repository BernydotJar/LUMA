# LUMA | Live Classroom enterprise QA — 2026-10-20

**Decision: NO-GO for replacing Zoom in a customer deployment.**

**Product source under test:** `ae9f984e07c222a88344300926f1ca0dab2725ad` (LUMA PR #73). The independent acceptance engine was run from Graph Harness PR #5 SHA `b3e991eaff98822defdd20287fa110586953abde`. This audit does **not** constitute independent approval.

## Executed evidence

| Layer | Observed outcome | Meaning |
|---|---|---|
| Complete Vitest suite | **350 passed, 98 skipped** without emulator | Source and unit behavior, not production |
| Full Firestore commerce/classroom emulator suite | **67/67 passed** on isolated demo project | Real local persistence, mocked provider calls |
| Targeted Firestore interaction/revocation/attendance | **16/16 passed** | Subset of 67, not additive |
| Targeted classroom unit tests | **46/46 passed** | Subset of 350, not additive |
| Playwright desktop + mobile anonymous UI | **4/4 passed** | Guest denial only, not authorized learner/instructor UAT |
| LiveKit OSS 1.13.10 real WebRTC | Three independent Chromium clients published audio+video and each received two live remote audio/video streams | Real localhost media; not LiveKit Cloud or LUMA authenticated UI |
| Local remote controls | Learner self-muted/unmuted microphone and camera | Provider SDK, not branded customer UI |
| Local connected-session expulsion | PASS: learner A disconnected; instructor and learner B remained connected | One sample measured 22 ms from provider removal request to observed disconnect |
| Old access-token replay on local OSS | **Accepted after expulsion** | Expected OSS limitation; cannot infer Cloud behavior |
| Public host anonymous checks | Both hosts GET / and guest classroom HTTP 200; POST token/moderation HTTP 401 | Read-only guest access guard only |
| Graph Harness acceptance | **NO_GO, 20 actions, 82 blockers** | Missing four-axis signed action proofs, independent scope approval and deployment revision |
| CI on LUMA PR #71 | Nine required checks pass; `release-readiness` fails, deploy skipped | Source changed since independent review |
| CI on LUMA PR #73 | Five checks pass, deployment skipped | Tests do not imply release authorization |

The loopback 22 ms observation is **not** a percentile, SLA, or network benchmark. Production source SHA and live feature-flag state were not independently attested; only PR source `apphosting.yaml` explicitly keeps `LUMA_LIVE_CLASSROOM_ENABLED=false`.

## P0 release blockers

1. No authorized LiveKit Cloud project credentials in this isolated QA environment; Cloud `RemoveParticipant` cutoff, original/refreshed JWT replay, concurrent refund/reconnect, and actual Cloud media remain **BLOCKED**.
2. No complete authenticated customer journey across institution admin, assigned instructor, two paid learners, unauthorized learner and revoked learner in an authorized published staging environment.
3. No independently observed published runtime SHA or independent product-acceptance reviewer/signature for the exact reviewed source.
4. PR #71 `release-readiness` failed, while #70/#71/#72/#73 and Graph Harness #5 remain unmerged (at inspection time).

**Safety:** No release, merge, Cloud provisioning, billing change, production flag activation or artificial approval was performed. Tests used synthetic actors and loopback fake cameras/microphones.
