# LUMA — Independent release attestation (Ed25519 v2)

**State, 2026-10-20:** implementation and local forgery tests complete; **NO INDEPENDENT SIGNATURE EXISTS**. PR #71 is not authorized for merge or production. This is a security control, not a request to waive the failing release check.

## Why local PASS reports are insufficient

The original `release-approval.json`, raw critic/verifier JSON and `graph-harness.events.jsonl` were all candidate-controlled. Matching SHA-256 hashes and an actor string (`independent-verifier`) do not authenticate their origin. Code reviews and browser E2E passing do not prove the full customer acceptance contract either.

The new signing protocol (schemaVersion **2**) binds **all** of the following in an Ed25519 signature using an unambiguous domain-separated, length-prefixed serialization:

- Exact reviewed source digest (tracked and untracked source inputs); source commit SHA and real QA workflow run ID.
- Original critic and independent-verifier artifact SHA-256 digests, Graph Harness event ID and event hash.
- Independently verified GitHub reviewer method, reviewer login, unique review ID and **same reviewed commit SHA**.

A PR **cannot choose its own trust root**. `LUMA_RELEASE_ATTESTATION_PUBLIC_KEY_B64` must be set by authorized repository administration (GitHub Actions *repository variable*), while the private key is accessible **only** to a protected-main workflow via an `independent-attestation` *environment secret*. Signature mismatches, stale source, absent trust root and self-signed receipts all fail closed. Regression tests mutate every signed component, including reviewer attribution and review ID.

## Independent review authority (two genuine paths)

1. **GitHub Codex app:** the latest authenticated `chatgpt-codex-connector[bot]` summary from the GitHub API must mark an exact-commit code review `completed`, `has_any_findings=false` and `has_unresolved_findings=false`. It must contain a real GitHub issue-comment ID. `running` reviews cannot be overridden, and **completed reviews with findings block signing**.
2. **Authorized external human fallback**, when Codex is unavailable or rate-limited: GitHub's `pulls/{pr}/reviews` API must contain a genuine `APPROVED` review of the exact PR HEAD by an **independent GitHub user**. The account must appear in the administrator-controlled repository variable `LUMA_RELEASE_TRUSTED_REVIEWERS` (comma-separated GitHub logins), **must not be the PR author or a PR commit contributor**, and its latest decisive review must not have been dismissed or superseded by a change request. Any other authorized reviewer's unresolved `CHANGES_REQUESTED` on the same SHA vetoes release. Review logins from PR JSON or inline comments never authorize signing.

These are alternatives only for validating the external source reviewer. Neither route substitutes for actual raw critic/verifier findings, nine successful registered quality jobs, Graph receipt, Ed25519 signature or product acceptance. GitHub CLI's `gh api` page-by-page fetch is used for entire review/commit history because the installed CLI does not support `--slurp`.

## Required GitHub setup — genuinely external work

The GitHub environment `independent-attestation` exists and restricts workflows to protected branches. The environment has **no protected signing secret**, the repository has **no trusted public-key variable**, and the protected workflows are **not yet in `main`**. At present only the PR-author account is a listed repo collaborator, so a truly independent human approval cannot be assumed. Do not add the author as an authorized reviewer merely to make a check green.

An authorized GitHub repository administrator and independent key custodian must:

1. Generate a dedicated Ed25519 key pair using an approved key manager/trusted workstation. Keep the private PKCS#8 PEM out of this PR, logs, chat, source control and all unprotected branches.
2. Set environment secret `LUMA_RELEASE_ATTESTATION_PRIVATE_KEY_B64` to base64 of the private PKCS#8 PEM in **Settings → Environments → independent-attestation**. Set repository Actions variable `LUMA_RELEASE_ATTESTATION_PUBLIC_KEY_B64` to base64 of its SPKI PEM public key. Pin and document the key fingerprint outside this PR.
3. If Codex remains unavailable, invite a non-contributing authorized reviewer and set `LUMA_RELEASE_TRUSTED_REVIEWERS` as an Actions repository variable. Use GitHub's protected environment *required reviewers* once eligible independent collaborators exist.
4. Install/review `.github/workflows/independent-attestation.yml`, `.github/workflows/source-attestation.yml` and the **protected-base verifier scripts** in a separately authorized, narrowly scoped bootstrap on `main`. These workflow definitions only in PR #71 **are not trusted**. Establish the actual `source-attestation` required status context after it has been independently exercised from `main`; don't replace its signature gate with a candidate-owned pass.
5. Plan that any merge into `main` can trigger automatic Firebase deployment. No bootstrap or product release is authorized simply by the existence of this document. Preserve production feature flags OFF until separate authorization.

