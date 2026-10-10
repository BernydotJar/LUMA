# LUMA Enterprise CI/CD — verified release receipt
**Date:** 2026-10-10
**Decision:** VERIFIED / Graph Harness DONE
**Repository:** BernydotJar/LUMA
**Base branch:** main (protected)
**Release SHA:** `7daba30e1469bda7b9198353d95f3f7db7b74ee1`
**GitHub run:** [38031714611, attempt 4](https://github.com/BernydotJar/LUMA/actions/runs/38031714611) — SUCCESS
**PR #32:** [CI stabilization](https://github.com/BernydotJar/LUMA/pull/32), merged
**PR #33:** [Controlled Firebase deployment](https://github.com/BernydotJar/LUMA/pull/33), merged

## Delivery verification

| Gate | Directly observed status |
| --- | --- |
| verify — ESLint, TypeScript, unit tests, source build | PASS |
| security — production dependency audit | PASS |
| firestore — emulator integration suite | PASS |
| identity-roles — Auth/Firestore emulator | PASS |
| browser — desktop/mobile E2E on built archive | PASS |
| deploy — OIDC, App Hosting, SHA, production smoke, rollback validation | PASS |
| main — PR-only, strict five Actions checks, no admin bypass/force push/delete | ENFORCED |
| release source — content-addressed archive & immutable manifest | VERIFIED |
| Firebase build — gh-7daba30e1469-38031714611-4 | READY |
| Firebase rollout — gh-7daba30e1469-38031714611-4 | SUCCEEDED |
| Firebase traffic — expected build | 100% |
| production /api/version | HTTP 200; exact git SHA and run |
| public custom domain /api/version | HTTP 200; exact git SHA and run |
| browser smoke — 6 desktop + 6 mobile routes | PASS |
| appearance, login entry, anonymous role boundary, single active Studio navigation | PASS |
| JS exceptions / first-party HTTP 5xx in smoke | 0 |
| rollback validation — validateOnly=true | PASS; no traffic change |
| IBM Granite — scoped IAM remediation | CONDITIONAL_PASS; low concern only |
| independent Firebase/GitHub verifier | VERIFIED |
| Graph release gate + production gate | PASS; node DONE |

## Production identity and cost boundaries

Release identity is short-lived GitHub Actions OIDC, restricted to immutable repository/owner IDs, `main`, `production`, the approved workflow and `push`. It holds a nine-permission custom project role, create-only source-bucket access, and `roles/iam.serviceAccountUser` only on the existing App Hosting compute service account. Independent read-back confirmed no other project grants to the release account, no project-level `actAs` grant, and no long-lived user-managed keys.

The backend remains `luma`, `us-central1`, project `luma-learning-intelligence`. Its run capacity is unchanged: 1 CPU, 512 MiB RAM, 0 min/2 max instances, concurrency 80. No additional backend or CI workstation was provisioned. Provider build/artifact storage may still incur normal charges.

## Provenance and historical failures

Attempt 1 was denied by the repository's immutable OIDC subject convention and corrected with a constrained policy migration. Attempt 2 reached source upload but was denied `iam.serviceAccounts.actAs` and was corrected with one compute-service-account-scoped binding. Attempt 3 was canceled after the GitHub-hosted runner stalled installing browser dependencies, before Playwright or production deployment. Attempt 4 reran the entire matrix and finished successfully. No failure was relabeled as PASS.

Prior serving build `build-2026-10-10-001` was READY and responsive but has no independently verifiable source SHA. It was validated as a rollback request target using `validateOnly=true` without changing traffic. It is *not* an automatically verified rollback. The new released build now has exact SHA, run, successful smoke and a finalized ledger and can be evaluated as a rollback target for a later release.

## Evidence index

- `evidence/cicd-enterprise/final/final-ci-jobs.json` and `final-main-protection.json`
- `evidence/cicd-enterprise/final/actas-remediation.json` and `independent-iam-verification.json`
- `evidence/cicd-enterprise/final/granite-actas-review.json`
- `evidence/cicd-enterprise/final/prior-rollback-validate-only.json`
- `evidence/cicd-enterprise/production/manifest.json`
- `evidence/cicd-enterprise/production/release-result.json`
- `evidence/cicd-enterprise/production/smoke.json`
- `evidence/cicd-enterprise/final/independent-production-verification.json`
- `evidence/cicd-enterprise/production-ci.json`
- `graph-harness.events.jsonl` — 659 validated, append-only events
- [Actions full production artifact and screenshots](https://github.com/BernydotJar/LUMA/actions/runs/38031714611/artifacts/11679961688)

## Explicit limitations

Live participant Google SSO was not exercised with real identities; anonymous production access and token/role behavior in isolated emulators were tested. Historical predecessor SHA remains unverified; no destructive production rollback drill was performed. Further updates must remain behind the protected PR and complete CI/CD gates.

Delivery documentation: `docs/operations/cicd.md` and `docs/operations/release-and-rollback.md`.
