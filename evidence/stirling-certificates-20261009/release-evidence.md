# Graph Engineering evidence — LUMA self-hosted Stirling signing

Date: 2026-10-09
Branch: `feat/enterprise-certificates-esign-20261009`
Scope: upgrade the PR #20 certificate workflow from a DocuSign-only default into a first-party institutional signing flow backed by a private Stirling-PDF instance.

## Producer

- Added `src/lib/certificates/stirling.ts`, adapter for official Stirling core APIs `/api/v1/security/cert-sign` and `/api/v1/security/validate-signature`.
- PKCS#12 upload protected by server-side secrets, no exposed browser keys, password absent from audit payloads and exceptions.
- Signing tenant and legal-entity binding, explicit admin authorization, learner enrollment/cohort/identity checks remain in LUMA.
- Validates exactly one X.509 signature, full PDF covered, cryptographic validity, trusted CA chain, pinned leaf certificate serial, expiry, non-self-signed and OCSP/CRL status in production.
- Verifies PDF metadata against reserved UUID to prevent substituted document; archives signed PDF and validation JSON with SHA-256 and atomic SIGNED transaction.
- Preserves optional DocuSign adapter for individual consent workflows; `CERTIFICATE_SIGNING_PROVIDER=stirling` is default.
- Created `ops/stirling/compose.yaml` (private Docker network only, no public port) and `scripts/certificates/stirling-smoke.mjs` for real deployment acceptance.

## Critic findings and responses

| Finding | Response |
| --- | --- |
| Pasting image of signature is not digital signing | Signature delegated to Stirling X.509/PDFBox core, verified by separate API |
| Stirling server-managed signing may be proprietary | Use PKCS#12 multipart core endpoint; review Docker distribution licenses before release |
| A different tenant may use the key | Require `STIRLING_SIGNING_TENANT_ID` match |
| Admin can relabel institutional signature | Bind to `STIRLING_SIGNING_LEGAL_NAME` and explicit admin authorization; preflight & pre-sign revalidation |
| A fake PDF could be returned | Require PDF magic, same UUID in metadata, same title/page count, and complete trusted signature validation |
| Self-signed, expired, wrong-cert, no revocation checks | Reject with fail-closed verification |
| Network outages might cause duplicate signing | Retain deterministic completion-to-certificate binding; fail as `failed` pending administrative reconciliation |
| Sensitive keystore might leak | Private API route, server-only env, no response bodies from failures, never persist private key in evidence |
| Production use assumed MIT | Explicit HOLD until source/image license scope reviewed |
| Docker runtime unavailable in development workstation | Smoke gate documented; no claim of real Stirling e2e or production deployment |

## Verification observations

- Focused tests including API contract, form fields, trust failure, tenant isolation, nonce/UUID identity, archive, idempotency, error state and revocation: **19 PASS**.
- TypeScript `npm run typecheck`: **PASS**, also after merging current `origin/main` (`214028e`) and provisioning merged LiveKit dependencies in the isolated workstation.
- Scoped ESLint: **PASS**.
- LUMA complete unit regression on the merged baseline: **249 passed, 47 skipped** (stateful emulator suites not enabled in this run).
- Real Stirling container: **NOT RUN** because Docker daemon unavailable in shared sandbox.
- Real X.509 signature with trusted issuer and live CA: **NOT RUN**; test adapter uses mocked responses.
- Production Next.js build: **PENDING CI**; existing shared sandbox previously ran out of memory (exit 137).
- Full Firestore emulator, Cloud Storage integration and independent PAdES validator: **NOT RUN**.

## Release gate = HOLD

Do not merge/deploy as a production-enabled capability until:
- Licensed Stirling distribution reviewed and pinned by digest.
- Real test certificate, trust chain, OCSP/CRL configured; smoke and independent Adobe/PAdES verifier PASS.
- Strong transport and access control on signing network; mounted secret access policy reviewed.
- Build and emulator tests PASS in CI with sufficient memory.
- Rate limiting, reconciliation and certificate retention policy validated.
- Institutional written signing authority, privacy, audit and legal jurisdiction scope approved.

Never claim the live LUMA application can issue digitally signed credentials based only on the current unit tests.
