# Protected evidence and independent signoff — LUMA operational acceptance

## Why a source-controlled JSON cannot grant product approval

An E2E job returning PASS, a route returning HTTP 200, or a JSON field such as `independentVerifier: "QA"` does not authenticate an actual reviewer. File SHA-256 checks alone detect changes to bytes **after** a hash was recorded; the same developer can create both the evidence and its hash. The gate must independently establish *who attested to the claim* and *which immutable revision* was tested.

**LUMA uses two distinct decisions:** the ordinary pull-request job `product-acceptance-contract` proves that the evaluator correctly rejects incomplete evidence. Its green result is **not** a product PASS. The strict `predeploy` and `postdeploy` jobs demand external trusted attestations and customer approval; they reject missing attestations, untrusted signers, modified claims, stale receipts and out-of-date production source.

## Trust boundary and signature format

Each action or journey receipt must include all of its observed facts (actor, source SHA, environment, test run, timestamp, **first-time-user in-app navigation path**, activated UI locator/action with the same operation ID as the backend receipt, server readback after a new session, cross-tenant denial, UI-visible recovery and hashed trace). An **independent SDET** signs the *canonical JSON representation of the entire receipt except the `attestation` field* using Ed25519. The verifier is identified by a protected key registry, not by a text field in a pull request.

```json
{
  "attestation": {
    "algorithm": "Ed25519",
    "keyId": "qa-approved-key-id",
    "signature": "base64url-of-the-64-byte-signature"
  }
}
```

A **human signoff** carries a separate Ed25519 signature and requires a key authorized for the corresponding review role. The required roles are `customer-approver` for customer requirements and business UAT, `accessibility-auditor` for manual WCAG, `privacy-officer` for data/abuse policy, and `release-verifier` for published-route acceptance. The author and verifier must differ. All test tenants must be synthetic and individually authorized before running any write test.

The independently provisioned key registry (schema `luma.acceptance.trust.v1`) contains **only public keys**, reviewers and their allowed roles, plus the SHA-256 digest of the canonical required-actions catalog. The digest prevents an author from deleting mandatory actions from the catalog and silently obtaining PASS. Private signing keys must never enter the repository, logs, ChatGPT, commits, workflow sources, screenshots or artifacts.

The implementation checks **Ed25519 signatures**, the configured reviewer role, source SHA, exact scope and timestamp, and filesystem SHA-256 of the underlying independently produced traces. Receipt timestamps expire after 24 hours; live anonymous version/routes after 15 minutes. A signature does *not* prove the reviewer's conclusions true: the human reviewer and Release Engineering must independently inspect the underlying browser traces, permissions, HTTP status and server readback. The approval reference in the external system must also be verified there; the evaluator does not autonomously authenticate third-party approval systems.

## GitHub deployment safeguards (configuration required)

The workflows reference a separate GitHub **environment `enterprise-product-acceptance`** that must have named, non-author contributors as required reviewers, `main`-only deployment branch restrictions and secured secrets:

- `LUMA_ACCEPTANCE_TRUST_STORE_B64`: Base64-encoded trusted public-key registry, controlled by Release Engineering independently of implementation PRs.
- `LUMA_ACCEPTANCE_SIGNED_RECEIPTS_B64`: Base64-encoded reviewed JSON containing signed action/journey/manually approved receipts that belong to the exact pending SHA. Files referenced by `artifacts.path` must be sanitized and present under the verified checkout; secrets and real learner data are forbidden.

`node scripts/qa/protected-acceptance-inputs.mjs` writes these protected inputs under `$RUNNER_TEMP/luma-protected-acceptance`, outside the checked-out repository, with restrictive permissions, and only exports their **file paths**. The strict evaluator reads the key registry solely through the protected `LUMA_ACCEPTANCE_TRUST_STORE` environment variable. A keyring stored in the checked-out repository is explicitly refused.

**These GitHub environment settings, reviewer memberships and secrets are not asserted as currently provisioned.** Without them, strict promotion fails closed. Adding the workflow to `deploy.needs` intentionally blocks automatic production promotions until the independent controls have been configured, exercised, and approved in a reviewed PR. This change must not be merged merely because the contract self-tests pass; deployment owners must approve the protection change.

### Compensating controls

- Use least-privilege, short-lived staging QA identities for actions that write evidence. The public inventory never POSTs/PUTs/DELETEs production records.
- Keep `predeploy` authorization separate from `postdeploy` operational acceptance. An accepted candidate is **not yet published**, and product PASS can only occur on the exact live SHA with full authorized user-action evidence.
- Do not sign partial journeys, dashboards with static data, or browser tests that replace steps with direct API/Firestore writes.
- For human review, require an independent trace reviewer and a recorded customer business owner. A CI test runner cannot self-approve its own results.
- Rotate/revoke reviewer keys if a signer changes, and update the external catalog digest only after independently reviewing additions/removals from the mandatory-action catalog.
- Require CODEOWNERS/branch protection for `scripts/qa/**`, `docs/product-acceptance/**`, `.github/workflows/**` and the Graph Harness policy; this repository PR does **not** itself create or prove those remote GitHub protections.

## Current audit position

On 2026-10-20 the public application still reports Git SHA `6ddcae8ff2464782b7e4001c4cd5d60092dbb099`. The candidate baseline `878bca15fad3cafb6f9e4e2d4058bf5855835dd2` is not published; `/academia/solicitud`, `/plataforma/solicitudes` and `/academia/primer-curso` return HTTP 404. There are no authorized production account writes or verified customer UAT signoffs in this audit. **All 9 required modules and all 5 business journeys remain BLOCKED.**
