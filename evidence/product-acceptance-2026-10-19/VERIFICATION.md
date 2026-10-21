# LUMA — Independent operational product-acceptance baseline

**Reviewed:** 2026-10-20 UTC. **Repo:** `BernydotJar/LUMA` · QA branch `qa/product-operational-acceptance-20261019` stacked on PR #67 baseline `878bca15fad3cafb6f9e4e2d4058bf5855835dd2`. **Disposition: PRODUCT NO-GO / BLOCKED.** This report confirms acceptance-control behavior, **not** that all LUMA modules are functional or deployed.

## Concrete checks and outcomes

| Check | Result | Reproduction / source |
|---|---|---|
| 18 negative/positive product-contract cases (Node `node:test`) | **18 PASS, 0 FAIL, 0 SKIP** | `node --test scripts/qa/product-acceptance-contract-checks.mjs` |
| Application Vitest unit suite | **371 PASS / 81 SKIP, 0 FAIL** | `node node_modules/vitest/vitest.mjs run --reporter=dot` (same dependency versions as LUMA, separate `node:test` file excluded from Vitest) |
| ESLint all source | **PASS** | `node node_modules/eslint/bin/eslint.js .` |
| TypeScript | **PASS** | `node node_modules/typescript/bin/tsc --noEmit --pretty false` |
| GitHub Actions workflow YAML structural check | **PASS** | PyYAML parse, protected release gate present in `deploy.needs` |
| Graph Harness structure | **VALID**, 85 nodes and 712 events before adding new attestation | `python3 -m graph_harness.cli validate` with shared Graph harness tool |
| Read-only published SHA check | **Mismatch** | `GET https://luma.lch-app.cloud/api/version` returns `6ddcae8ff2464782b7e4001c4cd5d60092dbb099` (checked 2026-10-20 15:26Z) |
| Public onboarding routes | **404**, therefore unapproved | `GET /academia/solicitud`, `/plataforma/solicitudes`, `/academia/primer-curso` |
| Product module and full customer journey completion | **0/9 and 0/5 PASS** | `operational-readiness.json`; 27/27 required business actions unverified end-to-end |
| Protected reviewer signoff and production UAT | **BLOCKED** | No independently provisioned protected signers/keys/verified signed receipts are available; none have been simulated as genuine |

**Limits:** No learner/customer production account, content, invitation, payment, private profile or production permissions were accessed or modified. Read-only anonymous Chromium and HTTP GET captured only public routes, headings and control names. The published version has not been promoted. No claim of customer-approved requirements for the agrochemical enterprise is made.

## What the gate now refuses by design

1. A dashboard populated with records and a 200 response cannot certify creation/editing of a course.
2. A generic 125/125 E2E success count cannot certify a module with missing mandatory actions.
3. A direct deep-link entry is insufficient; the intended role must find and execute the function via in-app navigation.
4. A UI click without correlated server operation ID, tenant authorization or read-back **after a new session** is unapproved.
5. Omitting a required alternate path (10 or 50 courses, evergreen or live, multiple cohorts, cancellation, reissue/recovery) blocks the full journey.
6. A forged denial, missing rollback, cross-tenant leak, unordered business steps or missing actor handoff blocks acceptance.
7. A staging PASS cannot substitute for the **same exact deployed SHA** and independently verified authorized production action.
8. An unsigned JSON, a self-assigned reviewer, a signing key included in a PR, a changed signature claim, an unpinned catalog or a missing human signoff cannot open the release gate.
9. A failed manual protected environment configuration blocks promotion, rather than downgrading to an unprotected automatic release.

## Outstanding gates before full product PASS

**P0:** Confirm actual agrochemical client requirements and permission model; publish and manually verify the institutional onboarded routes on an approved QA tenant; complete tenant-owned curriculum authoring, questions, practice, approvals, media rights and immutable published version; enforce cohort-specific learner/coach evidence and entitlement denials; prove real recovery paths and session restoration.

**P1:** Implement verified in-app ticket triage and automation rule/dispatch tracking, truthful reports and certificates, offboarding and retention signoff; validate screen-reader/keyboard/mobile and field-like performance baselines. **Do not claim features absent globally solely from a missing path in the present acceptance catalog; investigate existing services separately.**

**Security and release:** Configure `enterprise-product-acceptance` environment reviewers and permissions, independently provision public reviewer key registry and signed receipts, verify external human approvals directly, pin the acceptance catalog, rerun all tests against exact SHA, perform customer staging UAT and postdeploy verified acceptance. **No merge or deploy is authorized by these tests.**

Related reference docs: `docs/product-acceptance/STANDARD.md`, `TRUST_AND_SIGNOFF.md`, `BASELINE.md` and `catalog.json`.