## Exact signing workflow after the bootstrap

1. Resolve Codex findings or obtain an eligible independent GitHub approval on the **final SHA**. Verify independent critic/verifier raw evidence and dispositions, with no critical/high unresolved findings.
2. Wait for `Product quality` on that SHA: nine real quality jobs SUCCESS; `release-readiness` is expected to fail **until** the signature is issued, and `deploy` should be skipped. The protected signer verifies the official workflow ID/path and repository, not an attacker-created job sharing a name.
3. Use the existing GraphRuntime to append `cicd-release` only with verifiable critic, verifier and CI evidence (never hand-edit or concatenate event hashes). The unsigned approval is not itself authorization.
4. From **protected main only**, an authorized key custodian explicitly dispatches `Protected independent release signature` with the PR number. The signer runs its code from protected main, reads PR content as inert files, checks the real GitHub reviewer/API and exact CI, and emits **only the signed JSON artifact**. It never executes candidate scripts or leaks the secret.
5. Import the signed artifact as an evidence-only change; rerun CI and verify both `release-readiness` and protected `source-attestation` genuinely succeed for the unchanged source digest. Verify the signed reviewer ID, all Graph hashes and SHA before the merge decision. Never use `continue-on-error`, bypass required checks or fabricate model verdicts.

**Current gates remain separate:** Ed25519 GO is source/CI security only. LiveKit's 18 customer actions, real two-party WebRTC, revocation and deployment observation are still independent product/UAT conditions.

## Post-signature reviewer revocation (protected-main enforcement)

A valid historical Ed25519 signature is **not** a perpetual approval. The protected `source-attestation` workflow now also listens to official GitHub `pull_request_review` events (`submitted`, `edited`, `dismissed`) and uses a GitHub read-only token to revalidate the actual review state **after** cryptographic verification. The signed reviewed SHA must still be present in the PR commit history and the **current merge source digest must still equal** the signed digest. The current PR HEAD is compared to the signed webhook SHA, so advancing the PR during review fails closed.

For human reviewers, the original signed review ID must still be the latest effective `APPROVED` review from the same vetted, allowlisted noncontributing reviewer, with no other authorized `CHANGES_REQUESTED` veto. For Codex, the bot's signed summary ID must still be the authenticated, current clean review of the same source SHA. A dismissal, code-review finding, reviewer replacement, loss of allowlist trust, or source drift changes the protected status to **BLOCKED**, even if the previously issued signature verifies mathematically. A reviewer who withdraws an approval must never be counted after withdrawal.

**Important:** This live recheck is meaningful as a GitHub required status only **after** the workflow is installed on protected `main` and its true check context is added to branch protection. Candidate CI cannot provide the protected-base check. GitHub's documented event triggers for approval dismissal are the `pull_request_review` `dismissed` and `edited` activity types.

### Reviewer conflict veto

Regardless of whether the signed provenance uses Codex or a human, an authorized noncontributing human reviewer with a current `CHANGES_REQUESTED` on that exact source SHA **vetoes** the release. A clean automated model review never overrides an unresolved human safety objection. The signer and the protected-base live verifier enforce the same veto.

GitHub's documented review event contract is available at [Events that trigger workflows — pull_request_review](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_review). This event re-evaluates on approval submission, edit or dismissal; the change to protected `source-attestation` is not active in `main` until separately bootstrapped.
