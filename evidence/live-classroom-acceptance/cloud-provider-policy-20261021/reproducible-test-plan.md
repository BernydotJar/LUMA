# Reproducibility and audit procedure

## Prerequisites

Use a reviewed copy of LUMA with exact git tree `defafc3d333ff8ff348eb106c77fe0f236e557d3`; verify `git rev-parse HEAD^{tree}`. Reuse the existing, owner-approved test-only LiveKit CLI configuration at `/opt/luma-livekit-qa/privatehome/.livekit/cli-config.yaml` with mode 0600 and an owner-private directory. The QA wrapper validates the exact project ID and WebSocket endpoint, and redacts provider secrets/JWTs; it must never print them. Use **only synthetic QA identities** and never pass production Firebase credentials to the emulator runner.

## Strict provider run (reproduced PASS)

```sh
LUMA_CLOUD_QA_ALLOWED=provider-only node scripts/qa/run-livekit-cloud-using-existing-cli.mjs
```

The acceptance criteria are `RESULT=PROVIDER_CLOUD_PASS`, `PASS_COUNT=9`, `RUN_EXIT=0`, and `automatic_room_creation_disabled` true in the structured report. Confirm the room is absent when the test ends.

## Application run (fresh replay not approved)

```sh
LUMA_CLOUD_QA_ALLOWED=app-e2e node scripts/qa/run-two-students-cloud-from-cli.mjs
```

The wrapper starts Firebase Auth/Firestore Emulators with `demo-luma-live-uat`, launches synthetic Chromium WebRTC participants, and never uses real learners. This step **failed on the post-setting rerun before media participation**; keep that failure in the audit. Do not mark the provider gate as failed because of a local Firebase/Next.js timeout, and do not mark the end-to-end app as green because the provider gate passed. For a new acceptance run, use a resource-isolated staging runner and require all 36 business assertions to pass.

## Graph Harness (expected NO_GO)

```sh
PYTHONPATH=/path/to/pinned/Graph-harness-sdlc python3 -m graph_harness product-acceptance --manifest docs/enterprise/live-classroom-acceptance.json --evidence evidence/live-classroom-acceptance/proofs.json --repo-root . --source-revision 09a5bb2061d1e622cbf3a7365c521b4c1dba20d1 --pretty
```

Use Graph Harness SHA `b3e991e` when comparing these proofs. Exit code 2 / `NO_GO` is a protective acceptance result, not a test to ignore. Only an independent authorized reviewer can certify complete four-axis evidence against the final deployed SHA.

## Required follow-ups

1. Run authenticated LUMA end to end on an independently isolated runner after enabling a **separate Firebase staging runtime**, preserving synthetic accounts, no production writes and actual Cloud audio/video.
2. Configure **protected GitHub `livekit-acceptance` environment secrets** directly through GitHub by an authorized custodian. That environment currently has no secrets and is restricted to protected branches; do not transfer personal CLI keys via logs, PRs or chat.
3. Bootstrap the reviewed `workflow_dispatch` Cloud QA workflow through an explicitly approved CI-only change, then pin the tested commit and archive artifacts. Never expose environment secrets to untrusted PR code.
4. Test Cloud credential refresh after a long class, disconnected-learner old JWT replay, signed webhook retries/out-of-order events, Firebase revocation data durability, network loss, mobile Safari and measurable load for 10/50 participants.
5. Obtain independent Graph Harness acceptance, exact Firebase staging deployment revision, approved privacy and retention policy, release signer evidence, rollback plan and a separate production approval. **Do not merge or deploy on CI PASS alone.**
