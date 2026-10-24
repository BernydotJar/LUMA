# LiveKit provider validation

- **Executed:** 2026-10-20 UTC.
- **Server:** local loopback LiveKit OSS v1.13.10, not Cloud.
- **Clients:** three separate Chromium contexts with fake audio and video devices and independent ephemeral JWTs.
- **Scope:** direct LiveKit SDK and server API; no Firebase Auth, Stripe/Hotmart callback, LUMA UI or customer identity.

## Real AV and media

The instructor and learners A/B each published microphone and camera. Each participant independently received two remote *subscribed* live audio tracks and two remote videos whose browser video elements had decoded nonzero dimensions. Learner B toggled microphone and camera off/on from the SDK. All assertions passed; see `livekit-multimedia-provider.json`.

## Forced removal and replay

`RoomServiceClient.removeParticipant(room, learner-a, { revokeTokenTs: ... })` disconnected learner A. The instructor and learner B remained connected. **Removal-to-observed-client-disconnect was 22 ms on this single loopback execution**; no latency SLA is inferred. After removal, the earlier valid learner-A JWT could establish a new connection to OSS. This is a confirmed local OSS token-replay limitation, **not** a finding about Cloud.

The official provider documentation states that token revocation is Cloud-only. With LiveKit Cloud, explicitly provide a `revoke_token_ts` Unix-seconds cutoff close to server time to avoid the default one-minute buffer and test both original and refreshed tokens:
- https://docs.livekit.io/frontends/reference/tokens-grants/
- https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/

## Missing Cloud acceptance

No Cloud room, WebRTC media, `revoke_token_ts` verification, signed webhook delivery/retry timing, token-refresh replay, load at 10/50 participants, mobile Safari or instructor–learner business identity was tested. **LiveKit Cloud provider verdict: BLOCKED/NOT_TESTED.**
