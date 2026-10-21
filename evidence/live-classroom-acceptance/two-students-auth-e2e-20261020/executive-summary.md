# LUMA — Two-learner authenticated Live Classroom UAT

Execution: 2026-10-21T00:43:30.124Z
Exact QA source SHA: 7ce200faaf442a9e4adbb13b29759523a1d272c1
Local E2E: 33 PASS / 0 FAIL / 1 CLOUD BLOCKED
Enterprise production acceptance: NO-GO.

## Test architecture

- Actual LUMA Next.js branded classroom, UI and business APIs, no fake page data.
- Isolated Firebase Auth and Firestore emulators: demo-luma-live-uat.
- Dedicated real LiveKit OSS 1.13.10 localhost SFU and 3 separate Chromium WebRTC contexts, fake AV devices.
- Five new synthetic, emulator-only identities: institution admin, instructor, learners A and B, unauthorized user.
- No test user, purchase, or privilege changes created in real Firebase or LiveKit Cloud.

## Demonstrated end-to-end

- Admin created active course, scheduled 90-minute integrated classroom with recording policy none, granted two institutional enrollments through real authenticated LUMA APIs.
- Instructor and two students independently logged into LUMA, passed device lobby, entered branded real LiveKitRoom.
- Three participants each published actual microphone and camera tracks (2 per person); each browser decoded at least 2 remote videos.
- Real LUMA control bar toggled mic and camera for all users.
- Learner A raised hand, instructor acknowledged, instructor muted both students, learner B could restore own microphone.
- Anonymous/unentitled actor denied token with 403, learner denied institutional admin and instructor control endpoints with 403.
- Administrator revoked learner A during connected WebRTC: Firestore entitlement and provider roster ban persisted; A was removed; instructor and B remained connected; new A media token denied 403.
- Instructor closed session and further student admission returned 409.
- Responsive authenticated mobile Chromium test at 375 x 812: 10 touch targets >=44 x 44, no page horizontal overflow, glass dock 10px above stage bottom, hand button 25px clear.

## Product bugs found and fixed

1. Raise-hand button remained disabled after join because it watched mutable room.state without a React subscription. The fix uses LiveKit useConnectionState.
2. Mobile dock floated 302px above bottom and overlapped hand control because stage lacked a definite height. New mobile stage height and flex constraints yield bottom gap 10px and hand separation 25px.
3. A *test harness timing issue* arose from cold Next.js dynamic route compilation: an authenticated interaction returned 200 after 46s, longer than initial assertion timeout. Fixed QA sequencing by safe anonymous deny-by-default HTTP 401 route prewarm before starting the class; no product API logic bypassed.

## Non-SLA observed timings, single local execution

- Raise-hand server-confirmed UI: 240 ms.
- Authorized institutional revocation API: 4223 ms.
These are localhost/emulator measurements. No contractual SLA or percentile is inferred.

## Blocking release gates

- LiveKit CLOUD account/secrets not available or approved. Cloud revokeTokenTs, original and refreshed JWT replay, real signed webhooks and reconnection races were NOT TESTED. Previous OSS replay in PR #77 is an OSS limitation, not a Cloud finding.
- Not tested on an independently attested Firebase published staging/production source SHA.
- Independent product reviewer signature on 20 critical four-axis actions missing. Graph Harness source-based evaluation here: NO_GO, 82 blockers.
- Physical iPhone/Safari, screenreader, cloud provider load and class screen sharing were not accepted in this test.
- Source apphosting.yaml still keeps LUMA_LIVE_CLASSROOM_ENABLED=false. No merge, production deploy, production flag change or billing activity took place.

## Reproduce

From isolated Cloud Sandbox with JRE21, Node22, Chromium, Firebase CLI, reviewed local LiveKit OSS binary, OpenSSL and socat:

    bash scripts/qa/run-two-students-local-uat.sh

The test automatically creates and disposes Firebase Auth/Firestore emulator users, Firestore records, synthetic LiveKit room and Chromium contexts. Exact structured evidence is in this folder.
