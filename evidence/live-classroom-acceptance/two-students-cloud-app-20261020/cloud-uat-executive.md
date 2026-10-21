# LUMA Live Classroom | Cloud provider and authenticated product QA

Assessment timestamp: 2026-10-21T03:18:51.315Z
Product and QA source commit: 41eefebb47375c0e95627716c5e026578eb3b9a3
LiveKit Cloud project ID: p_5650huuc5om
Provider URL: wss://luma-0x6n7955.livekit.cloud

## Executive decision

LOCAL CLOUD APP E2E: PASS (36 checks passed, 0 failed).
PROVIDER PROJECT POLICY: NO-GO (automatic room creation remains enabled).
ENTERPRISE RELEASE / GRAPH HARNESS: NO_GO (20 critical actions, 82 missing four-axis or independent proofs).
No production release, merge, feature enablement or credential publication was performed.

## Real implementation verified

An authorized admin created a live offering, scheduled a 90-minute no-recording classroom and enrolled two synthetic learners through LUMA's actual business endpoints. Three independent Chromium browsers authenticated with Firebase Auth Emulator and sent real synthetic microphone/camera streams to the existing LiveKit CLOUD service. Every browser decoded peers' remote videos.

The learner raised a hand, the instructor acknowledged and muted both students, and learner B restored their own microphone. An unauthorized synthetic user was rejected by enrollment checks and a learner was denied instructor/admin actions.

An institutional revocation while student A was publishing media persisted in Firestore Emulator, evicted the correct Cloud media identity and did not eject the instructor or learner B. A new LUMA token request returned 403. Cloud denied the learner's already-issued JWT on replay.

After the source fix, ending a class revoked all issued identities (including those already disconnected), wrote a durable closure fence and then deleted the Cloud room. LUMA denied new admission with HTTP 409 and the instructor's cached JWT could not recreate the ended room. All 36 acceptance actions completed.

Responsive: authenticated Chromium at 375x812, 10 accessible-size controls, media dock bottom offset 10px, hand/dock separation 25px.

## Cloud provider-only adversarial experiments

BASELINE (unfixed): 6 PASS, 1 FAIL. Cloud correctly revoked an expelled learner's cached JWT but allowed the instructor's token to recreate a deleted room.

REVOKE-BEFORE-DELETE: 8 PASS, 1 FAIL. Explicitly revoking the instructor and remaining student before deletion prevented replay of the instructor's old JWT. Nevertheless an unrelated roomJoin token could automatically create a new room. This is a LiveKit Cloud PROJECT SETTING issue, not a LUMA token signer failure.

The existing Cloud-only provider suite still returns FAIL until automatic room creation is disabled in the project dashboard.

## Fix included in this branch

The close route now marks the business session completed first to stop new issuance, enumerates Firestore authorized identities together with current Cloud media participants, invokes RemoveParticipant with per-call revokeTokenTs cutoffs using maximum six parallel workers, persists a closeTokensRevokedAt and count fence on confirmed success, and deletes the room. Retries use the durable fence. A failed credential revocation is retryable, never acknowledged as successful. The route supports up to 1000 issued identities before failing closed.

Six dedicated unit tests check roster deduplication, invalid inputs, shared cutoff, bounded concurrency, failure propagation and malformed rooms.

## Observations and limitations

Last authenticated Cloud institutional revocation API latency: 2549 ms (one local-browser-to-Cloud trial, not an SLA). Earlier trial of an equivalent action took about 33.3 seconds; a 20-second test client timeout exposed a reliability risk. No latency percentile or formal SLO has been established.

No production Firebase tenant or real customer account was used. Five identities existed only in Firebase Auth Emulator, two institutional enrollments only in Firestore Emulator; no billing activity or persistent cloud classroom was intentionally left behind.

The test covers issued-and-cached JWT replay, not a separately captured SDK-refreshed token at a longer session duration. Signed public webhook retry, real-world network faults, WebKit/physical devices, 10/50 person load and deployed runtime SHA attestation remain for UAT.

## Remaining P0 actions

1. Open https://cloud.livekit.io/projects/p_5650huuc5om/settings/project and switch OFF Automatically create rooms on participant join. This browser action is restricted in Cloud Sandbox; no project setting was changed.
2. Rerun scripts/qa/livekit-cloud-enterprise-gate.mjs against the same Cloud project and require provider conclusion PROVIDER_CLOUD_PASS. Verify disabled automatic creation and instructor JWT replay on the configured project.
3. Configure a protected staging secret environment and publish an approved source SHA. Do not copy the local CLI secret into GitHub or the application source tree.
4. Run authorized staging UAT, signed webhook, long-session refreshed JWT, network resilience, classroom scale and complete independently signed four-axis Graph Harness controls.
5. Approve privacy/retention policy, rollback, release owner and predeploy/postdeploy; only then decide GO.

### Evidence artifacts

- authenticated-e2e-result.json: 36 business/media/browser checks, source SHA and observed durations.
- Graph Harness product-acceptance JSON: NO_GO, 20 actions and 82 blockers.
- Cloud provider smoke and revoke-before-close raw reports, separately retained.
- six independent synthetic-browser screenshots and sanitized logs.
- complete source verify: lint, TypeScript, 356 unit tests and Next production build PASS.
