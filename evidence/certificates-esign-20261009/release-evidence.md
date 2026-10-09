# LUMA Certificate Signing — Original Engineering Gate (DocuSign baseline)

**Update:** this describes the initial PR #20 implementation. The self-hosted Stirling architecture and subsequent checks are recorded at [Stirling integration evidence](../stirling-certificates-20261009/release-evidence.md). Do not treat the older DocuSign flow as the default.

Date: 2026-10-09
Branch: `feat/enterprise-certificates-esign-20261009`
Baseline: origin/main `e819b16`

## Producer

- Added a tenant/cohort scoped certification domain, academic completion human attestation, immutable status transition architecture.
- Implemented PDF generation with verification QR and UUID; DocuSign JWT integration and authenticated Connect callback with finalization via provider GET.
- Implemented private GCS artifact handling, SHA-256 verification, signed / revoked status APIs, official issuer administration, coach console, learner credential wallet and public verifier.
- Enforced identity attestation from coach against official institution records; frozen legal name, not mutable Firebase profile.

## Critic / adversarial findings and repairs

- Differentiate actual electronic signing from placing a signature picture: **provider-signed PDF only** is valid.
- Do not trust arbitrary client-provided student names or learning completion: legal-name attestation, enrollment verification and server-only source of record.
- Do not trust webhook completion event alone: HMAC and independent provider status verification.
- Avoid sending duplicate e-sign requests after ambiguous provider responses: fail closed with reconciliation.
- Prevent stale account records from appearing after logout/account switch: reset client data on auth state change and cancel stale reads.
- Prevent an asynchronous error from reverting already-signed document status to failed: conditional transactional transition.

## Verifier results

- TypeScript `npm run typecheck`: **PASS**.
- ESLint on all new/modified certificate routes, services, components and navigation: **PASS**.
- Certificate focused test suite: **8 passed**, PDF generation/loading, tenant/cohort isolation, HMAC integrity, valid state publication and identity attestation guard.
- LUMA full unit regression: **183 passed, 44 skipped** (the 44 use Firestore emulator unavailable in current invocation).
- `git diff --check`: **PASS** for tracked changes.
- Production `next build`: **BLOCKED** by memory exhaustion in shared remote environment (exit 137 after optimized Turbopack compilation started). Initial symlink module resolution issue was fixed by using local hardlinked dependency files, but compilation still exceeded available memory.

## Release gate decision: HOLD

Not promoted to production or merged into main under this gate. Blockers:

1. Build a hermetic clean checkout in sufficiently provisioned CI; verify Next.js production output.
2. Configure institution-owned real DocuSign account, OAuth consent, HMAC Connect and private GCS bucket; live signing acceptance.
3. Verify Firebase emulator integration tests and storage permissions, duplicate/out-of-order Connect callbacks, recovery and retention.
4. Confirm legal signature category, authorized institutional signatory, student privacy consent and legal-name validation policy by jurisdiction.
5. Add observability/rate limiting and structured administrative reconciliation for ambiguous provider failures.
6. Run UI visual regression and PDF rendering QA with multi-line names and WCAG checks.

Evidence is for architecture review and honest release readiness. Do not label the feature live until gates are satisfied.
