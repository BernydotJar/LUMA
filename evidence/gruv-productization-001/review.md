# LUMA-GRUV-001 — Source-level execution and release evidence

**Branch:** `feat/gruv-productization-001` from `origin/main` at `7daba30` (2026-10-10).
**Worktree:** `/workspace/projects/LUMA-gruv-productization`, isolated from the pre-existing dirty `/workspace/projects/LUMA` checkout.
**Overall release state:** `REVIEW_REQUIRED`; no merge or deployment authorized by this document.

## OBSERVE

- Existing LUMA `main` contained SE branded UI, PNL sample learning content, program-scoped Twin/entitlement logic and guarded Firebase release workflows.
- Existing checkout held uncommitted tutor/RAG work. Created a separate worktree without modifying those files.
- The attached product strategy specifies one core, institutional SaaS and future language vertical. The attached Spanish transcript summarizes DDIA ideas; no claim of full-book review.

## PLAN / SPEC

- `AGENTS.md` and `docs/strategy/luma-gruv-operating-command.md` define the operating command and product invariants.
- `specs/067-gruv-productization-institution-contract.md` defines AC-01..AC-08.
- `architecture/luma-gruv-product-line.md` records shared-monolith vs fork/microservice trade-offs.
- `graph-harness.gruv.project.json` is a separate valid `SHIP` graph for the product line, not a replacement for LUMA's existing release graph.

## EXECUTE

- Introduced a public brand contract holding Seres' existing name, logo and palette, plus a separate conceptual GRUV identity.
- Added template and versioned institution configuration contracts without deploying a tenant backend.
- Added fail-closed authorized-scope configuration lookup with tenant/program consistency checks; this is a lookup *after* authentication and entitlement, not a substitute.
- Updated existing SE branding consumers to read the identical attributes from the shared public brand contract. No customer-facing route, tenant mode or payment setting changed.

## VERIFY — observed local results

| Check | Result | Detail |
| --- | --- | --- |
| Graph CLI `validate` | PASS | valid `graph-harness.project.v1` + empty event ledger |
| Targeted Vitest | PASS | 12/12 (themes and new institution cases) |
| All Vitest unit suites | PASS | 300 executed, 52 skipped (including emulator-dependent suites) |
| TypeScript | PASS | `tsc --noEmit --incremental false` |
| ESLint | PASS | `npm run lint` |
| Webpack production build | PASS | `NODE_OPTIONS=--max-old-space-size=3072 npm run build` |
| Chromium production-browser E2E | PASS | 21 passed, 1 skipped; showcase and glass/theme checks |
| Mobile production-browser E2E | PASS | 21 passed, 1 skipped; showcase and glass/theme checks |
| Existing checkout preservation | PASS | original modified worktree untouched |

Tests ran with a symlink to dependencies from the contemporaneous LUMA CI/CD checkout, whose package lock exactly matched the tested `origin/main`; no new dependencies were installed. This is local evidence, not GitHub CI attestation.

## CRITIC / PRODUCT LIMITS

- `resolveInstitutionForAuthorizedScope()` accepts a *previously authorized* scope; its caller must enforce Firebase identity, membership, entitlement and active program. It is not deployed in an HTTP route and does not itself prove authorization.
- Brand and product-shell metadata are not tenant authority. GRUV templates do not enable a product, grant access, assert CEFR certification or activate billable services.
- The present pilot is configured around one server-resolved tenant. Multi-tenant SaaS administration is a later, security-gated workstream. Scoped RAG production attestation and backup/recovery/load proof remain external blockers.
- Some SE course and live-classroom copy still lives in the application; it is intentionally out of scope for the first compatibility slice.
- Browser test skips and emulator test skips must not be reported as coverage success. Independent manual visual review, real authentication/emulator gates, CI and actual release-signoff remain outstanding.

## NEXT DECISION

The next executable product increment is GRUV-002: a **trusted server-side institution control plane** with an authorized tenant resolver, versioned config persistence, audits, explicit release gates and cross-tenant security tests. Do not expose a public tenant switcher or deploy a GRUV domain until that control plane is proven.
