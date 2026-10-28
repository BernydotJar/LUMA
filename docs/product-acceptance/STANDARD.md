# LUMA — Operational product acceptance (OPA-1)

**Status: enforced as a product-readiness rubric, NOT a declaration of product completion.**
**Baseline:** stacked candidate PR #67, `878bca15fad3cafb6f9e4e2d4058bf5855835dd2` · production observed October 19, 2026.

## Product definition of done

A page loading, a successful build, a test suite with 100% success or a dashboard showing data is not an accepted enterprise capability. Each required *business action* must independently demonstrate all four gates:

1. **Implementation and persistence** — bounded server operation, authorized tenant/program/**offering** scope, real server read-back, mutation/receipt/audit, idempotency and behavior under failure. Source filenames only prove that references exist, not that a behavior works.
2. **Findable, actionable UI** — independently executed UI control from a discoverable authenticated route by the intended role, using user language and a persisted success/error state. No hidden test-only route, API invocation, mocked click or direct database edit in place of a real UI action.
3. **Whole customer journey** — start-to-finish business outcome, multi-step dependencies, real alternatives, empty/error/recovery states, replay, renewal and unauthorized/cross-tenant negative cases. All mandatory actions and variant obligations are covered. No cherry-picked single happy path.
4. **Actually published** — exact reviewed SHA read back from `/api/version`; public route exists and is not merely a login or 404; an **authorized, independently approved test actor** verifies the exact business action and persistent outcome against the released build. A development or emulator test cannot substitute for published product evidence.

**Additional hard gate:** separate customer acceptance, manual accessibility assessment, privacy/abuse approval and independent product-owner release authorization must be recorded. Automated axe success does not certify WCAG as a whole. No report may call LUMA "ready" on the basis of code, HTTP 200 or E2E counts alone.

## Status semantics

| Status | Meaning |
|---|---|
| `PASS` | All mandatory actions, required variants, business outcomes, authorization failures, recovery paths, independent evidence, signed approvals and publication checks are demonstrated |
| `BLOCKED` | Missing proof, feature flag off, no published route/commit, unsupported workflow, unapproved QA identities or incomplete requirements |
| `FAIL` | A required behavior was exercised and reproducibly violated the contract; record severity and reproduction separately |
| `SOURCE_REFERENCES_PRESENT_NOT_FUNCTION_PROOF` | Code paths exist; **NOT** evidence of implemented behavior, use or publication |
| `ROUTE_RENDERS_ACTION_NOT_YET_PROVEN` | Anonymous GET/DOM succeeded; **NOT** evidence of an authenticated completed action |

The generated report's `verdict` is deliberately `BLOCKED` in `inventory` mode even if every mock proof field is populated. An ordinary CI job that uploads the report passes its **contract self-tests**, not the product. `predeploy` can mark a release candidate eligible for separate operator-controlled promotion only after staging and human proof, and never claims publication. `postdeploy` can mark the complete product PASS only if production parity and customer UAT proofs are also complete.

## Product acceptance coverage model

`docs/product-acceptance/catalog.json` is canonical. It contains **9 mandatory modules, 27 operational actions, 5 multi-role journeys and 33 customer variant obligations**, all listed by unique ID. The "agrochemical enterprise" is a **requested QA persona/hypothesis**: actual customer identity, needs and regulated-training policy have **not been confirmed**. It must not be portrayed as a signed customer requirement or deployed tenant. Catalog examples cover onboarding sales representatives and distributors, managing 1/10/50 courses, evergreen/live sessions, assignment, questions, evidence, coach follow-up, support tickets, reminders, certificate eligibility, reporting, revocation and retention.

For each action, collect: human actor/role, **in-app navigation path from the landing page** (typing a deep URL is insufficient), UI locator and activated control, exact offering scope, a shared UI-to-server operation ID, successful persisted server receipt, server read-back after a **new authenticated session**, independently reproduced cross-tenant denial case, recoverable error handled visibly in the UI, screenshot/trace with digest, build SHA, and an independently registered QA reviewer signature. For every multi-role journey, confirm actor handoffs, the mandatory actions **in business order**, recovery/empty states, and logout/restore. A failed control is a P0/P1/P2 defect, not a test to skip. For each end-to-end journey, confirm **all** ordered actions, variants, final business result, role transfers and negative/error paths; do not replace a missing action with direct Firestore writes.

**Example:** An academy admin with 10 courses must be able to find the correct course by a human-readable name, add or edit lessons, preview content as a learner, route for a different approver, publish an immutable version, enroll users, follow their cohort-specific practice and resolve failures. A dashboard that merely lists the 10 courses does not pass `CAT-02` and cannot pass `AGR-02`.

### Required independent evidence / provenance

- Every action receipt is scoped to exact source SHA and environment (`staging` or `production`), a synthetic authorized tenant, matching actor, **Ed25519-signed independent reviewer from a protected external public-key registry**, current run ID and execution time (24h expiry), with content-hashed browser trace and server read-back. It must prove the user actually activated the UI control. Self-declared reviewer fields, hashes written by an unchecked producer, or public keys supplied by the PR are not authorization.
- Every journey receipt covers its *whole* action/variant graph, including cross-tenant authorization denial, recovery, empty/error states, final persisted business outcome and independent trace.
- Every manual gate requires approval from a real human, an Ed25519 signature with the authorized **human review role**, and a separately inspectable external approval reference plus hashed artifact. The protected keyring pins the mandatory-action catalog digest. The evaluator authenticates the signature, **not** the external approval system; the release engineer must validate the approval directly in that system. See [TRUST_AND_SIGNOFF.md](./TRUST_AND_SIGNOFF.md).
- Read-only production inventory/version receipts are valid for 15 minutes for an enforceable postdeploy decision; stale copies cannot be accepted. No production POST/PUT/DELETE is performed by the inventory script.

### Separation of gates and permissions

| Stage | Tests allowed | Decision | Real customer data / permissions |
|---|---|---|---|
| Unit / emulator | Synthetic identities + Firestore emulator | Specific code behavior PASS/BLOCKED; module NOT certified | Never |
| Independent local Playwright | Synthetic actors on isolated build | UI action proof for candidate only | Never |
| Production public inventory | HEAD/GET/DOM read-only, `/api/version` | Published route/SHA evidence only | Never |
| Authorized staging UAT | Approved QA tenant and real action flows | `predeploy` candidate eligibility only | No customer data |
| Production UAT | Only explicitly authorized, timeboxed QA tenant/test identities; otherwise BLOCKED | `postdeploy` operational business acceptance | No real customer data without separate authorization |

## Graph Harness operating cycle

`Producer → Critic → Fixer → Independent Verifier → Release Gate → Evidence` is repeated **per action/capability**, not per page screenshot. QA cannot use implementation-team assertions as its sole evidence. The current approval graph records the control node separately from the final enterprise acceptance node, which must remain NO-GO until publication and UAT can be independently reproduced.

## Commands

```bash
# Read-only public UI and version inventory; no click or mutation
node scripts/qa/product-public-inventory.mjs
# Contract tests must exercise both false-PASS and real mock-PASS cases
node --test scripts/qa/product-acceptance-contract-checks.mjs
# Draft readiness report; ALWAYS a non-release inventory verdict
node scripts/qa/product-acceptance-gate.mjs --phase inventory
# Strict: fail exit 2 unless independent staging+human signoff exists
node scripts/qa/product-acceptance-gate.mjs --phase predeploy --receipts evidence/product-acceptance/verified/acceptance-receipts.json
# Strict: fail exit 2 unless exact production SHA, actions and UAT are verified
node scripts/qa/product-acceptance-gate.mjs --phase postdeploy --receipts evidence/product-acceptance/verified/acceptance-receipts.json
```

**Safety:** The explicit `--receipts` path is never populated with fictitious test receipts or attached from committed historical test reports. The test harness creates mock proof inside a disposable OS directory to test evaluator logic, not LUMA readiness. If tenant/test identities or authoritative signoff are unavailable, `BLOCKED` is the only valid result.

**Strict command requirement:** `LUMA_ACCEPTANCE_TRUST_STORE` must refer to a trusted public-key registry outside the checkout. Signed receipts must be provided by protected Release Engineering inputs, not by an unreviewed JSON in the PR. `predeploy` is now a dependency of the production deployment job. Protected environment provisioning is required and has not yet been verified.
