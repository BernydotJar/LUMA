# LUMA delivery operations

## Delivery contract

LUMA uses GitHub Actions to validate a commit and release its immutable source archive to the existing Firebase App Hosting backend. A green build, an HTTP 200, and a production-verified release are different states. Only a successful rollout, matching serving build and Git SHA, successful browser checks, and final traffic recheck produce `VERIFIED`.

Repository: `BernydotJar/LUMA`. Project: `luma-learning-intelligence` (`161313706596`). Region: `us-central1`. Backend: `luma`. Production: `https://luma--luma-learning-intelligence.us-central1.hosted.app`.

The runtime, Firestore database, Firebase Authentication configuration, secrets and backend are preserved. Capacity remains one CPU, 512 MiB, zero minimum instances, two maximum instances and concurrency 80. This change creates no staging backend and no additional permanent runtime.

## Required validation

The stable required checks are `verify`, `security`, `firestore`, `identity-roles`, and `browser`. GitHub requires an up-to-date branch and accepts these check names only from the GitHub Actions application, ID 15368. Pull requests are mandatory; force pushes and branch deletion are disabled; administrators must satisfy the same merge rules. Conversation resolution is required. A separate human approval count is not configured for this owner-operated repository: this must not be represented as a two-person approval policy.

`verify` executes lint, TypeScript, unit tests, source preparation and a production build. `security` audits production dependencies at high severity. `firestore` and `identity-roles` execute the existing stateful tests against isolated emulators. `browser` downloads the exact production build from `verify` and runs the complete desktop/mobile Playwright suite using `next start`. CI does not reuse a development server. Flaky tests fail the run even if a retry passes. The pre-existing viewport-specific skips are retained; no regression test was removed to obtain a green result.

The remediation of the prior seven browser failures is isolated in PR #32, commit `63c7dc471df1807af6d63941b5a95af68e045623`. All five jobs passed in run `38028888947`; merge commit `4c1b58b133e83becdaa9e1645b15b73cd046567f`. The fixes preserve adaptive recommendation assertions, exercise the visible mobile navigation, expose the selected secondary Studio destination, and check semantic objects where the product actually renders them.

## Release and source identity

The deployment job runs only for a push to this repository's `main`, after all five jobs succeed. The `production` GitHub environment accepts protected branches. OIDC independently restricts the exact repository and owner IDs, `main`, the `production` subject, the `quality.yml` workflow and the push event.

Before cloud mutation, the release script validates a source-bound Graph approval and the complete existing Graph event hash chain. It then independently reads GitHub to confirm the run, commit, protected branch and all five successful jobs. A skipped or missing required job is not a success. The latest main commit is checked again immediately before promotion. A concurrent change to serving traffic aborts promotion. Production jobs are serialized with cancellation disabled.

`prepare.mjs` builds a ZIP from `git archive` at the exact tested SHA, using an explicit application-root allowlist. Historical evidence, arbitrary workspace files and credentials are not uploaded. Forbidden credential filenames are rejected. The generated manifest contains repository, SHA, tree, commit time and workflow run ID. A SHA-256 checksum binds the uploaded archive to the workflow artifact. Cloud Storage uploads use a create-only generation precondition.

App Hosting rebuilds the **same verified source** with its managed build environment; it does not reuse the identical binary built on the GitHub runner. This distinction is intentional and is checked through provenance, the serving build, the version endpoint, capacity checks and production smoke verification. Do not claim binary reproducibility across the two build environments.

`GET /api/version` returns build provenance only and disables caching. It never serializes environment variables. An unstamped development manifest returns 503 rather than inventing a commit.

## Keyless authentication and permissions

Release account: `luma-github-release@luma-learning-intelligence.iam.gserviceaccount.com`.

Provider: `projects/161313706596/locations/global/workloadIdentityPools/github-luma/providers/production`.

The custom `lumaAppHostingRelease` role grants nine read/create/use permissions needed to inspect the backend, create/read builds and rollouts, read traffic/operations, and identify/use the project. It grants no backend update/delete, IAM administration, secret access, database permission or runtime service-account administration. `roles/storage.objectCreator` is scoped to the existing App Hosting source bucket. The service account has no user-managed keys.

The environment variables `LUMA_WIF_PROVIDER` and `LUMA_DEPLOY_SERVICE_ACCOUNT` hold public identifiers, not credentials. OIDC credentials are short-lived and created only inside the deployment job. They are not included in release archives or evidence artifacts.

`bootstrap-wif.mjs` is an operator-only, fixed-project bootstrap using the existing Firebase CLI login. Its default mode inspects without writing. `--apply` creates only the named release identity, role, pool/provider and additive IAM bindings. Existing IAM bindings are retained with concurrency etags. Existing unexpected role/provider configuration causes a stop instead of silently broadening trust. `configure-github.mjs` verifies actual successful check names before configuring protection and environment variables.

## Graph operating model

Producer -> IBM Granite adversarial review -> finding dispositions/fixes -> independent deterministic and GitHub verification -> Graph release gate -> deployment -> Graph production verification.

The repository's existing Graph Harness definitions and append-only event ledger are used. The kernel at `GRAPH_HARNESS_ROOT` is not copied or modified. `record-cicd.py` uses `GraphRuntime`/`EventStore` for every write and validates the existing chain before append. No event hash is repaired or rewritten.

`review-gate.mjs` binds approval to the current source contents, actual critic/verifier artifacts, and a current PASS event for `cicd-release`. Missing approval, source drift, altered evidence, malformed chain, stale/failed evidence or unresolved critical/high findings block deployment. The `cicd-production` gate is separate: the node cannot become DONE from CI alone.

A local inference failure is a review blocker, not an approval. The review script preserves failures and uses streamed local Ollama output to avoid idle HTTP-header timeouts. The raw Granite verdict is preserved even when an independent verifier documents a false positive.

## Evidence and current-state interpretation

Evidence lives in `evidence/cicd-enterprise/` and in workflow artifacts. Each deployment preserves the manifest, source checksum, build/rollout IDs, phase ledger, screenshots and smoke results. A failed release retains its evidence. Workflow summaries state `VERIFIED`, `FAILED`, rollback state or blocked-before-promotion, never a synthetic success.

Configuration evidence proves configuration, not that OIDC execution or a production rollout has succeeded. Consult `release-approval.json`, the actual Actions run, `production/release-result.json`, `production/smoke.json` and the Graph production gate for those later states. The initial production baseline was an archive build without verifiable SHA; that fact is not retroactively filled in.

## Cost and recovery boundaries

No capacity or billing-plan increase is part of this implementation. Source archives, managed builds, retained artifacts and normal runtime traffic still consume their providers' resources; this is not a claim of zero cost. No new paid vendor or permanent runner is introduced. Preserve source/build evidence required for rollback before applying retention cleanup. Do not delete old builds merely because a new deployment succeeded.

Repository administrators retain policy-recovery access in Settings, but there is no configured merge bypass. A policy change for an incident must be explicit, recorded and restored. Never weaken checks or add `continue-on-error` to push a broken release through.

## Primary references

- Firebase App Hosting build/archive API: https://firebase.google.com/docs/reference/apphosting/rest/v1beta/projects.locations.backends.builds
- Rollout creation and non-mutating validation: https://firebase.google.com/docs/reference/apphosting/rest/v1beta/projects.locations.backends.rollouts/create
- Google Cloud deployment-pipeline Workload Identity Federation: https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
