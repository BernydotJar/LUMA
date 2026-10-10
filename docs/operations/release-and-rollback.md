# LUMA release and rollback runbook

## Normal promotion

1. Work on a feature branch. Preserve other worktrees. Run lint, type checking and unit tests; do not disable failing checks.
2. Obtain the Granite adversarial result and independent finding dispositions for the exact source digest. Preserve the raw model verdict and any inference error.
3. Open a pull request and wait for all five required jobs. Record the actual run with the existing Graph Harness: `python3 scripts/release/record-cicd.py --phase release --ci-run RUN_ID`. This requires matching source/review evidence and successful checks for the current commit. It appends events; it does not reset the ledger.
4. Commit the resulting evidence and approval. Only metadata may change after source approval. Let the final PR checks complete and merge through the protected branch.
5. The main workflow independently repeats validation, obtains short-lived OIDC credentials, uploads the verified archive, creates a build and checks its capacity and provenance. It then confirms main and traffic have not moved before creating a rollout.
6. A successful rollout alone is not the end. The expected build must serve 100% traffic, `/api/version` must match the tested SHA, and the desktop/mobile browser checks must pass. The rollback request is validated without changing traffic; only then may the final release result become `VERIFIED`.

Artifacts are namespaced by workflow attempt. When repeating a candidate, rerun the entire workflow so build, source and browser artifacts belong to the same attempt; rerunning only a downstream failed job deliberately cannot reuse an earlier attempt implicitly.

Do not use a local manual deployment to bypass a failed main workflow. If an artifact is missing, a run is superseded, or a review digest is stale, repair the cause rather than changing the expected SHA. Review approval is not automatically granted by the existence of this runbook.

## Verification coverage

Production smoke checks the root, experience, learner home, Studio, library and certificate console; visible page headings; JavaScript errors and first-party HTTP 5xx; version and health endpoints; the three themes and theme persistence; one most-specific selected Studio link; visible login navigation; and anonymous rejection from protected coach/certificate APIs.

Authenticated role grant, token revocation and persistence are exercised in the isolated Auth/Firestore emulator job. Production smoke does not impersonate a real participant or perform a live Google sign-in. Do not represent those anonymous browser checks as a full live SSO or participant-data test.

## Failure handling

| Point of failure | Behavior |
| --- | --- |
| Required CI job, missing review, WIF, artifact or source mismatch | Promotion stops. No production rollout should have been created. |
| New main commit or changed production traffic | The older candidate stops; it does not overwrite a newer release. |
| Cloud build or capacity/provenance check | No candidate rollout is promoted. Preserve logs and uploaded-source evidence. |
| Rollout, serving SHA or browser smoke | The workflow fails and attempts guarded recovery. It never changes the failed run to green. |
| Previous verified revision remains current | Recovery records that no traffic change is needed. |
| Another release changed traffic | Automatic recovery refuses to overwrite it. |
| No proven prior revision or traffic is ambiguous/reconciling | Recovery stops for operator investigation rather than guessing a rollback target. |
| Manual cancellation | Treat the release as unverified. Inspect actual traffic, workflow evidence and version before retrying. |

An automatically eligible rollback target must be the captured previous build, still READY, with matching exposed SHA and release labels, and a successful prior main workflow whose deployment job succeeded. A label or HTTP 200 alone is not proof of a previously verified release.

The migration baseline `build-2026-10-10-001` was serving normally but had no verified Git SHA. It is not silently upgraded to a SHA-proven known-good release. The first gated deployment therefore has a stricter manual-recovery boundary if it fails after promotion. A separate operator-only `validateOnly=true` rollout check against this READY baseline returned success with traffic unchanged at 100%; see `evidence/cicd-enterprise/final/prior-rollback-validate-only.json`. This validates the rollback request shape and target availability but **does not** prove that a future actual rollback will succeed. If the first SHA-proven deployment fails after traffic changes, follow the captured baseline and manual incident-recovery procedure instead of representing the unknown original SHA as verified.

