# Authenticated security and media revocation findings

PASS in isolated emulators: unauthorised user refused access to classroom token 403; enrolled learner refused admin and instructor actions 403. Institutional revocation invoked by authenticated tenant admin persisted the learner-A entitlement state revoked and media roster ban, removed an active WebRTC participant, preserved instructor and learner B and denied learner A a new token 403.

Cloud-specific P0 remains BLOCKED. No Cloud project credentials were present; Cloud token cutoff, cached and SDK-refreshed JWT replay prevention, webhook signed re-entry controls, network reconnection and provider retry/outage have not been accepted. The prior OSS demo permitted cached JWT replay after eviction, as documented for self-hosted LiveKit; do not classify this as a Cloud failure.

This run used real local media and real Firebase Auth Emulator JWTs, not production identities or real merchant billing. Logs contain no customer emails or bearer JWTs. Source QA helper requires localhost, NODE_ENV development and demo project; no production build activation.
