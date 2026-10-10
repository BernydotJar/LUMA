# Granite -> Fixer -> Verifier: LUMA-GRUV-002A adversarial disposition

**Raw model:** `ibm/granite3.3:2b` from local Ollama, see `granite-store-review.json`.
**Initial model verdict:** `BLOCKED` with four claimed high-severity findings. This is a **pre-fix, source-scoped AI review**, not the final CI result or an authoritative vulnerability classification. The model did not cite exact executable lines or produce the requested limitations field. Preserve its raw output instead of rewriting its verdict.

| Raw critique | Evidence-based engineer disposition | Follow-up |
| --- | --- | --- |
| Duplicates may create another draft | **Not reproduced.** `updateWithReceipt` reads a deterministic tenant-local audit document; same actor + request digest returns the original applied version. Reused ID with altered payload/actor throws `INSTITUTION_DRAFT_REQUEST_REUSE_CONFLICT`. Entire draft + receipt are committed atomically in a Firestore transaction. | Emulator `records each revision once, replays the exact request and denies altered reuse` verifies one receipt per revision. |
| Concurrent version conflicts cause data loss | **Not reproduced.** The write path checks `currentVersion !== input.expectedVersion` and increments exactly once. Firestore transactions retry conflicts and re-evaluate the current version. | Emulator `prevents lost updates when concurrent writers start from the same version` verifies one success and one conflict, with final version 2. |
| An incorrect expected version can overwrite state | **Not reproduced.** The guarded transaction rejects an incorrect expected version before any write. | Emulator `distinguishes missing records and rejects writes with stale versions`. |
| Invalid internal input may bypass HTTP parser | **Addressed via defense-in-depth.** `createDraft` and `updateDraftBrand` now independently rerun the strict parser on allowlisted fields, even for internal callers. | Emulator `rejects forged internal requests even when TypeScript types are bypassed` verifies bad request IDs, unsafe program IDs and invalid palettes. |

## Additional adversarial engineering findings

- **Legacy scope escalation:** the initial route used the application's legacy `assertTenantAdmin`, which allows fallback to tenant learner/coach claims for some existing administrators. Fix: a new `assertInstitutionDraftAdmin` requires dedicated `adminTenantIds` with explicit revocation semantics; emulator uses a real Firebase ID token to test legacy admin denial and cross-tenant rejection.
- **Potential corrupt stored metadata:** persisted draft data is untrusted. Fix: validate stored schema, tenant equality, actors and UTC timestamps. Emulator writes a foreign `config.tenantId` and confirms that HTTP GET fails with 503 rather than revealing data.
- **Attack surface from untrusted JSON:** enforce 8 KiB streamed body limit, `application/json`, strict field allowlist, safe palette and no remote logo path in tenant-brand updates. Emulator confirms 413/415 and extra-field rejection.
- **SE intellectual property:** new tenant creation only accepts a neutral LUMA or GRUV template. It cannot clone the Seres de Excelencia branded template through the API.

## Limits of this disposition

The verification is local. A final independent reviewer has not signed off on the post-fix source, so **the adversarial Graph gate remains BLOCKED**. No PR CI approval, real App Hosting IAM assertion, customer-identity exercise, third-party pentest, brand asset upload review, tenant publication, GRUV language assessment or live data migration has occurred.

**Release decision: REVIEW_REQUIRED / PARTIAL_WITH_DOCUMENTED_BLOCKERS.** This document does not turn the model's raw BLOCKED verdict into PASS; it describes tested dispositions and missing approval.