## Safe rollback validation

The normal deployment executes `node scripts/release/apphosting.mjs rollback-validate` inside the authenticated production job. It calls the App Hosting rollout API with `validateOnly=true` for the captured previous READY build. This validates the request without creating resources or changing traffic. It is not a destructive rollback drill and does not prove that an actual traffic transition has occurred.

The `recover` command is restricted to the verified GitHub main context and refuses cross-project/backend targets. It checks that the candidate is still the serving build before restoring the captured verified predecessor. After recovery, the predecessor must serve 100% traffic and expose its expected SHA. The result remains `ROLLED_BACK_REQUIRES_INCIDENT_REVIEW`, not `VERIFIED`.

For operator intervention, inspect the saved `release-result.json`, the existing App Hosting backend's current traffic and the recorded previous build first. Use only an explicitly identified READY build in the same project/region/backend. Validate the rollout request before applying it. Keep the source/build evidence and incident record; never delete the failing build to hide a failed release. After any manual restoration, repeat version, health and browser verification and record the observed result in Graph Harness.

## Evidence and operational commands

`evidence/cicd-enterprise/` holds CI, IAM/protection, critic and Graph receipts. The `production-evidence-RUN_ID-ATTEMPT` workflow artifact holds the manifest, serving build/rollout ledger, smoke results and screenshots. Download that artifact into `evidence/cicd-enterprise/production/` before recording final production verification:

```sh
python3 scripts/release/record-cicd.py --phase production --ci-run RUN_ID
```

This requires a successful deployment run matching the checkout, the verified release ledger, successful smoke evidence and a fresh live version recheck. It cannot mark the node DONE from a CI-only result.

The record helper uses the existing kernel through `GRAPH_HARNESS_ROOT`; default sandbox location is `/workspace/projects/Graph-harness-sdlc-control-plane`. Never pass a force-reset option or manually edit event hashes. Preserve the initial chain and append observations. Post-deployment evidence can be pushed to a dedicated evidence branch/artifact without creating another production release merely to record the previous one.

## Genuine completion criteria

CI green; enforced main protection; successful OIDC execution with the intended principal; reviewed source bound to Graph approval; successful main workflow and rollout; matching build/SHA at 100% traffic; successful production smoke; non-mutating rollback validation; preserved evidence; Graph production gate PASS. A missing criterion remains visible as BLOCKED/PARTIAL.


## First verified enterprise deployment: production handoff (10 October 2026)

* Protected `main` commit: `7daba30e1469bda7b9198353d95f3f7db7b74ee1`.
* GitHub workflow: https://github.com/BernydotJar/LUMA/actions/runs/38031714611 — **attempt 4, SUCCESS**, including the deployment job.
* Serving Firebase build: `gh-7daba30e1469-38031714611-4` with 100% traffic.
* Rollout: `gh-7daba30e1469-38031714611-4`, `SUCCEEDED`.
* `/api/version`: exact SHA on both native App Hosting and `luma.lch-app.cloud` public endpoints.
* Production smoke: 12 routed desktop/mobile checks, themes/persistence, Studio navigation, login entry and anonymous role boundaries **PASS**, no JavaScript or first-party HTTP 5xx errors.
* Independent verification: `evidence/cicd-enterprise/final/independent-production-verification.json` **VERIFIED**; Graph Harness `LUMA-CICD-002-release-pipeline` **DONE** with appended production gate evidence.
* The prior build `build-2026-10-10-001` was READY with 100% traffic before promotion and has a successful non-mutating `validateOnly` request receipt. Its original SHA remains unverified; there was no live reversal of user traffic.
* Next deployment: capture and independently validate the current SHA-proven build as its eligible rollback target. Never use the old unproven build as an automatically verified rollback target.

This handoff is historical evidence for one production release, not a change to the CI gate definitions. The actual GitHub Actions release evidence artifact is https://github.com/BernydotJar/LUMA/actions/runs/38031714611/artifacts/11679961688.
