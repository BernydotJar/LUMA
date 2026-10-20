# LUMA live classes: revocation while the learner is connected

**Baseline:** stacked on #72, which is stacked on Liquid Glass #70. **Product status: NO-GO** until release gates are met. The code and automated tests do not authorize turning on `LUMA_LIVE_CLASSROOM_ENABLED` in Firebase App Hosting.

## Operational behaviour now implemented in source

1. A signed Stripe/Hotmart refund or audited institutional grant revocation sets the student's actual enrollment to `revoked` in Firestore. In the **same transaction**, a deterministic outbox entry is created only for a learner-linked live offering. A separate signed refund event gets a separate job while access remains revoked. An absent job is a retryable error rather than a false success. Merchant mapping drift does not redirect an original revocation to a new cohort.
2. Before the incoming provider webhook or institutional admin API returns success, the dispatcher claims an outbox lease, rechecks the latest enrollment and other active entitlements, enumerates registered rooms of that exact tenant/cohort, revokes the roster and requests LiveKit to remove the participant using `revokeTokenTs`.
3. Any provider outage yields a **retryable error**, a durable pending job and retained Firestore roster ban. A duplicate signed refund retries the job. A later valid reactivation supersedes earlier pending work; unrelated still-active grants preserve access. Eligibility is read again immediately before each provider removal, although simultaneous provider calls still require a dedicated Cloud concurrency test. An old ban created by an instructor is not cleared by buying again.
4. The signed LiveKit `participant_joined` webhook independently rechecks the roster and current entitlement for every learner and removes a member with expired/revoked access. This is a **compensating control**, not a guarantee of zero-millisecond unauthorized media access. The 90-second join JWT limits first-connection replay time, but does not end an established WebRTC connection.
5. Learners entering after reactivation must have a valid live cohort entitlement newer than any prior commerce ban. Instructor bans remain sticky. The direct `createClassroomToken` issuance path rechecks entitlements to narrow the race with a refund.

No artificial state or non-verified screenshot is used as acceptance evidence.

## LiveKit provider compatibility: local OSS replay is expected; Cloud must be verified

At 2026-10-20, an isolated Linux ARM64 LiveKit **1.13.10** server was used with three real Chromium WebRTC clients (one instructor, two learners) publishing fake-device microphone tracks. All connected, instructor and second learner stayed connected after the first learner's `RoomServiceClient.removeParticipant()` command, and the first learner disconnected. **However, the evicted client successfully reconnected with its earlier unexpired JWT.** That outcome is expected in self-hosted LiveKit: according to the official token lifecycle documentation, provider-enforced revocation on `RemoveParticipant` is **Cloud-only**, and self-hosted instances cannot invalidate previously issued JWTs through this API. It is a verified limitation of the local test environment, not evidence that LiveKit Cloud has the same behavior. Exact local evidence is in `evidence/live-classroom-acceptance/livekit-local-provider-result.json`.

Provider references: https://docs.livekit.io/frontends/reference/tokens-grants/ and https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/. Cloud `revoke_token_ts` is an explicit Unix **seconds** cutoff (within 60 seconds of the server clock), intended to reject JWTs whose `nbf` precedes it. Our backend uses an explicit cutoff to avoid the default one-minute buffer; actual Cloud behavior is still unverified.

Also note that media SDKs may refresh in-session tokens with a longer expiration; shortening the original join JWT to 90 seconds alone is **not** sufficient to guarantee that a connected student cannot reconnect after refund.

That local test is not an authenticated LUMA UI E2E, not Firebase-backed LiveKit Cloud, and **not a product acceptance PASS**. It proves removal works on self-hosted LiveKit and confirms documented token replay behavior where no provider-side revocation exists. Therefore, Cloud-specific revocation semantics, signed webhook reaction time, simultaneous refund/reconnect races and JWT replay denial need direct validation **on the intended LiveKit Cloud instance** before enabling the feature.

## Mandatory release tests

- Authentic Seres program admin creates a scheduled 90-minute class; instructor plus two entitled learners complete camera/mic/chat/hand/share/reconnect and moderator workflows in an actual Firebase deployment.
- A signed refund and an institutional admin revocation interrupt already-established WebRTC streams; recorder policy stays `none`. Test revocation when the provider is unavailable and after webhook retries.
- An old browser JWT must not allow unauthorized media consumption after the revocation barrier. **If LiveKit Cloud still accepts it, remain NO-GO.**
- A separate active entitlement for the same cohort must preserve the authorized learner's ongoing access. An unrelated tenant's entitlements must never grant admission.
- The UI communicates interrupted access, permission denial and reconnection after outage. Validate Chrome + mobile Safari, focus, screen reader and 375px viewport with the real LiveKit components.
- Provider webhook and commerce admin requests are rate-limited, authenticated and auditable; the revocation outbox requires operational monitoring and a recovery/reconciliation task for exhausted vendor retries. Account for expiry at an exact scheduled cutoff (currently requires a separate scheduled worker; unaccepted).
- Signed independent product acceptance evidence must connect all four axes (source, actual UI, business journeys, hosted SHA) across **20 critical actions**, not just this revocation case.

## Deployment and observability

Production `apphosting.yaml` pins `LUMA_LIVE_CLASSROOM_ENABLED=false`. This is an explicit safety gate. Secret injection is runtime-only, and the real LiveKit Cloud test must run before a reviewed activation PR. Never add credentials to source, environment printouts or PR logs. Do not run unreviewed manual Firebase rollout commands bypassing GitHub's required checks.

Potential scale ceiling: revocation worker fails closed if a cohort has more than 100 registered historical rooms rather than silently reporting success. A paginated reconciliation worker, exact expiration scheduler, and larger-cohort soak test are remaining operational requirements.
