# LUMA — LiveKit Cloud closure / disconnected-token acceptance

**Product gate: NO-GO until independent four-axis acceptance and published staging SHA attestation.**
This procedure validates a specific provider and class-close threat model, not production readiness.

## Why this scenario matters

A learner can leave a running classroom voluntarily while retaining a valid roomJoin
JWT. DeleteRoom alone does not prove credential invalidation; the Cloud project setting
to disable automatic creation also does not replace per-identity revocation.

Official Cloud contract:
https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/
RemoveParticipant accepts a participant who left the room; with explicit revoke_token_ts
it revokes that token and suppresses the participant-not-found error. An omitted cutoff
may leave refreshed tokens usable (see https://docs.livekit.io/frontends/reference/tokens-grants/).

LUMA completes the business session before attempting provider cleanup, enumerates all
previously issued Firestore identities, revokes them with explicit per-request cutoffs,
persists a durable fence and deletes the room. Provider failures return retryable 503,
never a fictitious success.

## Reproducible Cloud provider QA (18 assertions)

Use only existing authorized test project p_5650huuc5om, synthetic identities, and an
approved mode-0600 Cloud CLI config held by Cloud Sandbox at
/opt/luma-livekit-qa/privatehome/.livekit/cli-config.yaml. Never output the config.

    LUMA_CLOUD_QA_ALLOWED=provider-departed node scripts/qa/run-livekit-cloud-using-existing-cli.mjs

The wrapper validates project/host and masks secrets. The test checks fresh-room
denial, three real audio/video publishers, reliable instructor data, connected
learner eviction and stale JWT rejection. It then adds an independent learner
who joins and voluntarily disconnects, verifies provider roster absence, calls
RemoveParticipant with an explicit cutoff for that absent identity, rejects
a cached JWT replay while the instructor and other learner remain connected,
revokes remaining identities, deletes the room, confirms provider absence,
rejects both learner/instructor cached JWTs and finishes with a positive Cloud
connection control.

**Negative replay tests require an unexpired original JWT.** Tokens have a five-minute
TTL; the runner checks the in-memory expiration before each replay and rejects results
when fewer than 60 seconds remain. Expiration is not acceptable proof of revocation.
No raw JWT or private provider credential is logged.

Required result: PROVIDER_CLOUD_PASS, PASS_COUNT=18, RUN_EXIT=0, zero failures.
Evidence is stored in
evidence/live-classroom-acceptance/cloud-departed-learner-20261021/.

## Route-level regression (six unit tests)

    npm run test:run -- 'src/app/api/live/classrooms/[offeringId]/[sessionId]/close/route.test.ts'
    npm run lint
    npm run typecheck
    npm run test:run

The six tests cover disconnected token owners, business-complete before revoke,
persisted revocation fence before DeleteRoom, provider failure/503 and recovery,
idempotent retry, learner authorization denial and roster capacity fail-closed.

These route tests use mocked Cloud/Firestore; they do not constitute Firebase
staging authentication or deployment acceptance.

## GitHub manual provider workflow and authorization

The new workflow .github/workflows/livekit-cloud-staging-qa.yml is manual-only.
It requires a trusted protected Git ref, an exact SHA match, non-production
GitHub environment livekit-acceptance, an exact project hostname, locked Node
dependencies and isolated Playwright Chromium. Artifact upload is conditioned on
a secret/JWT scan.

The workflow must be reviewed and merged to a protected branch before dispatch.
The GitHub environment currently has **zero test secrets**; an authorized custodian
must configure LIVEKIT_CLOUD_TEST_URL, LIVEKIT_CLOUD_TEST_API_KEY and
LIVEKIT_CLOUD_TEST_API_SECRET directly in GitHub environment settings.
Do not transfer personal CLI credentials to untrusted workflows or PR comments.
Production GitHub environment, Firebase and deployment identities are out of scope.

## Remaining required release evidence

- A separately deployed Firebase staging project and its attested source SHA.
- Real LUMA authenticated three-person class, including voluntarily departed
  student closure and reconnect replay, on that deployed staging runtime.
- Long-session refreshed JWT, signed-webhook failure/replay/order and audit paths.
- 10/50 participant load, device/browser/accessibility, latency SLO and rollback.
- Independent Graph Harness four-axis review of code, actionable UI, complete
  customer journey and deployed revision, including a signed authorized decision.

Provider QA PASS is not enterprise GO. Do not merge or deploy to production on
the basis of GitHub Actions success alone.
