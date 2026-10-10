# LUMA delivery operations

## Delivery contract

LUMA uses GitHub Actions to validate a commit and release its immutable source archive to the existing Firebase App Hosting backend. A green build, an HTTP 200, and a production-verified release are different states. Only a successful rollout, matching serving build and Git SHA, successful browser checks, and final traffic recheck produce `VERIFIED`.

Repository: `BernydotJar/LUMA`. Project: `luma-learning-intelligence` (`161313706596`). Region: `us-central1`. Backend: `luma`. Production: `https://luma--luma-learning-intelligence.us-central1.hosted.app`.

The runtime, Firestore database, Firebase Authentication configuration, secrets and backend are preserved. Capacity remains one CPU, 512 MiB, zero minimum instances, two maximum instances and concurrency 80. This change creates no staging backend and no additional permanent runtime.

## Required validation

The stable required checks are `verify`, `security`, `firestore`, `identity-roles`, and `browser`. GitHub requires an up-to-date branch and accepts these check names only from the GitHub Actions application, ID 15368. Pull requests are mandatory; force pushes and branch deletion are disabled; administrators must satisfy the same merge rules. Conversation resolution is required. A separate human approval count is not configured for this owner-operated repository: this must not be represented as a two-person approval policy.

`verify` executes lint, TypeScript, unit tests and source preparation. It extracts the exact release ZIP into a separate runner-temporary directory, installs its locked dependencies, and builds that archive rather than an implicitly larger checkout. Service contract fixtures needed by the existing TypeScript tests remain included. `security` audits production dependencies at high severity. `firestore` and `identity-roles` execute the existing stateful tests against isolated emulators. `browser` downloads the exact production build from `verify` and runs the complete desktop/mobile Playwright suite using `next start`. CI does not reuse a development server. Flaky tests fail the run even if a retry passes. The pre-existing viewport-specific skips are retained; no regression test was removed to obtain a green result.

The remediation of the prior seven browser failures is isolated in PR #32, commit `63c7dc471df1807af6d63941b5a95af68e045623`. All five jobs passed in run `38028888947`; merge commit `4c1b58b133e83becdaa9e1645b15b73cd046567f`. The fixes preserve adaptive recommendation assertions, exercise the visible mobile navigation, expose the selected secondary Studio destination, and check semantic objects where the product actually renders them.

## Release and source identity

The deployment job runs only for a push to this repository's `main`, after all five jobs succeed. The `production` GitHub environment accepts protected branches. OIDC independently restricts the exact repository and owner IDs, `main`, the `production` subject, the `quality.yml` workflow and the push event.

Before cloud mutation, the release script validates a source-bound Graph approval and the complete existing Graph event hash chain. It then independently reads GitHub to confirm the run, commit, protected branch and all five successful jobs. A skipped or missing required job is not a success. The latest main commit is checked again immediately before promotion. A concurrent change to serving traffic aborts promotion. Production jobs are serialized with cancellation disabled.

`prepare.mjs` builds a ZIP from `git archive` at the exact tested SHA, using an explicit application-root allowlist. Historical evidence, arbitrary workspace files and credentials are not uploaded. The services source and contract fixtures are included because existing TypeScript tests import those contracts; this does not provision or deploy another service. Forbidden credential filenames are rejected. The generated manifest contains repository, SHA, tree, commit time and workflow run ID. A SHA-256 checksum binds the uploaded archive to the workflow artifact. Cloud Storage uploads use a create-only generation precondition.

App Hosting rebuilds the **same verified source** with its managed build environment; it does not reuse the identical binary built on the GitHub runner. This distinction is intentional and is checked through provenance, the serving build, the version endpoint, capacity checks and production smoke verification. Do not claim binary reproducibility across the two build environments.

`GET /api/version` returns build provenance only and disables caching. It never serializes environment variables. An unstamped development manifest returns 503 rather than inventing a commit.

## Keyless authentication and permissions

Release account: `luma-github-release@luma-learning-intelligence.iam.gserviceaccount.com`.

