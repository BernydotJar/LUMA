# LUMA solo-owner release trust plan — 2026-10-21

## Scope and decision rights

This is an **internal solo-engineering workflow**, not evidence that Seres de Excelencia, an institutional privacy officer, an independent security custodian, or a customer has approved the product.

- **Implementer/maintainer:** `BernydotJar`. Can build, fix, test and submit source; cannot impersonate an independent reviewer or create its own APPROVED GitHub review.
- **Independent source critic:** a separately authenticated reviewer such as `chatgpt-codex-connector[bot]` with a completed clean code-review receipt on the **current** exact PR SHA, or a genuine approved GitHub user who is not an author/contributor. Granite can be advisory only.
- **Release operations:** trusted *protected-main* GitHub Actions workflow with environment-scoped Ed25519 private key; separate public verification key in repository Actions variables. Only the protected signer may attest to GitHub reviewer identity + exact CI + Graph events. The private key must never enter candidate workflow checks, source code, logs or PR artifacts.
- **Business acceptance:** a separate, signed product-action/customer UAT system. The solo maintainer may approve operational scheduling, but does **not** substitute for the actual customer, independent SDET, accessibility/privacy review, or a required human business-owner signoff.

## Verified infrastructure

- PR #71 original reviewed head at this audit: `204ae57860720f444fc15b39e643f600bb1c1d5a`, **NO-GO** until signed exact-source review is verified. The PR may gain a new SHA from trust-policy repairs; new independent review/CI is then required.
- A new Ed25519 pair was generated in ephemeral memory-backed storage. GitHub environment `independent-attestation` now contains *only* the private secret `LUMA_RELEASE_ATTESTATION_PRIVATE_KEY_B64` restricted to protected branches. GitHub repository Actions variable `LUMA_RELEASE_ATTESTATION_PUBLIC_KEY_B64` contains the public key. Public SPKI DER SHA-256 fingerprint: `ad0f04106d8b057d3ce9f9abc07215b70f1c351abbb13ba0018c9c80bdbe5b5e`.
- **Custody caveat:** this key was provisioned by the **solo repository administrator**, not a different independent human custodian. Its GitHub runtime scope is isolated, but organizational separation of duties has not been established. Do not describe this as independent human approval.
- The `independent-attestation` and `enterprise-product-acceptance` GitHub environments are now configured for protected branches only, with administrators unable to bypass their environment policy. The acceptance environment has **no authorized receipt-signing secrets yet**, so its predeploy gate remains blocked.
- The GitHub `production` environment now has **manual required approval from `BernydotJar`**, protected-branch restriction and `can_admins_bypass=false`. This is an accountable *release-operator confirmation*, not independent technical review or customer UAT. The owner must approve the deployment separately after all protected checks pass.
- `/api/version` at both `luma.lch-app.cloud` and Firebase App Hosting reports older `6ddcae8ff2464782b7e4001c4cd5d60092dbb099`, not the reviewed candidate. Production P0: [#52](https://github.com/BernydotJar/LUMA/issues/52).
- Only Firebase projects `luma-learning-intelligence` (production) and unrelated `lch-evidence-ai` were accessible. No distinct LUMA staging Firebase project/App Hosting backend exists. Do **not** run write UAT in production or repurpose the unrelated project.
- Graph event chain is structurally VALID (717 events), but structural validity is not a current independently approved Graph `cicd-release` PASS.
- Product acceptance inventory returns `BLOCKED`, with 9 required modules, 5 journeys and 21 missing/partial proofs. The catalog also mentions an unconfirmed agrochemical customer scenario. Before a Seres de Excelencia GO, confirm the correct tenant's actual use cases and prevent a stale or mismatched catalog from being signed.

## Protected signer bootstrap — completed under explicit owner authorization

**2026-10-21 22:02 UTC:** the repository owner authorized the narrowly audited protection exception for Draft PR #89. The only permitted mutation was a temporary reduction from the original 10 GitHub Actions app-ID-pinned required checks to the five technical checks that passed on #89. Administrator enforcement, `strict=true`, review/conversation protections, and the production manual owner approval remained intact. See the private, restricted Cloud Sandbox audit directory `/workspace/audits/luma-solo-release-20261021/bootstrap89-admin-audit-20261021/` (not a deployable artifact).

- Before main: `5c82285251be18c9cf876ae5fd8c307075904029`. Authorized PR #89 reviewed candidate SHA: `ee6667fb7e849b3b8b747265d514689dd0fd8bc8`. **Only #89** was merged, producing protected-main SHA `4b87923d87d045f938c42aeff02264cddee072d7`.
- The original **10 exact GitHub Actions app ID 15368 required checks** were restored immediately after merge, with `strict=true` and administrator enforcement. Protection snapshot SHA-256: `7bad9ba1a1918b158d63fa64757856a74660f729f78c592aeab61b22c14924e2`. Restoration succeeded on the first attempt and was verified by read-back.
- Main CI #310 completed five technical jobs successfully; unsigned `release-readiness` correctly failed, and `deploy` was **SKIPPED**. Public Firebase and `luma.lch-app.cloud` continued serving old approved `6ddcae8`. No production deployment or #71 merge occurred.
- `.github/workflows/source-attestation.yml`, `independent-attestation.yml`, and their protected-base signing/reviewer verifier modules are now **installed on protected `main`**. This is functional trust-plane installation, not evidence of an authenticated independent source review, business/customer GO, or an actual Ed25519 signature.
- The exact current #71 source needs a new independent external review and signed Graph business acceptance, and its branch must incorporate trusted `main`. After confirming a real `source-attestation` run, require that protected GitHub Actions context in branch policy; never mistake a candidate-controlled `release-readiness` pass for independent proof.

## Product staging and release plan

1. Provision isolated Firebase staging (billing/project ownership **must** be explicitly authorized) and independent synthetic Auth + Firestore identities. Use the approved separate LiveKit Cloud QA project; no production users or funds.
2. Build/deploy the exact source SHA to staging; run real first-time UI journeys with roles, 1/10/50-course operations, graded assessment and signed certificate, refunds/revocation, 3-party LiveKit media/room closure, negative permission tests, UI reload and recovery, mobile/WCAG and 10/50 load. Preserve immutable, source-bound Playwright traces and backend readbacks; record missing actions as BLOCKED, not PASS.
3. Obtain independent signed technical/customer/privacy/accessibility attestations for the required catalog, with a real accountable human approving enterprise UAT. The sole developer may act as release **operator**, not as a second independent identity.
4. Complete final source review and Graph Harness acceptance tied to the same immutable SHA. Run signed `predeploy`; only after authorization merge to protected `main` and use the standard workflow rather than direct Firebase deploy or Cloudflare redirection.
5. Verify `/api/version`, `/api/health`, `/learn` and authenticated learner/coach routes at **both** the direct Firebase and public Cloudflare host against the signed SHA; save `postdeploy` and rollback evidence. Close P0 #52 only after both domains match the authorized published revision.

### Current result

**TRUST KEYS AND PROTECTED-MAIN WORKFLOWS CONFIGURED; RELEASE NO-GO.** Bootstrap #89 is complete and original branch protection is restored. Independent current-SHA review, source-attestation receipt, real staging UAT, protected product acceptance/signatures, and authorized production deployment remain required. No automatic or fictitious approval has been issued.
