# LUMA Live Classroom | Cloud project-policy acceptance

**Verdict: provider configuration PASS; enterprise release NO-GO.**

This document records a real execution after the project owner turned OFF **Automatically create rooms on participant join** in the existing LUMA LiveKit Cloud project `p_5650huuc5om`. No production project, release environment, authentication secrets, personal users or billing state was modified by this run.

## Immutable source and scope

- Local source commit: `09a5bb2061d1e622cbf3a7365c521b4c1dba20d1`.
- GitHub PR [#86](https://github.com/BernydotJar/LUMA/pull/86) remote head: `eb86f876992d113802ba615745246e03873ccfd6`.
- Both were verified to have **identical git tree** `defafc3d333ff8ff348eb106c77fe0f236e557d3`. No application-code patch was required by this provider setting change.
- Cloud-side testing used synthetic peer identities and a real WebRTC provider. Firebase app testing uses **Firebase Auth/Firestore Emulator**, not a deployed production-like staging Firebase runtime.
- Test provider observation at **2026-10-21T04:59:58.818Z**.

## Independently executed post-policy provider checks

**9 of 9 PASS**. Evidence: `provider-pass.json` and `provider-status.json`.

- webrtc_publish (instructor): PASS
- webrtc_publish (learner-one): PASS
- webrtc_publish (learner-two): PASS
- instructor_data_chat_to_learner: PASS
- connected_learner_removed: PASS
- old_token_replay_denied: PASS
- closed_room_cached_token_denied: PASS
- automatic_room_creation_disabled: PASS
- finish_for_everyone_disconnects_all: PASS

The critical negative assertion `automatic_room_creation_disabled` was observed as **PASS**: a signed but unauthorized roomJoin attempt against a non-existent room did not auto-provision it. The test also rejected cached room credentials after closing the room and verified that removing a connected learner did not evict the other two peers.

## Authenticated LUMA application proof — keep executions distinct

- **Previous recorded application QA** at commit `41eefebb47375c0e95627716c5e026578eb3b9a3`: 36/36 PASS, 0 FAIL, with admin + instructor + two learners and an unauthorized test account, Firebase emulators, real Cloud media, hand controls, moderated microphones, participant removal/revocation, mobile 375x812, and cached JWT denial. The source delta from `41eefebb4737` to `09a5bb2061d1` consists exclusively of added QA evidence. See the existing `../two-students-cloud-app-20261020/` proof, not a new claim of a fresh PASS.
- **Attempted fresh post-policy end-to-end recheck** at `09a5bb2061d1`: **4 PASS / 1 FAIL**. The runner aborted during early admin setup, before the instructor+two learners reached the media scenario, with exact error `The operation was aborted due to timeout`. The local Next.js cold interaction route took 72 seconds in the diagnostics, while the shared sandbox was under memory/swap pressure. **The root cause is not definitively established; this recheck was not accepted.** See `app-recheck-status.json`, `app-recheck-result.json` and the logs. Do not replace this failure with the earlier green report.

## Code and CI evidence

GitHub Actions **Product quality run [#39539116644](https://github.com/BernydotJar/LUMA/actions/runs/39539116644)** on PR #86 finished successfully. `verify`, `identity-roles`, `firestore`, `security` and `browser` all passed; `deploy` was skipped. CI checked the same source tree but did not exercise the newly changed LiveKit Cloud project setting with protected secrets.

## Release decision

Graph Harness (reviewed QA implementation `b3e991e`) validates its event chain, but `product-acceptance` reports **NO_GO**, with **20 required actions and 82 blockers**. There is no independently observed deployed Firebase revision, signed independent review or complete four-axis acceptance. A provider-specific setting now passing cannot waive these controls. Main merge, production release and feature enablement remain out of scope.
