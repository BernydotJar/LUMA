# LUMA — Cloud departed-learner token revocation QA

**Provider security regression: 18/18 PASS. Enterprise product/release: NO-GO.**

Tested on the LUMA non-production integration line, which already contains the original
LiveKit classroom, moderation, enrollment revocation and class-closure fix.

- Source code commit executed locally: 58700ec8c8517cc9dd3a9b92b1eb26baeb725aba.
- Remote GitHub connector code commit: 57d5a87967b116c0a6dfbeac7afbc06ee67ddf7f.
- Verified identical code tree: 2e8b1b3a25751bc088d3b7bcc6ec2c4ce50cb8f9.
- LiveKit Cloud project: p_5650huuc5om (authorized non-customer QA).
- Provider check finished: 2026-10-21T06:27:58.068Z.
- Exact output: provider-result.json, cloud-provider-verification.json, status.json.

## Threat model and real provider outcome

A learner voluntarily leaves a running room and retains a roomJoin JWT with a valid
expiration, even after disappearing from the connected participant roster. During
instructor closure, that JWT must be invalidated by a Cloud revocation cutoff, not
merely rely on disconnect or deleting the room. The test directly verified all the
following at the real Cloud endpoint:

- Three Chromium peers published synthetic camera/microphone tracks and instructor data;
  removal of the first learner did not affect the two remaining participants.
- Another learner voluntarily disconnected. The provider roster reflected absence.
- Calling RemoveParticipant with revokeTokenTs for the absent learner succeeded.
- An unexpired cached JWT for that learner was denied while the room remained open;
  the instructor and the other learner were still connected.
- Remaining identities were revoked before deletion. Provider absence was verified
  through repeated Cloud API reads; the old instructor and departed-learner JWTs did
  not permit a reconnect after classroom closure.
- A non-existent room could not be auto-created with roomJoin alone. A separate room
  was explicitly created and successfully joined at the end, ruling out a false
  negative caused by a signaling outage.

**Expiration false-positive guard:** originals have 5-minute TTL and their exp claim
is validated in memory before each negative replay, requiring at least 60 seconds
remaining. If the token is expired or near expiry, the test fails as inconclusive.

## Reproducible defects and runner hardening

An initial test on integrated source 58700ec8c851 completed 15 checks but crashed
Chromium before the final project-policy and positive-control steps. The exact
failed result is retained as attempt1-browser-crash.json; it is **not** counted as
PASS. The runner was corrected to close inactive browser contexts eagerly and use
the disk-backed shared-memory path, then a full repeat on the corrected source
passed 18/18, process exit 0.

Another identified QA harness issue was stale-success reuse when a child execution
failed before generating a report. The credential-safe wrapper now invalidates
previous mutable reports and requires a fresh result, successful child exit and
every check passed before declaring success.

## Source and CI

On the final integrated source: lint PASS, TypeScript PASS, full Vitest
**473 passed / 107 skipped**, and six new classroom-close API regression tests
PASS. Those skipped tests require separate emulator execution and cannot be treated
as covered by this Vitest command.

The new GitHub Actions workflow is manual-only, requires a protected ref and exact
SHA match, uses the separate livekit-acceptance environment, and performs credential
and evidence sanitization checks. It has **not run remotely**: the environment
still has **zero configured test secrets**. The workflow is available for independent
review, not authorization to merge to main.

## Graph Harness decision

Graph Harness accepted its graph but rejected product release: **NO_GO**,
20 required business actions and 82 unresolved
acceptance proof items. There is no independently attested Firebase staging
deployed revision or authorized enterprise UAT. Provider checks do not replace
the four-axis customer journey acceptance, security signoff, rollback readiness,
long-session refreshed JWT tests or 10/50-person concurrency acceptance.

**No production deployment, feature activation, environment protection bypass,
billing action or synthetic independent approval was performed.**
