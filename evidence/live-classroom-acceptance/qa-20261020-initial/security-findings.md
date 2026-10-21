# Security and adversarial findings

## P0 acceptance gap — live revocation and JWT replay in intended Cloud

**Status:** BLOCKED, not a proven Cloud vulnerability. During a real local OSS call, `RemoveParticipant` expelled an active participant but did not invalidate that participant's old JWT; replay connected successfully. Official documentation describes this as a self-hosted limitation. Before production GO, use LiveKit Cloud and run the original JWT, refreshed JWT, concurrent refund+token issuance, reconnection, signed-join webhook and actual remote-media-cessation tests.

## Verified source-level/local controls

- **350 passing tests** across the full non-emulator source suite; 98 emitter/emulator-conditioned tests skipped in that invocation.
- **67 Firestore emulator tests passed**, spanning refund/outbox orchestration, institutional grants, classroom revocation, attendance and interaction. The LiveKit service is mocked in these tests.
- Four Playwright cases passed for unauthenticated classroom and moderation denial across desktop/mobile.
- Both public hosts rejected unauthenticated POST token issuance and moderation with HTTP 401 in synthetic read-only probes.
- Local real-provider removal preserved instructor and peer connections.

## Missing negative proof

No authorized tests were run against a deployed tenant/cohort for cross-tenant access, Firebase token revocation, instructor impersonation, malicious metadata updates, invalid webhook signatures, provider timeouts, multiple valid entitlements, concurrent refunds, refresh-token reuse or Firestore outage. Unit tests alone do not close the product acceptance dimension for these risks.

**Threat model:** unauthorized replay of cached credentials after business revocation is P0 to **verify**; untrusted webhook replays and forged instructor actions remain release-gate scenarios. No exploit activity, aggressive testing, account mutation or load was directed at production.

Reference frameworks: OWASP ASVS, ISO/IEC 25010, and WCAG 2.2 AA guide acceptance coverage; no certification of any framework is claimed.
