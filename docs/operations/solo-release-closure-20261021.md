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

## Non-bypass bootstrap dependency

`main` at `5c822852` **does not contain** `.github/workflows/independent-attestation.yml`, `.github/workflows/source-attestation.yml`, or their trusted policy modules. Nevertheless, protected `main` already requires a `release-readiness` status that its own old workflow does **not** produce. It is impossible to complete the normal signed approval without first installing the trusted workflows. GitHub main also enforces required checks for administrators.

Install these trust-plane files using a separately reviewed **narrowly scoped bootstrap** PR/change. A one-time, explicitly authorized and independently witnessed change to the protection policy may be necessary to break the chicken-and-egg requirement; such an exception must be separately recorded and restored immediately. **This artifact neither requests nor performs any bypass.** Do not merge the feature rollup as the bootstrap and do not use a candidate-owned success check in place of trusted protected-base review.

After bootstrap: require `source-attestation` from the designated GitHub Actions app in protected branch checks, verify that the protected environment cannot run from non-main branches, and invoke `workflow_dispatch` with `pr_number=71` only when the exact candidate CI, authentic Codex/human review, Graph critic/verifier evidence and source digest agree. A clean Codex response alone does not authorize production.

## Product staging and release plan

1. Provision isolated Firebase staging (billing/project ownership **must** be explicitly authorized) and independent synthetic Auth + Firestore identities. Use the approved separate LiveKit Cloud QA project; no production users or funds.
2. Build/deploy the exact source SHA to staging; run real first-time UI journeys with roles, 1/10/50-course operations, graded assessment and signed certificate, refunds/revocation, 3-party LiveKit media/room closure, negative permission tests, UI reload and recovery, mobile/WCAG and 10/50 load. Preserve immutable, source-bound Playwright traces and backend readbacks; record missing actions as BLOCKED, not PASS.
3. Obtain independent signed technical/customer/privacy/accessibility attestations for the required catalog, with a real accountable human approving enterprise UAT. The sole developer may act as release **operator**, not as a second independent identity.
4. Complete final source review and Graph Harness acceptance tied to the same immutable SHA. Run signed `predeploy`; only after authorization merge to protected `main` and use the standard workflow rather than direct Firebase deploy or Cloudflare redirection.
5. Verify `/api/version`, `/api/health`, `/learn` and authenticated learner/coach routes at **both** the direct Firebase and public Cloudflare host against the signed SHA; save `postdeploy` and rollback evidence. Close P0 #52 only after both domains match the authorized published revision.

### Current result

**TRUST KEYS CONFIGURED; RELEASE NO-GO.** Protected workflow bootstrap, current independent review, real staging/UAT, protected acceptance/signatures and controlled production deployment are still required. No automatic or fictitious approval has been issued.
