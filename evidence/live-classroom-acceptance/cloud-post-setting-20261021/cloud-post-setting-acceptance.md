# LUMA LiveKit Cloud — post-setting acceptance

- **Date (UTC):** 2026-10-21T05:09:42.565Z
- **Cloud project:** LUMA, \`p_5650huuc5om\`.
- **Tested QA source SHA:** \`8274f5bc5c002038315064ea0c89740548336c92\`.
- **Strict combined Cloud acceptance:** **13 PASS / 0 FAIL**, \`PROVIDER_CLOUD_PASS\`.
- **Authenticated LUMA app UAT (previous exact product SHA):** **36 PASS / 0 FAIL**, source \`41eefebb47375c0e95627716c5e026578eb3b9a3\`. This was not rerun in the post-setting cycle; only the provider gate was rerun.
- **Graph Harness independent release acceptance:** **NO_GO**, 20 required actions and 82 outstanding proofs/blockers.

## What the project-setting test proved

1. **Fresh, never-created room:** A synthetic \`roomJoin\` JWT with \`roomCreate=false\` could not create or enter the room. Provider rejection reason was \`0\`; the Cloud RoomService list confirmed absence.
2. Three independent Chromium peers connected to an explicitly created room and published real synthetic camera and microphone tracks. All three media publications were observed through the real Cloud provider.
3. The instructor sent a reliable synthetic data message and the learner received it.
4. LiveKit Cloud expelled the connected learner and rejected that learner's still-valid cached JWT; instructor/learner B remained.
5. All remaining connected identities were revoked **before** room deletion using \`RemoveParticipant(revokeTokenTs)\`.
6. After room deletion, two consecutive Cloud RoomService queries confirmed absence.
7. The instructor's previously issued JWT could not rejoin; provider rejection reason \`0\`.
8. An independent orphan \`roomJoin\` replay could not create a room (provider read and explicit auth rejection).
9. A fresh explicitly created positive-control room still accepted a valid signed client after these denials. This excluded the false-positive explanation that the signaling network was down.

## Why both controls are needed

The earlier **delete-only** post-setting experiment, which intentionally skipped the token revocation step, still accepted the cached instructor JWT for a *previously existing* room, even after the Cloud RoomService returned an empty list twice. This was not a fresh-room auto-creation failure.

It is therefore important that the Cloud project-level automatic-creation setting remains OFF **and** the LUMA class-close implementation revokes all previously issued identities before deleting the room. Neither control alone should be presented as the full solution.

The LUMA application patch is in [PR #86](https://github.com/BernydotJar/LUMA/pull/86). This combined cloud test validates the provider contract behind that patch but is not a production runtime attestation.

## Scope, limitations and release status

The test used only a dedicated existing authorized LiveKit Cloud project, synthetic WebRTC media, short-lived QA credentials in memory and ephemeral rooms. It did not create production Firebase students. Active room inventory after the run: **0**. No Cloud account, billing, API key, webhook configuration or project flag was changed by the agent.

SDK-refreshed JWT captured after a long session, live deployed staging OAuth/Firebase identity and runtime SHA, signed webhooks, 10/50 participant load, network interruption and independent product UAT remain unapproved.

The prior \`npm run verify\` on the product patch passed lint, TypeScript, 356 unit tests, and a production Next.js build. The previous Firestore emulator suite passed 67 tests. New QA JS files passed \`node --check\`. A fresh GitHub CI run is required on the updated PR SHA.

**Enterprise release decision: NO-GO**, because Graph Harness independent source/UI/business/published-runtime evidence and sign-off are still absent. Do not merge, enable the production flag or deploy based on this provider PASS alone.

## Evidence

- \`cloud-provider-verification.json\` — full 13-action provider assertions and exact code SHA.
- \`cloud-provider-result.json\` — wrapper-copied provider result.
- \`status.json\` — strict execution exit and pass summary.
- \`execution.log\` — sanitised execution output.
- \`graph-harness-product-acceptance.json\` — exact post-setting test SHA, NO_GO, 82 blockers.
- \`evidence-manifest.json\` — SHA-256 digests of the above and this narrative.

Historical failure artifacts in \`cloud-provider-qa-20261020/\` and \`cloud-revoke-before-close-qa-20261020/\` were deliberately preserved unchanged.
