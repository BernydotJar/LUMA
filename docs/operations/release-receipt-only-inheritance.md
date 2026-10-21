# Protected release attestation: evidence-only SHA transition

**Scope:** A strict, non-bypass exception to immutable source-review SHA binding when the protected signer produces a signed approval artifact. This security control MUST execute from protected `main` policy, not PR-provided code.

## What changes when the receipt is imported

A genuinely independently reviewed PR source at commit `C0` is tested and evaluated. The protected `independent-attestation` workflow signs the source digest, its original QA run, current reviewer identity/ID, critic/verifier hashes and Graph event. The signed receipt is then imported into `evidence/cicd-enterprise/release-approval.json` as commit `C1` on the same PR branch. Git changes HEAD from `C0` to `C1` even if no executable source changed; therefore a literal HEAD equality check alone is not sufficient for this purpose.

The protected-base review verifier now requires, **using GitHub's authenticated compare API**:

- Both SHAs are full 40-character hex IDs, `C0` is still an actual PR commit and `C1` is the current PR head.
- Either `C0 == C1`, or **exactly one direct-descendant commit** `C1`, with parent `C0`, `ahead_by=1`, `behind_by=0` and compare status `ahead`.
- The **single file** changed between `C0` and `C1` is `evidence/cicd-enterprise/release-approval.json`, with status `modified`. No other source, documentation, workflow, catalog, Graph event, review, or evidence file may change after the independent review.
- Cryptographic verification still binds source digest, critic/verifier original file digests, exact original CI run, current authenticated reviewer ID, Graph event hash and trusted environment public key. Revoking the review remains an immediate failure.
- The candidate CI must independently pass again on `C1` and the protected `source-attestation` status must be a required GitHub check before merging into protected `main`. A green candidate-owned `release-readiness` job is insufficient.

**Denied examples:** two commits, merge commits, missing/unauthenticated compare, modified course catalog, edited app source, altered/extra evidence, other status than `modified`, and stale PR heads. Automated adversarial tests cover these cases.

## Bootstrap and promotion remain NO-GO

This policy does not authorize the temporary GitHub branch-protection migration needed for Draft #89, produce an independent GitHub Codex/human review (Codex currently quota-limited), create any fake approval, or permit running production deployment. Operational/customer acceptance and 3-party LiveKit Cloud UAT remain separate signed gates. After the narrowly approved bootstrap is installed on `main`, **rebase and re-review #71 on that trusted main** before signing; never sign a source tree that differs from the tested PR merge tree.
