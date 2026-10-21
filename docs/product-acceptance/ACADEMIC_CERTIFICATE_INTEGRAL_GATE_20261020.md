# LUMA — matrícula → curso → evaluación → certificado firmado y verificable

**Date:** 2026-10-20
**Graph Harness release mode:** SHIP
**Customer-journey verdict:** **NO-GO** until the seven gates below are independently accepted against the same immutable deployed SHA.

## User story and acceptance contract

**As an authenticated learner** with a verified email and active institutional/commercial enrollment in a specific tenant, program and cohort, I must see only the published academic content I am authorized to access, complete its assigned assessments and receive recorded feedback. **As an authorized coach**, I may approve completion only if the system independently verifies the published curriculum and a passing result for **every** mandatory question/exercise, using the exact learner, tenant, program, cohort and curriculum version. **As the institutional signer**, I may sign the immutable generated PDF using a real authorized key/certificate. **As a third party**, I can cryptographically verify signature, document integrity and public revocation state without viewing the learner's private events.

### Required gates

| Gate | Required evidence | Current state |
|---|---|---|
| G1 Verified enrollment | Firebase Auth user, verified email, scoped active entitlement, prior enrollment audit | Engine implemented; isolated tests previously passed, production UAT not approved |
| G2 Publish approved curriculum | Separate academic author and approver, rights/source receipt, published immutable version | In separate concurrent academic authoring branch, **not merged** |
| G3 Learn and submit graded work | Published lesson consumption, 100% of required item IDs assessed, server-scored MC or approved coach feedback, exact cohort/version, restoration after login | Technical Firestore verifier tested in isolated emulator; actual multi-role customer journey pending |
| G4 Authorize graduation | Independent academic assessment policy, explicitly reviewed passing threshold, immutable policy/audit, completion with linked verified submissions | Implemented in this change; unit + Firestore emulator verified; awaiting PR/CI + UI acceptance |
| G5 Issue cryptographically signed PDF | Authorized institution's PKCS#12, Stirling signing provider, independent PDF signature validation (not mocked), full ByteRange, chain, trust, certificate serial, OCSP/CRL per policy | **BLOCKED**: no approved production certificate/provider evidence; mocks do not count |
| G6 Public verification | Signed PDF digest matches archived bytes and independently validated cryptographic signature; valid/revoked `/verify/{id}` without exposing private paths | API implemented, needs real signer and independent public UAT |
| G7 Release proof | Exact running `gitSha`/`gitTree`, Build+Playwright+Firestore+Identity gates, security & a11y, independent reviewers and signatures for current SHA | **BLOCKED**: public `luma.lch-app.cloud` served `6ddcae8` on 2026-10-20, not this candidate |

**No false PASS:** HTML 200, fake signer JSON, PDF metadata, practice-demo PAS score, checkpoint reaching end, coach narrative, or a mocked envelope are *not* evidence of verified graduation. The production gate must validate the same SHA used for the browser/UAT, data store, signature, and public verification.

## Assessment policy and boundaries

The signer is intentionally downstream of the academic reviewer, with **two independent approval boundaries**:

1. The curriculum is immutably published through `academicCurricula/{offeringId}/versions/{versionId}` by someone other than the author (`submittedBy != approvedBy`). The document digest must match the published head.
2. An authorized academic approver explicitly creates `academicCertificatePolicies/{offeringId}` through `POST /api/certificates/policy`, with `minimumScore: 1..100` and a unique `requestId` (at least 20 characters). The server derives *all* required questions/exercises; the caller cannot omit difficult assessments or choose source IDs. Policies are immutable and create an audit entry. The approver cannot be the curriculum author. A policy already approved cannot be silently downgraded.
3. An authorized coach obtains `GET /api/certificates/eligibility?offeringId=...&learnerId=...`, which verifies active enrollment and the current published assessment. Non-ready graduates see a specific explanation; the approval button is disabled.
4. The server reads `cohortEvidence/{offeringId}/learners/{uid}/submissions/{submissionId}`. It re-scores multiple-choice answers from the private published key; open questions and exercises require a persisted coach feedback receipt. Every mandatory item must reach the independently approved threshold. Records must match learner, offering, program, tenant and curriculum version. Their submission IDs must match hashed learner/request IDs; forged client-supplied event IDs are rejected.
5. `approveCompletion` stores the exact assessment version, policy digest, threshold and server-discovered passed submission IDs. The transaction rechecks enrollment and the current policy/curriculum head. `issue` independently re-evaluates grades, refuses legacy/self-reported completions and does not reserve a certificate unless the receipt matches the live academic result.
6. Signature, archive, public verify and revocation remain separately gated by the existing configured Stirling/DocuSign integration. Signing validation from an injected mock is not legal or cryptographic attestation.

### Exact local verification

```sh
npm run lint
npm run typecheck
npm run test:run -- src/lib/certificates/service.integration.test.ts src/lib/certificates/domain.test.ts
JAVA_HOME=/home/agent/.cache/ido-jre21 PATH=/home/agent/.cache/ido-jre21/bin:$PATH \
  firebase emulators:exec --project demo-luma-certificate-20261020 --only firestore \
  'npm run test:run -- src/lib/certificates/eligibility.emulator.test.ts --maxWorkers=1'
```

This is **source-level + emulator acceptance**, not completion of the whole enterprise UAT. The emulator test uses synthetic curriculum and grade documents and tests positive and negative cases, including low score, wrong tenant, wrong learner, withdrawn academic policy and repeated approvals. It does not fabricate a signed certificate.

### Independent adversarial cases still required

Unauthorized coach or other-tenant approver cannot see evidence; revoked enrollment cannot graduate; withdrawn/replaced curriculum version invalidates eligibility; manipulated MC `score` cannot bypass the answer key; an open exercise without authorized feedback is ineligible; no arbitrary PAS demo event counts; missing actual signature/expired/revoked certificate or modified signed PDF is invalid; external public QR never exposes academic submissions; a failed signature must remain pending/failed, not `signed`; no new signature issued after revocation.

### Coordination and deployment decision

This change is developed in an isolated branch based on PR #71. It does **not** merge concurrent uncommitted academic authoring changes, does not modify the public deployment, and does not create real learner identities or signing keys. Promotion to `main` remains subject to independent review of the current exact SHA under Graph Harness and acceptance tests with a real signer and policy owner. Production is still **NO-GO**.