Provider: `projects/161313706596/locations/global/workloadIdentityPools/github-luma/providers/production`.

The custom `lumaAppHostingRelease` role grants nine read/create/use permissions needed to inspect the backend, create/read builds and rollouts, read traffic/operations, and identify/use the project. It grants no backend update/delete, IAM administration, secret access, database permission or runtime service-account administration. `roles/storage.objectCreator` is scoped to the existing App Hosting source bucket. The service account has no user-managed keys.

### Production build identity: scoped actAs remediation (10 October 2026)

The first OIDC-authenticated production attempt reached source upload but App Hosting rejected `builds.create` with `iam.serviceAccounts.actAs` denied on `firebase-app-hosting-compute@luma-learning-intelligence.iam.gserviceaccount.com`. This is distinct from the initial immutable-subject failure. An operator inspected the runtime service account's own IAM policy (zero bindings), reviewed the narrow scope with local IBM Granite (`CONDITIONAL_PASS` with one low finding), and granted only `roles/iam.serviceAccountUser` to `luma-github-release@luma-learning-intelligence.iam.gserviceaccount.com` **on that one compute service account**. No project-wide impersonation role, runtime role edit, service account key, additional backend or broad Cloud IAM grant was created. The write preserved IAM etags, and read-back confirmed exactly one scoped binding.

Evidence: `evidence/cicd-enterprise/final/failed-deploy-attempt2.json`, `actas-remediation.json`, `actas-inspection.json`, `granite-actas-review.json` and the read-only-first operator script `grant-runtime-actas.mjs`. Normal production delivery never executes the operator script. The ongoing GitHub Actions attempt must still finish every quality check, build/rollout, browser smoke, SHA comparison, and release ledger; scoped IAM success alone is not a production release.

Google Cloud reference: https://docs.cloud.google.com/iam/docs/service-accounts-actas

The environment variables `LUMA_WIF_PROVIDER` and `LUMA_DEPLOY_SERVICE_ACCOUNT` hold public identifiers, not credentials. OIDC credentials are short-lived and created only inside the deployment job. They are not included in release archives or evidence artifacts.

`bootstrap-wif.mjs` is an operator-only, fixed-project bootstrap using the existing Firebase CLI login. Its default mode inspects without writing. `--apply` creates only the named release identity, role, pool/provider and additive IAM bindings. Existing IAM bindings are retained with concurrency etags. Existing unexpected role/provider configuration causes a stop instead of silently broadening trust. `configure-github.mjs` verifies actual successful check names before configuring protection and environment variables.

## Verified immutable-subject migration

GitHub's live repository OIDC settings report `use_immutable_subject=true` and `sub_claim_prefix=repo:BernydotJar@16258017/LUMA@1403901485`. The initial name-only subject condition was rejected before the first deployment. The actual production condition now requires:

```text
assertion.sub == 'repo:BernydotJar@16258017/LUMA@1403901485:environment:production'
```

All other repository ID, owner ID, main-ref, exact-workflow and push-event predicates remain unchanged. No role or permission was added. The correction and read-back are recorded in `evidence/cicd-enterprise/final/immutable-oidc-migration.json`; the raw Granite review is `granite-oidc-review.json`. The full main workflow was rerun after this operational correction. The first rejected attempt is retained as a failure, not relabeled successful.

The original bootstrap script and `identity-configuration.json` preserve the initial provisioning state. The audited, idempotent migration entry point is `evidence/cicd-enterprise/final/migrate-immutable-oidc.mjs`: its default mode inspects; `--apply` updates only this literal subject after checking the live GitHub setting. It rejects unexpected independent policy drift. Do not replay the original bootstrap's `--apply` over the migrated policy; its old-condition guard intentionally stops instead of reverting the active trust policy. Normal delivery uses OIDC and does not execute either operator bootstrap.

Reference: https://docs.github.com/en/actions/reference/security/oidc#immutable-subject-claims

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

## Verified first GitHub Actions production release — 10 October 2026

