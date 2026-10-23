# LUMA-070 / P0 #85 — Program-owned, versioned assessment catalogue

**Candidate branch:** `feat/luma-program-assessment-registry-20261021` (based on the nonproduction #71 integration source `a76f9976edec676792b5a6d9c7e0f7bf3bff74af`).

**Release decision: NO-GO.** This is an implementation and verification dossier, **not** an approved institutional publication, external review, Graph Harness signature, or Firebase promotion.

## Business invariant

**Enrollment is necessary but insufficient to access a diagnostic.** The learner must additionally belong to a tenant/program with an explicitly approved and published assessment revision. Never fall back to Seres de Excelencia Practitioner questions for an unrelated program.

### Source of truth and Firestore shape

Document IDs are derived server-side as SHA-256 over JSON `[tenantId, programId]`, matching the established tenant/program isolation convention.

```text
learningAssessmentPrograms/{sha256([tenantId, programId])}
  schemaVersion = 1
  tenantId, programId
  status = "published"                     # otherwise fail closed
  activeVersion = "se-practitioner-entry-v1"
  offeringId = "<id of active programOfferings document>"
  versions/{activeVersion}
    schemaVersion = 1
    tenantId, programId, offeringId, version
    status = "approved"
    curriculumRevision = "<versioned academic revision>"
    classSlugs = ["..."]                    # ordered, unique, approved class contracts
    sourceIds = ["..."]                     # EXACT union of approved class sources
    recommendedNextSlug = "<one of classSlugs>"
    submittedByUid = "<curriculum author>"
    approvedByUid = "<different authorized reviewer>"
    approvedAt, publishedAt = "ISO-8601"    # reviewed before published
programOfferings/{offeringId}
  offeringId, tenantId, programId, status = "active"
```

The author/reviewer metadata is a **publication precondition**, not proof that an external GitHub review occurred. A privileged institutional publishing workflow with a durable identity receipt must create these records. **No student-visible write/publish API or automatic production seed is included in this PR**; no actual academy publication is claimed.

Both the pointer and the revision must agree on all identity/version fields, the offering must be active for that tenant/program, and source IDs must match the class-contract sources exactly. Unapproved/draft/missing/revoked records return `409 assessment_not_published` without disclosing the foreign curriculum. The UI shows an explanation and preserves the normal learning path.

### Race and evidence semantics

1. On GET, verify revocation-aware Firebase identity, effective tenant/program entitlement and existing learner profile. Load the current approved pointer+revision+offering; expose only question labels and choice IDs, never answers.
2. The browser records the version it fetched, and POST must specify that same version. A rotated/withdrawn registry gives `409 assessment_version_changed` or `assessment_not_published`.
3. The server grades strictly against its currently approved class list, ignoring client scoring. Result receipts include `tenantId`, `programId`, `offeringId`, `curriculumRevision`, `version` and `twinAuthority: none`.
4. **Inside the same Firestore transaction that appends the event**, re-check the current pointer, revision and offering as well as the active entitlement. Concurrent revocation/approval updates invalidate or retry the event; a stale receipt cannot commit.
5. The provisional next learning action stays inside the program's approved class list (including the all-correct case), and a later genuinely scored simulation supersedes this provisional recommendation.

No change is made to the independent Ed25519 release-signing requirements or the authoritative Graph Harness ledger.

## Verification and reproducibility

- TypeScript: PASS.
- Targeted program registry/HTTP/contract tests: PASS (33 before combined-quality gate tests).
- Full Vitest local with resource-limited workers: **537 PASS, 111 emulator-only SKIP**. The single old CI count assertion was updated from 13 to 16 and the full suite rerun PASS.
- Real local Firestore Emulator: **8 PASS** (3 new assessment tests + 5 existing store tests), including revoking registry approval and active offering after enrollment, idempotency, and concurrent event IDs.
- Authenticated Chromium QA runner has been expanded from 13 to **16 expected checks**: separate program-specific question lists and versions; enrolled but unpublished program `409` plus human-readable UI fallback; and approval withdrawal blocking GET and POST, in addition to enrollment, concurrent writes, RAG fail-closed, mobile layout, and revocation coverage. A source SHA–bound fresh-run receipt is required by the CI job; **the expanded 16 checks have not yet been confirmed by the remote runner**.
- Local full production build attempt ended in `SIGKILL` due to shared 7.7 GiB workstation memory exhaustion and concurrent work. Treat as **unverified**, not a code PASS. Required: an isolated GitHub Actions `verify` build on this exact commit.

### Reproduction

```bash
npm ci
npm run lint
npm run typecheck
npm exec vitest run -- --maxWorkers=1 --no-file-parallelism
firebase emulators:exec --project demo-luma-assessment-registry-20261021 --only firestore \
  "npm exec vitest run src/lib/program-assessment.emulator.test.ts src/lib/learning-store.emulator.test.ts"
firebase emulators:exec --project demo-luma-learning-uat-20261020 --only auth,firestore \
  "bash scripts/qa/run-learning-assessment-uat.sh"
```

The final command requires emulator ports `9099/8085` and isolated QA localhost port `3298` to be free, and will reject a non-demo Firebase project. In this workstation the Auth port was held by another project, so the extended Chromium suite was **not locally executed**. Do not stop other projects to force it; review the new CI job's result.

## Remaining business acceptance work

- Implement/integrate an **authenticated institutional publisher** that writes approved version snapshots with actual reviewer authorization and append-only human review audit; an Admin SDK fixture is not equivalent to that workflow.
- Establish curriculum and media/source rights, retention and institutional privacy policy, including withdrawn/expired lesson content before the assessment can be published.
- Execute the 16-case authenticated suite on the **exact final integrated SHA**, independently inspect the results, and additionally test 1/10/50 published programs rather than assuming two program fixtures imply that scale.
- Confirm RAG retrieval for each approved class against the real authorized corpus; the existing fail-closed stub only proves no fabricated answer when retrieval is unavailable.
- Independent nonauthor reviewer, protected Ed25519 trust plane, Graph Harness product acceptance, staging UAT and postdeploy SHA parity across both hosts remain required for GO.

**Suggested Graph Harness status:** implementation **under independent review**, product/release **NO-GO**. Do not merge to protected main or deploy from this branch.
