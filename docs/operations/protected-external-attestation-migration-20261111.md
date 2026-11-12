# LUMA External Ed25519 Source Attestation — Controlled Migration

**Tracking:** Issue #104; protected trust-plane migration, not a production deployment.
**Change boundary:** GitHub Actions workflows and the source release-policy modules.
**Production authorization:** Retained separately; production deployment remains NO-GO.

## Root cause

The original signer required a file tracked within candidate commit C to contain
the exact SHA of C. Any attempt to write that SHA changes the commit itself.
A stable self-referential commit cannot be produced by normal Git operations.
The stored source-approval file also uses the obsolete approval schema 1,
while protected validation requires schema 2.

## New contract

1. Protected main resolves the exact PR head SHA, registered workflow identity,
   CI run and current reviewer directly from authenticated GitHub API data.
2. An external, allowlisted reviewer or authenticated clean Codex review must
   cover that exact SHA. Revocation and change-request veto remain effective.
3. Current critic, independent verifier and append-only Graph gate must be
   valid for the source digest. No prompt or a green CI check alone can grant GO.
4. The signer uses a private Ed25519 key scoped to the protected
   independent-attestation environment. It cannot run from untrusted PR code.
5. The signed receipt is published outside the Git tree as a bot-authored PR
   comment with an Actions artifact mirror. Both are externally inspectable.
   The comment is a lookup carrier, not authority: consumers require the
   correct publisher, exact PR/head, protected public key signature,
   matching source digest, current reviewer and Graph-chain provenance.
6. The protected signer queues a rerun of the existing source-attestation check on the PR head;
   the signer also queues the failed PR release-readiness job to consume the same signed
   proof. Merge does not eliminate validation: main release checks also verify
   an authenticated unique merged PR and exact resulting code digest.
7. Source integration and business production acceptance are independent.
   Enterprise UAT, verified previous serving build and guarded postdeploy
   approval remain mandatory; no feature flags are switched by this patch.

## Controlled one-time bootstrap

**BLOCKED unless explicitly approved by an authorized administrator.**
The current protected main validator contains the defect being repaired.
Therefore, this policy PR cannot issue its own first signature and cannot
legitimately pass the original required check through normal automation.
Never claim that a green test run constitutes that missing approval.

A one-time repository governance transition is required:

1. Obtain independent review of the exact trust-policy change SHA. Retain its
   real GitHub identity, review ID, inspection findings and audit decision.
2. Approve a narrowly scoped change to the currently protected main policy
   with an authorized operator, documented exact SHA/files, audit evidence,
   expiration and independently verified post-change checks. Stop when no
   supported, explicitly authorized path exists. Do not silently disable
   protections or mint the PR author's approval.
3. Verify the protected-main source, private-key environment, public-key
   trust anchor, required status contexts and original protections after
   installing the new policy.
4. Only then independently regenerate and review the final source-bound
   critic/verifier/Graph evidence on PR #102 and PR #101 as applicable.
   Every amended or rebased SHA requires new review.
5. Dispatch protected independent signing with a concrete PR number. Verify
   its GitHub Actions bot comment and signed artifact, and re-run previously
   failed quality release-readiness jobs. Confirm the protected attestation
   check belongs to the exact final PR head.
6. Merge the release-policy/CI changes in the authorized order, then rebase
   the landing and revalidate its user paths. Run one guarded production
   deployment only when the separate business and release gates permit it.
7. Verify the exact published SHA and the full customer interface on both
   public origins, with monitored rollback readiness and an incident record
   for any discrepancy.

## Scope / evidence

A local contract test uses a disposable keypair. It validates verified
signature transport, untrusted publishers, wrong source SHAs, altered
signatures, source digest mismatch, revoked reviewer decisions, merged PR
constraints, protected-only signer workflow, and PR head checkout.
The disposable private key is never committed.

The module itself is source-only. It cannot independently prove successful
cloud dispatch, real protected signing, a passing branch-protection status,
an independent human review, or a completed production rollout.

## No silent bypass

No GitHub branch protection has been relaxed; no production traffic, cloud
resource or reviewer allowlist has been modified by this policy PR.
The first governance migration is explicitly a separate administrative
decision, not implicit authorization to force-merge another PR.