The approved main SHA `7daba30e1469bda7b9198353d95f3f7db7b74ee1` completed the **fourth full attempt** of [GitHub Actions run 38031714611](https://github.com/BernydotJar/LUMA/actions/runs/38031714611), with all six jobs successful: `verify`, `security`, `firestore`, `identity-roles`, `browser`, and `deploy`. The separate PR #33 run `38031484177` also passed its five required checks before protected merge.

The first attempt was rejected by immutable GitHub OIDC subject mismatch, and the second by missing `iam.serviceAccounts.actAs`; their actual errors and independently reviewed narrow remediations remain in `evidence/cicd-enterprise/final/`. The third was canceled after an unusual GitHub-hosted runner dependency-install stall *before Playwright began*; the complete workflow was rerun rather than treating its unfinished gate as PASS. Attempt four completed all gates and independently verified production.

The successful production build ID is `gh-7daba30e1469-38031714611-4`. Its Firebase rollout is `projects/luma-learning-intelligence/locations/us-central1/backends/luma/rollouts/gh-7daba30e1469-38031714611-4`. The rollout reached `SUCCEEDED` and the build reached `READY` with **100% of backend traffic** on that build. The cache-disabled `GET /api/version` response was directly verified to expose the expected Git SHA and GitHub run ID on both the native Firebase domain and `https://luma.lch-app.cloud`. The independent verifier checked backend/repository/protection, build labels, rollout and traffic, capacity, health, release manifest and smoke results.

Production browser smoke: **PASS** — six critical routes on desktop plus six on mobile; three themes and persistence, most-specific selected Studio navigation, authentication-entry navigation and anonymous role restrictions on both layouts; zero recorded JavaScript or first-party HTTP 5xx errors. Production `/api/health`: HTTP 200. Build capacity was unchanged (1 CPU / 512 MiB / 0–2 instances / concurrency 80). The predecessor `build-2026-10-10-001` remains available as a READY build but its historical source SHA was not proved. A `validateOnly=true` rollback-request check succeeded without a traffic change; **no destructive rollback drill was performed**.

Release controller receipt: `evidence/cicd-enterprise/production/release-result.json` with status `VERIFIED`, timestamped hash-linked events ending in `PRODUCTION_VERIFIED`; `production/smoke.json` has status `PASS` and no errors. Independently verified summary: `evidence/cicd-enterprise/final/independent-production-verification.json`. Graph Harness event ledger was appended through the existing kernel (not manually edited), and its `LUMA-CICD-002-release-pipeline` node reached `DONE` after `cicd-production` passed; 659 events in the validated chain.

The exact source/build, smoke screenshots, and runner logs are preserved in GitHub Actions workflow artifacts, including [production-evidence-38031714611-4](https://github.com/BernydotJar/LUMA/actions/runs/38031714611/artifacts/11679961688). Screenshots remain outside Git source history. This evidence-only documentation update is kept on a separate audit branch to avoid an unnecessary additional `main` push and Firebase build for a historical release record.

### Remaining operating boundaries

* The browser smoke proves anonymous authorization and login navigation. Real Google SSO with authorized tenant participants is not asserted as part of this production run; Auth/Firestore role flows passed their isolated emulator gates.
* The predecessor without SHA provenance is not eligible for unattended rollback; incident restoration from that baseline requires deliberate operator verification. From this release forward, the first SHA-verified build provides a provable rollback target for a **future** release if its integrity remains intact.
* Cloud Build and retained source/artifact storage incur normal provider costs. No additional backend, preview environment, extra runtime capacity, or persistent CI runner was created.

## Primary references

- Firebase App Hosting build/archive API: https://firebase.google.com/docs/reference/apphosting/rest/v1beta/projects.locations.backends.builds
- Rollout creation and non-mutating validation: https://firebase.google.com/docs/reference/apphosting/rest/v1beta/projects.locations.backends.rollouts/create
- Google Cloud deployment-pipeline Workload Identity Federation: https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
