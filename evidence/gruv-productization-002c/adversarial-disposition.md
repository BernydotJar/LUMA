# GRUV-002C — Adversarial review, Fixer and independent verification

## Raw IBM Granite attempts

- The first Granite 3.3 2B source review returned `BLOCKED` but supplied only a partial `evidence` string; required `risk`, `fix` and `limitations` fields were missing. Although the model API indicated the response had ended, the generated JSON does **not** satisfy the reviewer contract. Preserve its exact bytes under `granite-critic.json`. It is **not a valid independent risk assessment**.
- A second scope-restricted Granite review returned `BLOCKED` and claimed `writeTransition` checks an `input.status` value of `duplicate`. The function does not reference `input.status`; `duplicate` is an output receipt boolean, not a plan status. We classify that claim as **not reproduced** and retain the raw response in `granite-scoped-review.json`.
- Both model inputs preceded the final manual Fixer commit `7780b91`. Therefore neither model result is presented as post-fix independent approval. The adversarial Graph gate remains **BLOCKED**.

## Engineering Critic findings and testable fixes

| Challenge | Resolution | Evidence |
| --- | --- | --- |
| A preparer can review their own plan | `reviewedBy` must be different from `preparedBy`; this is checked before and during the transactional CAS. | Firebase emulator tests verify 403 via the API and the exact store rejection. |
| A reviewer could accept a plan whose digest changed between inspector read and Firestore transaction | **Fixed** in `7780b91`: compare plan digest and draft version with the values inspected by the reviewer again in the Firestore transaction, in addition to checking plan revision. | Emulator injects a changed plan digest between inspector and transaction, expects `INSTITUTION_PLAN_READINESS_CHANGED`, and asserts no review. |
| Draft changes between preflight and transactional prepare | Transaction reads and validates the authoritative draft version before writing plan, audit and revision. | Emulator injects a draft version update between reads, expects `INSTITUTION_PLAN_DRAFT_CHANGED`, and verifies no plan was created. |
| Repeated requests could create extra revisions | Transaction reads a deterministic tenant-scoped audit receipt and returns the prior revision only on exact actor/action/payload fingerprint match. | Repeated POST/PATCH returns `duplicate=true`; altered payload or actor conflicts; audit+history cardinality verified. |
| Competing platform reviewers might both approve stale revision 1 | Firestore transactional `planRevision` CAS permits exactly one revision 2 commit. | Concurrent reviewer emulator scenario: one success, one `VERSION_CONFLICT`; exactly two revision documents. |
| Emergency withdrawal could be blocked by preflight outage | Withdrawal requires a verified platform superuser and current expected revision, but does not contact the inspector or read the draft. | Emulator stub inspector throws; withdrawal succeeds, produces revision 3, and historical exact retries remain safe. |
| Bad or foreign tenant data could be loaded | Read path validates tenant, plan state, revision, digest, actor/timestamp and fixed `activationAllowed=false`; forbidden cross-tenant writes are not available via scoped admins. | Emulator corrupts stored tenant ID; GET fails closed; tenant admin 403 and revoked superuser 401. |
| A reviewed plan could be confused with a production activation | The separate plan API and Firestore collection have no publish/activate method and never implement `InstitutionConfigStore`. `activationAllowed` is always false. | Emulator verifies no `institutionConfigs` document; browser checks feature disabled 503 and absence of PUT/DELETE. |

## Honest residual risks

1. The actual upstream release gates GRUV-001, GRUV-002A and GRUV-002B still report `BLOCKED`; a locally reviewed plan cannot bypass them.
2. App Hosting/IAM, exact-SHA hosted CI, managed Firestore index provisioning, real authenticated multi-tenant traffic, billing/RAG isolation, backup/restore and contractual approval remain unverified.
3. The preflight offering scan occurs outside the Firestore transaction. The plan remains **nonactivating** even after dual review. A production publisher would need atomic revalidation and a separate rollback mechanism for already active entitlements, caches and integrations.
4. The Model Critic output is unreliable and no separate human security approver has signed the final code. Neither model output nor the model-assistant analysis constitutes independent production approval.
5. Two mobile visual/WCAG cases are skipped by existing configuration; they are not counted as passes.

**Disposition: `PARTIAL_WITH_DOCUMENTED_BLOCKERS`; do NOT enable `LUMA_INSTITUTION_PLAN_ADMIN_ENABLED` in any production environment or publish any tenant.**
