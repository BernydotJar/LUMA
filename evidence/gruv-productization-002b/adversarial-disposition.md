# Independent Critic -> Fixer -> Verifier — GRUV-002B

**Raw model result:** `granite-critic.json` (IBM Granite 3.3 2B, source snapshot before the offering-reader refactor). The model returned `BLOCKED` with three findings, two labelled critical. These labels are not independent evidence of exploitability. We retain the original review unchanged and evaluate each claim against real source behavior and emulator tests.

| Raw claim | Review and disposition | Verification |
| --- | --- | --- |
| The inspector's Firestore/Admin SDK dependency could bypass write policy | **Defense-in-depth improvement implemented.** The domain inspector no longer accepts a writable Firestore SDK or mutable draft store; it receives a `ScopedOfferingReader` and a read-only draft lookup. The infrastructure adapter encapsulates the only `where tenantId == …` + `where programId == …` query and hard-codes the 51-row limit. A future caller cannot reach write methods through the inspector's exposed interfaces. This does NOT substitute for server IAM hardening. | 20/20 combined Auth+Firestore emulator integration tests; production IAM remains an external gate. |
| The GET publication-preflight endpoint lacks authentication | **Not supported by examined source.** `requireLearningAdmin(request)` checks a valid Firebase ID token with `checkRevoked=true`; `isPlatformSuperuser` is required. Requests are denied before the scoped read. The server flag is unset by default. The model appears to have overlooked these checks. | Emulator: anonymous 401, tenant admin 403, revoked superuser token 401. Browser: disabled endpoint 503 and POST/PUT/PATCH/DELETE 405. |
| Tenant data may leak from broad Firestore queries | **Not reproduced.** Queries require exact tenant and program predicates, are bounded to 51 rows and independently validate all returned records. Same program ID in a foreign tenant provides no local evidence. | Emulator tests: foreign-tenant matching program, corrupted metadata, >50 offering cap, missing and inactive programs. |

## Additional independent findings resolved in the source increment

- **Advisory digest incompleteness.** A digest that included only active-offering IDs would not change when an offering changed from draft to completed. The digest now includes sorted IDs + statuses of validated records, including inactive states. Tested with direct emulator updates.
- **Stored configuration contract drift.** Older generic scope validation could accept program IDs containing whitespace despite the stricter draft creator. Added strict scope validation before a preflight read; corrupt IDs fail closed. Tested with modified Firestore documents.
- **Upstream UI divergence.** `main` had gained the Seres de Excelencia Liquid Glass v4 changes while the GRUV source branches were isolated. Reconciled two conflicts in `src/lib/themes.ts` and `src/components/experience-console.tsx` and tested themes, optical lens behavior and mobile/desktop navigation.

## Residual release risks

1. The source model review preceded final fixes. No post-fix human independent authorization has been recorded. Its raw `BLOCKED` verdict is **not rewritten to PASS**.
2. Firestore Admin SDK bypasses client rules. Deployable IAM and service account least privilege must be verified independently; unit/emulator tests cannot prove hosted IAM.
3. The composite `programOfferings` index exists in source but **has not been deployed** in this increment. Managed Firestore errors fail closed, not as a misleading green status.
4. Query + draft reads are not one transactionally frozen snapshot; a digest is **not** an approval token. Future publication must atomically revalidate the current program/tenant/version and produce signed/audited release receipts.
5. No dynamic active tenant resolver, curricular ownership certification, scoped managed RAG proof, billing enablement, backup/restore rehearsal, GRUV language assessment or production observability signoff was implemented.

**Decision:** source-only implementation verified locally; release status `REVIEW_REQUIRED`. GRUV-001, 002A and 002B remain gated; `LUMA-GRUV-002` product activation is still pending.
