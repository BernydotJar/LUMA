# LiveKit provider report

**This incremental run:** Cloud NOT_TESTED/BLOCKED. No live Cloud keys or authorized staging endpoint available; no provider connections attempted against production.

**Prior independent evidence in PR #77:** `qa-20261020-initial/livekit-provider-report.md` documents three real Chromium WebRTC peers on local LiveKit OSS, publication of camera/microphone, peer reception, one 22 ms loopback eviction observation, and expected old-token replay on OSS. Those results are tied to that earlier run and are **not** a Cloud guarantee or a fresh measurement at the present source SHA.

**Cloud acceptance required:** room API `RemoveParticipant` must evict learner A, leave instructor/B connected, and reject rejoin with the original **and refreshed** learner tokens. Pass an explicit `revokeTokenTs` bigint in Unix seconds, verify clock skew/cutoff, and independently assert that LUMA refuses fresh credentials and its signed join webhook fences old tokens. Capture observable disconnect/rejoin windows and errors from Cloud.

Official references: https://docs.livekit.io/frontends/reference/tokens-grants/ ; https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/ . Cloud-only revocation cannot be proven by LiveKit OSS.

**No audio/video performance claims, SLA, or load acceptance** are added in this incremental run.
