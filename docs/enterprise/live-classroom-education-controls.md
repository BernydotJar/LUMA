# LiveKit teaching controls — source implementation and explicit acceptance gaps

**Scope:** `feat/live-education-controls-20261019`, stacked on LUMA live-classroom Liquid Glass PR #70. This is a real SDK/API implementation **in source**, not proof of a deployed video meeting.

## Business actions and contracts

1. Learner enters a LiveKit room through the existing authorized admission and sees **Levantar la mano** above the bottom Liquid Glass toolbar. The control changes a **server-owned LiveKit participant attribute** (`luma.handRaised`), visible to all connected attendees. The API derives media identity from the verified Firebase UID; caller cannot target another identity. UI never marks an action successful until the server confirms it. The learner can lower the hand.
2. Instructor sees hands highlighted at the top of the participant roster. **Atender** clears that student's hand only after tenant/cohort authorization and server-side roster check. Teacher sees the state update through real LiveKit attribute events.
3. **Silenciar micrófonos** operates only on already-published microphone tracks belonging to learners in the authoritative Firestore roster; it does not touch coaches, muted tracks or screen-share audio. The backend limits classroom size to 120 for this action and the provider mutation fan-out to six concurrent requests. The response differentiates complete/partial failure and informs the instructor that learners can reactivate their own microphones. This is not a classroom-wide persistent mute lock.
4. LiveKit JWT grants explicitly deny `canUpdateOwnMetadata`; otherwise client-owned metadata could impersonate the instructor and misrepresent the raised-hand status. No client obtains LiveKit roomAdmin rights or media provider secrets.

Instructor acknowledgement and mute-all both create a **Firestore moderation audit intent** before mutating provider state and record a completed/partial/failed outcome afterward. A provider failure on an acknowledgement is marked `provider_failed` where possible; an unresolved `pending` event is a reconciliation item, never proof of success. Pseudonymous target identity and the authenticated internal actor UID are retained for authorized audit; the data-retention policy remains an enterprise release gate.

**Authorization:** Firebase token verified against revocation; exact offering/session and tenant-scoped entitlement or instructor assignment are rechecked by `authorizeClassroom`; instructor-only actions are denied to learners. Hand changes have an identity- and room-scoped Firestore transactional cooldown. Mute-all has a room-scoped transactional cooldown. Malformed/big requests are rejected with a bounded payload reader, provider exceptions return 503, and partial audio changes return 207 with exact counts.

**Security limits:** New admission tokens remain time-bounded, but hand/mute/participant-removal controls use `classroomControlAdmission` to remain available to existing authorized participants during an active, uncompleted overtime class. A completed/cancelled/external class still fails closed. Confirm provider behavior for overtime with authenticated LiveKit attendees before release. The mute-all operation is not a persistent "only trainers can speak" policy. Webhook reconciled attendance, speaker consent and customer sign-off still need provider-backed testing. These controls do not implement recording, breakout rooms or per-tenant instructor audio policies.

## Evidence semantics

- Source tests and browser guest-denial tests validate code/API/negative permissions only.
- Compiled CSS fixture screenshots test visual geometry but do **not** count as authentic LiveKit or instructor/learner action evidence.
- Real acceptance requires an instructor, two entitled learners and one unauthorized actor joining with LiveKit Cloud and signed Firebase identities. Verify raised-hand synchronization for late joins, instructor acknowledgement, actual microphone track muted, reenable behavior, revocation, mobile Safari, network loss and recorded audit results.
- Deployment must be source-SHA attested and must pass Graph Harness customer action axes for `learner:raise-hand`, `instructor:acknowledge-hand`, `instructor:teaching-controls`, and `learner:bottom-controls`. Until then the feature remains **NO-GO** and flagged off in production.
