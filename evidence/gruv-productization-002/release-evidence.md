# LUMA-GRUV-002A — Source execution and release evidence

**Source commit:** `0af53094c8b88d275a3117163d66365e0b171177` on `feat/gruv-002-draft-control-plane` (stacked on GRUV-001 commits).
**Execution:** Cloud Sandbox MCP V2, `/workspace/projects/LUMA-gruv-002`, isolated from the dirty Seres CX checkout.
**Product release:** **REVIEW_REQUIRED**. No push, merge, deployment, live tenant creation or production feature-flag enablement.

## OBSERVE / SPEC

- GRUV-001 local source contract exists, but its independent quality/review gates remain BLOCKED; GRUV-002 production activation cannot supersede it.
- Existing Firebase Admin role verification, revoked-token checks and institution-scoped learner stores were reused rather than replaced.
- `specs/068-institution-draft-control-plane.md`, `docs/enterprise/institution-config-draft-operations.md`, `README.md`, `AGENTS.md` and ADR were updated.
- Created independent preparatory graph node `LUMA-GRUV-002A-institution-draft-persistence` with no production activation authority, leaving GRUV-002 dependent on both GRUV-001 and 002A.

## PRODUCER / FIXER

- Implemented `/api/platform/institutions/{tenantId}/draft` with GET/POST/PATCH, disabled by default by `LUMA_INSTITUTION_DRAFT_ADMIN_ENABLED` (not set in deployed configuration).
- Required Firebase revoked-token verification; POST is platform-superuser-only; tenant admin GET/PATCH require **dedicated `adminTenantIds`**, with legacy claims denied.
- Firestore draft writes use per-tenant hashed document paths; compare-and-swap on configVersion; transactional request receipts and immutable audit; exact replay idempotence.
- A draft is **not** the published `InstitutionConfigStore`, cannot authorize learning, publish programs, enable real commerce or affect SE branding/content.
- Added neutral LUMA tenant template and GRUV language template. Seres branding remains exclusive to its existing experience.
- Corrected an initially real defense-in-depth issue: revalidate internal store calls even when HTTP parser was bypassed.

## VERIFY (all results LOCAL; full hosted CI not executed)

| Check | Exact verification scope | Result |
| --- | --- | --- |
| Graph schema/ledger | `python3 -m graph_harness ... validate` using pinned shared runtime via PYTHONPATH | PASS, append-only ledger valid |
| Unit suite | `npm run test:run` | **309 pass, 60 skipped** (skipped emulators outside their required environment) |
| Security parser/permission tests | Vitest `draft-input`, `draft-access`, old config tests | PASS |
| Emulator, current post-fix | Java 21 + Firebase Auth/Firestore, `draft-store` and `draft-route` emulator tests | **8/8 PASS** |
| Existing role compatibility | Combined local Auth+Firestore CI-equivalent on prior pre-fixer source: `tenant-admin-auth`, `draft-store`, `draft-route` | **9/9 PASS**, rerun after fixer in hosted CI is pending |
| Lint | `npm run lint` | PASS |
| TypeScript | `tsc --noEmit --incremental false` and Next production build | PASS |
| Production build | `NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=3072 npm run build` | PASS on latest source |
| Chromium/mobile browser | `CI=1 PLAYWRIGHT_PORT=3127 npm run test:e2e -- e2e/showcase.spec.ts e2e/enterprise-boundary.spec.ts --project=chromium --project=mobile` | **48 pass, 2 skipped** |
| Workflow YAML | Parsed `.github/workflows/quality.yml`; existing `identity-roles` job expanded to run draft emulators | Valid, **not remotely executed** |
| Critic | IBM Granite local source review, see raw JSON and dispositions | Initial `BLOCKED`; post-fix independent signoff pending |

### Reproduction commands

```bash
cd /workspace/projects/LUMA-gruv-002
npm run lint
npm run typecheck
npm run test:run
JAVA_HOME=/opt/luma-jre21 PATH=/opt/luma-jre21/bin:$PATH firebase emulators:exec \
  --project demo-luma-role-provisioning --only auth,firestore \
  'npm run test:run -- src/lib/tenant-admin-auth.emulator.test.ts src/lib/institutions/draft-store.emulator.test.ts src/lib/institutions/draft-route.emulator.test.ts --maxWorkers=1'
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS='--max-old-space-size=3072' npm run build
CI=1 PLAYWRIGHT_PORT=3127 npm run test:e2e -- \
  e2e/showcase.spec.ts e2e/enterprise-boundary.spec.ts --project=chromium --project=mobile
PYTHONPATH=/workspace/_shared/Graph-harness-sdlc python3 -m graph_harness \
  --project graph-harness.gruv.project.json \
  --events graph-harness.gruv.events.jsonl validate
```

## DECIDE — release gate and external blockers

1. GRUV-001 upstream independent review and quality release gates are still BLOCKED; do not mark GRUV-002 or GRUV-002A production DONE merely because local source tests passed.
2. The model's original source review returned BLOCKED; subsequent fixes have local deterministic proof, but post-fix independent review has not been signed off.
3. The exact-source GitHub Actions workflow and IAM/managed runtime have not been exercised for this branch; no remote CI or production SLO assertion exists.
4. No public self-service tenant activation: program ownership, persistent active configuration publication, runtime trusted tenant selection, scoped enterprise RAG, migrations, budget controls, support/backup/recovery and merchant-grade billing still require implementation and authorization.
5. The current Seres de Excelencia deployment remains unchanged. Continue next with GRUV-002 trusted membership and publish/rollback contracts only after resolving those blockers.

**Terminal assessment for this increment: `PARTIAL_WITH_DOCUMENTED_BLOCKERS`**. Evidence is source-local and intentionally not a customer production acceptance certificate.
