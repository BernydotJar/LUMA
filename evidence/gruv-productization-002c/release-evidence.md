# GRUV-002C — Controlled publication plan execution receipts

**Product increment:** transactionally staged nonactivating publication plans, different-UID review and emergency withdrawal.
**Source commits:** `f835960e0a77e340f1c725aae0f5ffa238809bbd` (Producer) and `7780b91fe0c80d1cae07738fdf38c71cc25f72ff` (Fixer).
**Worktree:** `/workspace/projects/LUMA-gruv-002c`
**Branch:** `feat/gruv-002c-publication-approval-rollback`
**Release:** `REVIEW_REQUIRED / PARTIAL_WITH_DOCUMENTED_BLOCKERS`, NOT merged, pushed or deployed.

## OBSERVE

- GRUV-002B left `InstitutionPublicationPreflight` read-only, disabled and source-verified.
- LUMA `origin/main` had advanced to Studio CI authentication hardening (#41); it was incorporated cleanly into an isolated new GRUV worktree before implementation.
- GRUV Graph state before increment was 27 append-only events, with GRUV-001/002A/002B release gates blocked. A new independent development node `LUMA-GRUV-002C-governed-publication-plans` was added, while GRUV-002 activation remains dependent on ALL earlier gates.

## PRODUCT SPEC / PLAN

- `specs/070-institution-publication-plan.md`: explicit dual-control, withdrawal, immutable receipts, CAS and nonactivating source constraints.
- `docs/enterprise/institution-publication-plan.md`: admin flow, state semantics, emergency withdrawal and production limitations.
- `architecture/luma-gruv-product-line.md` and `AGENTS.md`: consistency trade-offs and controlled agent operating policy.

## PRODUCER

- `GET/POST/PATCH /api/platform/institutions/{tenantId}/publication-plan` is **off** unless a new private `LUMA_INSTITUTION_PLAN_ADMIN_ENABLED=true` flag is set server-side (it is NOT set in App Hosting).
- `POST`: authorized platform superuser prepares a plan from the current trusted preflight and current version; never a tenant activation.
- `PATCH review`: distinct verified platform superuser; rechecks source preflight and source draft inside the transaction; reviewed is a candidate state, not publication.
- `PATCH withdraw`: authorized immediate withdrawal even if preflight is unavailable. Respects expected plan revision and produces a new immutable audit/revision receipt.
- Firestore path `institutionPublicationPlans/{sha256(tenantId)}` with `audit/{sha256(requestId)}` and `revisions/{zero-padded-planRevision}`.
- No edits to Seres de Excelencia content, branding, coach workflow, runtime entitlement, secrets, live billing, Firestore client rules, or App Hosting feature flags.

## CRITIC / FIXER

- Raw Granite output malformed/incomplete in the first review and contradicted source facts in scoped retry. See `adversarial-disposition.md` and both raw JSON receipts.
- A self-caught emulator test used a new valid review revision in a stale-version assertion; corrected the **test expectation** and reran all suites.
- Independent security reasoning identified a potential TOCTOU vulnerability in reviewed-plan digest consistency. Fixed `7780b91` by enforcing the same draft version AND plan digest **inside** the review transaction, with two newly added race-injection emulator scenarios. See `adversarial-disposition.md`.

## INDEPENDENT VERIFIER — exact final source (local)

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript | PASS | `typecheck-final.log` |
| ESLint | PASS | `lint-final.log` |
| Full Vitest outside emulators | **313 pass, 81 skipped** | `unit-final.log` |
| Combined Firebase Auth/Firestore emulator (includes old role lifecycle, all prior draft/preflight and new plan tests) | **31 pass** | `auth-firestore-final.log` |
| Production Next/webpack build | PASS | `build-final.log` |
| Chromium+mobile Seres UI + showcase + enterprise boundary + disabled new/old APIs | **64 pass, 2 skipped** | `browser-final.log` |
| Graph Harness | append-only ledger validated, node blocked for review | `graph-harness.gruv.events.jsonl` |
| Git source | Producer and Fixer commits created; original SE worktree unchanged | local git log |

### Reproduce

```sh
cd /workspace/projects/LUMA-gruv-002c
npm run lint && npm run typecheck && npm run test:run
JAVA_HOME=/opt/luma-jre21 PATH=/opt/luma-jre21/bin:$PATH firebase emulators:exec \
  --project demo-luma-role-provisioning --only auth,firestore \
  'npm run test:run -- src/lib/tenant-admin-auth.emulator.test.ts src/lib/institutions/draft-store.emulator.test.ts src/lib/institutions/draft-route.emulator.test.ts src/lib/institutions/publication-preflight.emulator.test.ts src/lib/institutions/publication-route.emulator.test.ts src/lib/institutions/publication-plan-store.emulator.test.ts src/lib/institutions/publication-plan-route.emulator.test.ts --maxWorkers=1'
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS='--max-old-space-size=3072' npm run build
CI=1 PLAYWRIGHT_PORT=3152 npm run test:e2e -- e2e/seres-liquid-glass.spec.ts e2e/showcase.spec.ts e2e/enterprise-boundary.spec.ts e2e/institution-preflight-disabled.spec.ts e2e/institution-plan-disabled.spec.ts --project=chromium --project=mobile
PYTHONPATH=/workspace/_shared/Graph-harness-sdlc python3 -m graph_harness --project graph-harness.gruv.project.json --events graph-harness.gruv.events.jsonl validate
```

## RELEASE DECISION

This is a source and emulator-tested governance foundation. It does not enable SaaS customers, GRUV enrollment or actual previously active configuration rollback. The upstream GRUV release graph is not satisfied. Exact-SHA GitHub Actions, production IAM, Firestore managed infrastructure/index, real tenant membership and isolation, production-ready billing/RAG/storage, human security and business approvals must be separately verified. Keep the feature flag OFF and do not deploy/push/merge this branch as a consequence of local test success.

**Terminal status:** `PARTIAL_WITH_DOCUMENTED_BLOCKERS`.
