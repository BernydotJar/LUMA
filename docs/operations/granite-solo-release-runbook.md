# LUMA Solo-Maintainer Granite release — protected bootstrap and evidence SOP

Status: Implementation in PR #103; **not enabled on production** until the full pipeline executes successfully on protected main.

## Why the migration exists

LUMA has one accountable human maintainer. A model-only adversarial critic is not a second independent person. Keep `reviewerType=automated-model-critic`, `humanIndependent=false`, an explicit owner decision, a protected-main signing key, immutable source SHA, release-test evidence and product smoke.

The previous v2 policy demanded a second authenticated reviewer and a candidate PR receipt before signing, so a single maintainer could not complete the initial bootstrap. The v3 policy resolves that dependency by **building the Graph gate and signature atomically in a protected-main signer** and importing only five signed evidence paths through a single reviewed-source-preserving commit. The v2 path continues to exist.

## One-time protected governance bootstrap

Before altering branch protection: inspect and archive the exact `main` policy, current PR head, Codex findings and current exact-SHA technical CI. Obtain explicit owner authorization for this one-time change, confirm `main` has not moved, and ensure the PR is ready and all actual nonrelease jobs are successful. Do not bootstrap while a P1 issue remains unresolved.

A controlled exception may temporarily remove only **`source-attestation` and `release-readiness`** from the required status contexts for the **governance PR #103**. Keep strict mode, admin enforcement, all nine actual technical contexts and the conversation-resolution rule. Immediately merge the reviewed exact SHA, restore the original `required_status_checks` JSON in a `finally` block, verify via GitHub REST readback, and leave `main` production deployment fail-closed until a signed receipt exists. If restoration cannot be proven, stop and escalate; do not deploy.

The temporary policy exception is not a production release exception: the `main` quality workflow still runs `release-readiness` and cannot start Firebase promotion without a valid receipt. An administrator audit record must include before/after JSON, GitHub actor, exact PR #103 SHA, merge SHA, timestamps and signed-off scope.

## Per-product release for public-only PRs (e.g., #101)

1. Merge current protected `main` into the PR branch. Do not replace the landing with obsolete code. The PR diff against new main must contain only intended public functionality/assets. Freeze C0 (full HEAD SHA) and compute `node scripts/release/review-gate.mjs --digest`.
2. Require a successful technical Product quality run for C0, with all 11 named testing jobs passing. The release-readiness step is expected to fail before approval; deploy and product-predeploy jobs are expected to be skipped on PRs.
3. On the protected `main` branch dispatch **Protected Granite adversarial review** with PR number. The model is pinned by admin variable `LUMA_GRANITE_MODEL_DIGEST`, and the container by SHA. The read-only evaluator reviews every changed textual source hunk, including deletions, with explicit chunk byte/context limits and checked source line quotes. No unreviewed script from the PR is ever executed. A `PASS`/verified artifact with exact workflow run ID is required.
4. Following the successful model run, post the explicit, authenticated owner acceptance for that C0 and correct risk scope via GitHub issue comment. For an ordinary public-only landing PR the exact literal form is:

   ```text
   LUMA_SOLO_RELEASE_APPROVAL_V1 sha=<C0 full SHA> scope=public-landing
   ```

   This owner action is not an independent human code review. Later authenticated `LUMA_SOLO_RELEASE_REVOKE_V1` revokes it. Governance/IAM changes require `owner-risk-exception` and remain **ineligible for ordinary public-product auto-promotion**.
5. On protected `main`, dispatch **Protected independent release signature**, input `release_mode=solo-v3`, PR number, exact model review run ID and exact successful technical CI run ID. The protected signer validates GitHub model, immutable artifact zip digest, model checksum, source C0 digest, technical CI, after-model owner comment and frozen PR HEAD. It creates critic/verifier/CI records, appends the `cicd-release` Graph gate using pinned real Graph Harness `GraphRuntime`, signs a v3 Ed25519 receipt with the existing protected secret and verifies the complete result. No key is exported into the artifact.
6. Download the trusted `release-bundle` artifact to an isolated workspace, verify its manifest and signature, import with `node scripts/release/import-solo-bundle.mjs <C0 checked-out branch> <signed bundle directory>`, then create exactly one **C1 evidence-only commit**. Allowed changed paths:

   ```text
   graph-harness.events.jsonl
   evidence/cicd-enterprise/granite-review.json
   evidence/cicd-enterprise/independent-review.json
   evidence/cicd-enterprise/release-ci.json
   evidence/cicd-enterprise/release-approval.json
   ```

   Any other change, multiple commits or stale SHA invalidates the source receipt. Push C1 via the authorized GitHub writer. Protected `source-attestation` uses GitHub Compare to prove the single C0→C1 evidence-only advance and verifies the still-current model run and owner consent.
7. Require all PR checks in green, all review threads resolved, then merge C1 to `main`. The `main` workflow must validate the Ed25519 signature, Graph chain, source digest and model/owner evidence again. `product-acceptance-predeploy` remains real. A successful source PR is not proof of successful deployment.
8. Verify Firebase serving SHA on `https://luma.lch-app.cloud/api/version` and `https://luma--luma-learning-intelligence.us-central1.hosted.app/api/version`; exercise the public landing, `/login`, `/learn`, unauthenticated denial of private APIs, accessible mobile layouts and rollback readiness. Record the actual published SHA and outcome.

## Negative gates / emergency stop

- Missing protected key, wrong model registry digest, unfinished or truncated model output, fabricated citation, deleted control file, changed workflow SHA, stale C0, inaccurate owner comment, revoked acceptance, CI failure or altered zip artifact: **NO-GO**.
- Source PR with authentication, tenant isolation, Firestore rules, release controls, billing or other privileged changes: `owner-risk-exception` requires separate enhanced approval and cannot automatically pass public-only predeploy.
- No private Ed25519 key may leave GitHub Environment `independent-attestation`.
- Do not merge PR #101 based on old main or claim a production SHA before observing it live.

### Granada/Granite advisory adjudication

Granite is a real technical *critic* and may emit `NEEDS_REVIEW`, not
`PASS`. For a strictly scoped public landing, require an authenticated GitHub
Codex clean review on the exact C0 source SHA (its comment ID is in the v3
Ed25519 signature), and the owner's exact-SHA approval *after* the protected
model run. `public-landing` never permits privileged changes. For sensitive
changes, a model warning is NO-GO, not an automatic exception. The protected
Graph gate and CI/owner verifier disclose the model's original verdict.
