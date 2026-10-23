# LUMA | Issuance-closure concurrency and Cloud evidence integrity

**Scope:** Two specific security review findings from PR #88 on the enterprise integration candidate.
**Release:** NO-GO until independent Graph Harness signoff on a published Firebase staging SHA. This branch neither promotes production nor relaxes the release gate.

## P0 — In-flight token issuance after session completion

BEFORE: A request authenticated by authorizeClassroom could wait for RoomService.createRoom while the instructor completed the session; afterward the request reused its old snapshot and issued an instructor JWT. A deterministic test verified this: four of five new assertions failed before correction, including an actual resolved synthetic JWT after closure.

AFTER: live-classroom-server.ts reads the authoritative Firestore session used by completeClassroomSession. registerRoom and the quota-reservation transaction both verify matching offering/session identity, scheduled LiveKit status and the durable room-close fence BEFORE writing any roster identity. Firestore transaction conflicts with a concurrent session-completion write. The reserved identity is recorded before any provider I/O so the close path enumerates it for explicit JWT revocation.

A post-signing final read rejects a request that finished its provider work after session completion. The read is not a global mutex over network responses: should close begin after the final check, the identity has already been reserved in Firestore and close must revoke that participant. No promise is made that stale Cloud credentials cannot reconnect without full staging UAT.

Reproduce: npm run test:run -- src/lib/live-classroom-issuance-close-race.test.ts
Result: five passing deterministic tests; four failed on the original implementation.

Stateful: Firestore Emulator isolated demo-luma-issuance-qa with
npm run test:run -- src/lib/live-classroom-issuance-close-race.emulator.test.ts
Result: three passing emulator tests, including an actual concurrent Firestore completion transaction. No production Firebase project is used.

Still required: authenticated staging full journey, overlapping provider createRoom vs close room deletion, long-lived/refreshed signed JWT, unexpected provider timeouts, issuer cancellation and all-tenant authorization evidence.

## P1 — Stale green Cloud artifact on a failing CI run

BEFORE: scrub executed after Cloud failures and accepted an old committed PROVIDER_CLOUD_PASS file if it had nonempty checks and contained no visible credentials. The overall job stayed red but a misleading green artifact could be uploaded.

AFTER: the manual workflow deletes checked-in historic reports before Cloud execution, only performs scrub and upload after the Cloud test succeeds, and runs a standalone provenance validator. Both Cloud scenario scripts attach exact GitHub run ID, run attempt and SHA-derived per-run nonce. The validator checks exact source SHA, approved project, run+attempt+nonce, current-run timestamps and file modification time, exactly 18 departed-learner or 13 project-policy passing assertions with no duplicated action/role keys, and absence of LiveKit secrets or signed JWTs.

Reproduce: npm run test:run -- scripts/qa/assert-livekit-cloud-proof.test.mjs
Result: seven passing negative/provenance assertions rejecting historical reports, stale executions, changed SHA, mismatched project, failing/incomplete/duplicate checks.

## Limits, tests and release authority

- TypeScript PASS.
- Full ESLint PASS under NODE_OPTIONS=--max-old-space-size=640 (no errors).
- An initial uncapped lint run was terminated with exit 137 because the workstation had memory pressure; the capped verified rerun is the evidence, not the terminated run.
- Full Vitest at code baseline: 528 passed and 110 skipped. Three new Firestore emulator-only cases were run separately (3/3 PASS).
- Existing provider-only LiveKit Cloud 18/18 from PR #88 remains valid for its historic source; it does not exercise this new backend code on deployed Firebase staging.
- The protected GitHub livekit-acceptance environment has no QA secrets installed. QA secrets must be configured directly by an authorized custodian; the workflow is manual-only and cannot authorize production.
- No production user, Firebase, Cloudflare, payment-provider, GitHub production environment, or deployment flag was changed.

**Graph Harness remains NO-GO until independent four-axis product acceptance and final deployed revision proof.**
