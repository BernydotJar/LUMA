# ADR proposal: Solo Maintainer + protected IBM Granite adversarial review

Status: **PROPOSED, NOT ENABLED** · LUMA · 2026-11-11

## Decision

LUMA has one authorized human maintainer. We cannot truthfully assert a second independent human approval. For an explicitly scoped, low-risk release we propose **AI-independent technical criticism + sole-owner release authorization** as distinct, auditable responsibilities.

- **Author / release owner:** the single human maintainer. Explicitly accepts residual risk and authorizes a production release only after the gates pass.
- **Adversarial evaluator:** IBM Granite 3.3:2b, executed in a separate, read-only review job. Its actor type is `automated-model-critic`, **never** `independent-human` or a fake GitHub user.
- **Evidence verifier:** deterministic Graph Harness checks reproduce the source digest, tests, file/line citations and finding dispositions. Granite's own output cannot approve itself.
- **Attestor:** protected-main GitHub Actions, not the development agent, owns the Ed25519 private key and signs only a validated exact-source release receipt.
- **Release controller:** `main` CI, product gates, Firebase App Hosting smoke and rollback validation continue to determine deployment success.

The proposed independence is **execution and model separation, not human or organizational segregation of duties**. Any compliance requirement for an independent *person* remains unsatisfied.

## Authoritative trust boundary

1. Freeze full PR HEAD SHA and source digest. A new source commit invalidates model and test evidence, including a change only to a test or workflow.
2. Protected review is dispatched on `refs/heads/main` by the owner. Checkout the protected policy separately from the PR HEAD. Treat PR files **only as inert untrusted input**. No `npm install`, PR scripts, shell code or secrets from that checkout in the review job.
3. Review a manifest of changed paths and security-sensitive dependencies, not just the home page. Pin the full Granite **model digest**, prompt version/hash, context settings and output JSON schema. Reject truncation, missing fields, unknown paths or citations that do not match actual lines.
4. Independently examine the model's findings. Verify code citations, preserve all raw responses (including malformed model output and false positives), and require reviewed dispositions. An unsupported or inconclusive model response is `NEEDS_REVIEW`, not `PASS`.
5. Query GitHub's authenticated API for the registered protected-main workflow ID, run ID, job conclusion, exact artifact SHA-256, PR SHA and current required check results. **Candidate-authored JSON, PR comments or a model's claimed identity never become trusted provenance.**
6. Require all real quality and product-acceptance checks for the final SHA. Harmonize the presently required branch contexts with real jobs; do not quietly delete or stub them. The signed Graph receipt must bind critic evidence, deterministic verification, actual CI and owner authorization to the same SHA.
7. Only the protected attestor may sign Ed25519; the private key is not given to Ollama, the agent, the PR or the maintainer's local test job. Import the signed receipt via the narrowly constrained receipt-only procedure, recheck protected provenance and merge through branch protection.
8. After merge, verify the deployed SHA, public page, `/login`, `/learn`, authenticated role boundaries and both production domains. A CI-green PR is **not** a production GO by itself.

## Risk policy

| Scope | Automated Granite + Graph + owner signoff? | Additional gate |
| --- | --- | --- |
| Public content, styling, static assets, non-sensitive read-only pages | Eligible | Full CI, accessibility, route checks, source-bound review and protected signature |
| Identity, authorization, tenant isolation, payments, privacy, PII, infrastructure/IAM, DLP or release policy | Not eligible for auto-GO | Independent human/security review, or a separately logged owner risk exception with enhanced tests and explicit scope; no claim of independent human approval |
| Unknown or ambiguous blast radius; model unavailable; missing evidence | NO-GO | Repair or obtain qualified external review |

## Known blockers when proposing this ADR

- The current `trusted-attestor.mjs` only authenticates Codex or a separate allowed human; **it does not accept Granite**. Its v2 signature schema also mandates a GitHub comment/review ID. Merely writing `granite-review.json` does not satisfy it.
- The protected Graph receipt currently requires the actor `independent-verifier`. A new model-verified actor and authorization policy need explicit schema migration; do not relabel the model as a human.
- Branch protection contains expected contexts absent from the current `quality.yml`. No missing status may be fabricated or marked successful by a local script.
- A protected Granite workflow and authenticated artifact download, plus a protected signer integration, **still need implementation and controlled rollout**. The helper `scripts/release/model-review-contract.mjs` is a fail-closed validation building block, **not a deploy gate**.
- Adopting this proposal requires a **separately authorized, audited governance bootstrap**. Record the old protection, approved changes and complete readback before and after migration. Do not secretly disable existing branch protection to merge this policy.

## Acceptance before declaring the new lane enabled

- [ ] Protected-main `granite-protected-review` workflow exists and is registered with exact workflow ID, authenticated artifacts and a pinned model digest.
- [ ] Both a valid and an adversarial/malformed review demonstrate deterministic PASS/NO-GO, including tests against stale SHA, model swap, fake approval, invented quote and missing artifact.
- [ ] Signed attestation contract explicitly represents `automated-model-critic` and `owner-accepted-release`, rather than impersonating an independent human.
- [ ] `trusted-attestor`, `live-review-check`, `review-gate`, approval signing/verification, Graph receipt and branch protection all agree on the **same** policy and required jobs.
- [ ] Existing identity, security, Firestore, browser and product acceptance gates remain real and active; re-run on the final exact SHA.
- [ ] Production result includes the actual serving SHA, both hostnames, login and role smoke, and guarded rollback evidence.

## Example provenance, illustrative only (not a real approval)

```json
{
  "reviewerType": "automated-model-critic",
  "model": "ibm/granite3.3:2b",
  "modelDigest": "<trusted full registry digest>",
  "reviewedCommit": "<full 40-char PR HEAD SHA>",
  "sourceDigest": "<full 64-char digest>",
  "protectedGithubWorkflowRunId": "<authenticated workflow run ID>",
  "humanIndependent": false,
  "ownerAuthorization": "separate explicit release decision",
  "productionPermission": "only after all protected checks and signature"
}
```

## Evidence from the first practical pilot

For PR #101 at `dbe4acb8629c0bfb38a6010d7b824a273ef7992d`, Granite generated well-formed JSON `PASS` for the public landing and its UI/E2E tests. It also generated malformed initial responses and unsupported high-severity findings on release policy. Those attempts were **rejected and preserved**, not promoted to an attestation. The model's unverified claim of no findings cannot override a real red CI check or missing Graph evidence.
