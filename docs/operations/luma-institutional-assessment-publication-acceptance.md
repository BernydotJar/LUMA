# LUMA — Publicador institucional de assessments
## Implementation and independent-acceptance dossier

**Branch:** `feat/luma-assessment-institutional-publisher-20261021`  
**Stacked baseline:** `feat/luma-program-assessment-registry-20261021` (`b22e370`, PR #90)  
**Product scope:** LUMA-070 / GitHub P0 #85  
**Release verdict:** **NO-GO**. This is implementation plus synthetic acceptance, **not** an institutional rights clearance, independent Graph Harness review or release signature.

### 1. End-to-end product flow

| Stage | Human actor | Business action | System evidence |
| --- | --- | --- | --- |
| 01 Prepare | Authorized institutional administrator | Choose a tenant/program, active offering, unique version and curriculum revision; select existing class contracts and next step | `assessmentPublicationPlans/{sha([tenant,program])}` status `prepared`, revision 1+, immutable `audit/` and `revisions/` records |
| 02 Review | **Different** authenticated institutional administrator with `assessmentReviewer:true` | Validate curriculum and attest the referenced rights dossier + SHA-256 | Review UID, UTC time, evidence reference/digest; status `reviewed`; author self-approval forbidden |
| 03 Publish | Institutional administrator with `assessmentPublisher:true` who is **not the reviewer** | Publish the exact reviewed version while the offering is active and existing published pointer unchanged | Transactional `versions/{version}` **CREATE-only** with approved immutable snapshot and `learningAssessmentPrograms/{hash}` public-read pointer. No learner can grade against unpublished versions |
| 04 Withdraw | Authorized publisher | Security stop, rights revocation, replacement or operator withdrawal | Status `withdrawn`, pointer disabled only when the plan version was live. Historical revision, receipt and prior learner evidence retained |

**The person who prepared a draft may perform stage 03 after a different person has approved stage 02.** The same UID cannot prepare+review or review+publish. No session can self-authorize via browser input, claims are verified with Firebase Auth (`checkRevoked:true`) and explicit `adminTenantIds`. Neither generic learner nor coach scopes grant publication authority. All requests fail closed if `LUMA_ASSESSMENT_PUBLICATION_ENABLED !== "true"`.

### 2. Architecture

**UI:** `/studio/assessments` → Liquid Glass publication workspace. Scope is explicit, no new primary navigation entry. Includes an accessible curricular checklist, explicit reviewer rights reference and SHA-256, approval status, publish and emergency withdrawal controls. Unauthenticated clients cannot obtain plan data.

**API:** `/api/platform/institutions/[tenantId]/programs/[programId]/assessment-publication`:

- GET: authorized institution plan and currently published pointer
- POST: prepare with exact schema, maximum 8 KiB, optimistic `expectedPlanRevision`, idempotency `requestId`
- PATCH: `review` / `publish` / `withdraw`, role-specific authorization and conditional transition

**Persistence:** `FirestoreAssessmentPublicationStore` validates every command at the server boundary. Transaction reads the revision head, action receipt, existing published pointer, offering and version (where needed) before any writes. The content source list is **derived from server-owned class contracts**, not client-provided sources. It checks tenant/program matches, the active offering, source exactness, content lookup, role separation and old pointer state. Historical version documents are created once; no overwrite or silent fallback.

**Audit:** One per-request transaction-created receipt in `audit/{sha256(requestId)}` and one historical revision snapshot in `revisions/{paddedRevision}`. Reused IDs by other actors or with modified payload fail. Simultaneous reviewers serialize through CAS and produce a single revision.

**Important limits:** A rights dossier ID + SHA-256 is an *authenticated reviewer attestation*, **not independent verification of licensing**, media ownership or source material provenance. A separate rights/source approval workflow and signed institutional policy remain prerequisites for an enterprise production GO. A newly deployed class-contract code revision must also be governed alongside assessment versioning; full content-hash binding to compiled questions is not established by this change alone.

### 3. Tests and directly observed results

| Evidence dimension | Test | Status |
| --- | --- | --- |
| Implementation and contracts | Strict schema validation, no client-supplied source, protected transition/CAS, TypeScript/lint | **PASS** |
| Firebase tenant/identity boundary | **8 PASS** Auth + Firestore Emulator, unique ports 9186/8186; two-person handoff, claim revocation, cross-academy withdrawal, pointer drift, concurrent reviews and immutable versions | **PASS** |
| Learner-facing admin UI | **4 PASS** Chromium desktop/mobile at `/studio/assessments`, including guest restrictions, disabled buttons and no horizontal overflow | **PASS** |
| Existing product regression | Vitest on one worker: **550 PASS / 119 SKIP** (emulator suites not enabled in generic run); policy Node tests 3 PASS | **PASS** |
| Published runtime | Build and navigation on actual Firebase, institution owner and reviewer with live credentials | **NOT TESTED** |
| Product acceptance | Classroom student/coach flow with 1, 10 and 50 real published courses, rights/privacy and scoped RAG corpus | **NOT TESTED** |
| Independent release | Non-author review + Ed25519 protected source attestation + staging predeploy/postdeploy and both public-host SHAs | **NOT APPROVED** |

### 4. Reproducible verification

Run from the exact checkout, without reusing historical PASS:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:run -- --maxWorkers=1 --no-file-parallelism

firebase emulators:exec --project demo-luma-assessment-publication \
  --only auth,firestore \
  "npm run test:run -- src/lib/assessment-publication-store.emulator.test.ts src/lib/assessment-publication-route.emulator.test.ts --maxWorkers=1 --no-file-parallelism"

node --test scripts/qa/assessment-publication-policy.check.mjs
PLAYWRIGHT_PORT=3966 npm run test:e2e -- --grep "institutional assessment publisher"
```

The local emulator acceptance above used a temporary custom Firebase emulator config to avoid ports occupied by other sandbox projects. **No other container's services were stopped**. Chromium browser execution used isolated Webpack development mode, because the cloned checkout temporarily shared `node_modules` via a symlink incompatible with Turbopack's root constraints. GitHub CI uses clean `npm ci` and must independently validate the exact PR SHA.

### 5. Graph Harness / release prerequisites

This PR adds a separate required **`assessment-publication` GitHub Actions job** before both `release-readiness` and `deploy`; no required checks were removed. A passing emulator gate is **not independent product approval**.

The independent critic must review the exact final SHA against all four acceptance dimensions (implemented, visible, full customer journey, deployed), validate rights policies and source-linked question integrity, examine 1/10/50 program operations, inspect SHA-bound evidence, and only then perform protected Graph Harness transitions with non-author signatures.

**NO-GO until separate authorized human review and production promotion.** The feature flag remains off by default and there is no automatic seed, activation, merge or Firebase deploy.
