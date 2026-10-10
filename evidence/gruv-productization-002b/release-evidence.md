# GRUV-002B — Observed local evidence and release boundaries

**Source commit:** `345e71fd684f9171596e444530e6f8d4e5fe9991`
**Checkout:** `/workspace/projects/LUMA-gruv-002b`
**Branch:** `feat/gruv-002b-publication-preflight` (stacked on 002A, GRUV-001 and `main` including Liquid Glass v4).
**Execution environment:** Cloud Sandbox MCP V2 workstation; source-only local emulator and browser validation. No live institution provisioning.

## OBSERVE

- Prior 002A draft control plane was implemented locally, gated and intentionally disabled.
- `origin/main` advanced by PR #40, Seres Liquid Glass v4, while our branches were isolated. A real merge conflict was resolved while preserving the optical lens in the theme preview and sourcing SE identity from the branded contract.
- Existing program offering records use `programOfferings` with `tenantId`, `programId`, `offeringId`, `status`. The existing client Firestore security rules deny all reads/writes; server-side Admin SDK authorization remains mandatory.

## PRODUCT SPEC + PRODUCER

- `specs/069-institution-publication-readiness.md`, `docs/enterprise/institution-publication-preflight.md` and `architecture/luma-gruv-product-line.md` define the product outcome and DDIA trade-offs.
- Created `LUMA-GRUV-002B-publication-readiness` source node in Graph Harness and made full GRUV-002 depend on GRUV-002B. This does not unblock existing release nodes.
- Built `GET /api/platform/institutions/{tenantId}/publication-preflight`; always disabled until explicit server flag, requires a verified and revocation-checked Firebase platform superuser, performs no mutations and can **never authorize activation**.
- The domain inspector uses a bounded read-only offering adapter; the scoped query is tenant+program filtered, and includes explicit over-cap/corrupt data failures. Results include local offering observations, advisory digest and three unresolved release blockers.
- Added the Firestore source composite index; it is **not claimed as deployed**.
- Expanded GitHub's existing `identity-roles` job to include source/test coverage for preflight; that remote workflow has not yet run on this exact source commit.

## CRITIC / FIXER

- IBM Granite 3.3 2B returned `BLOCKED` with three source-scoped assertions. Retained `granite-critic.json` and detailed engineering disposition.
- Introduced a read-only injection boundary for Firestore queries and strict validation for stored program scope.
- Corrected digest coverage for inactive offering transitions.
- Avoided all publication methods and strengthened browser guard coverage.

## INDEPENDENT VERIFIER (local; no production attestation)

| Verification | Observed result | Artifact |
| --- | --- | --- |
| Full Vitest suite outside emulator | **309 passed, 70 skipped** (emulator tests run separately) | `unit.log` |
| Combined Auth + Firestore emulator job | **20 passed, 0 failed**, including older tenant-admin authorization, draft CRUD and preflight | `auth-firestore-emulator.log` |
| ESLint and TypeScript | PASS | `lint.log`; production build also type-checked |
| Production Next/Webpack build | PASS | `build.log` |
| Chromium + mobile: Seres Liquid Glass, showcase, institutional boundaries | **56 passed, 2 skipped** | `seres-browser.log` |
| Chromium + mobile: unpublished API remains off and mutation verbs absent | **4 passed** | `disabled-route-browser.log` |
| Graph Harness ledger | Valid append-only events, new node in `running` before release decision | `graph-harness.gruv.events.jsonl` |
| Git checks | Source commit created; no branch push, merge or deploy | local Git log |

Reproduction for the important integration gate:

```sh
cd /workspace/projects/LUMA-gruv-002b
JAVA_HOME=/opt/luma-jre21 PATH=/opt/luma-jre21/bin:$PATH firebase emulators:exec \
  --project demo-luma-role-provisioning --only auth,firestore \
  'npm run test:run -- src/lib/tenant-admin-auth.emulator.test.ts src/lib/institutions/draft-store.emulator.test.ts src/lib/institutions/draft-route.emulator.test.ts src/lib/institutions/publication-preflight.emulator.test.ts src/lib/institutions/publication-route.emulator.test.ts --maxWorkers=1'
npm run lint && npm run typecheck && npm run test:run
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS='--max-old-space-size=3072' npm run build
CI=1 PLAYWRIGHT_PORT=3136 npm run test:e2e -- e2e/seres-liquid-glass.spec.ts e2e/showcase.spec.ts e2e/enterprise-boundary.spec.ts --project=chromium --project=mobile
CI=1 PLAYWRIGHT_PORT=3140 npm run test:e2e -- e2e/institution-preflight-disabled.spec.ts --project=chromium --project=mobile
```

## RELEASE GATE

**`PARTIAL_WITH_DOCUMENTED_BLOCKERS`**: the tested source is complete for this read-only vertical slice but is **not production ready**. GRUV-001 and 002A independent signoff, exact-SHA hosted CI, real IAM/managed index status, publication transaction design, business/content-owner approvals, backup/recovery and customer acceptance remain open. Keep `LUMA_INSTITUTION_PREFLIGHT_ENABLED` unset and do not publish clients, GRUV registrations, payments or course data.

The next engineering node is **GRUV-002C** (proposal only): design an authority-backed publication decision and rollback protocol that revalidates drafts/programs atomically and remains disabled until all upstream release gates are closed.
