# LUMA — 12-PR consolidation / release hold (2026-10-19)

**Scope:** #39, #43, #45, #50, #51, #53, #60, #62, #65, #66, #67, #70. Local-only integration worktree: `/workspace/projects/LUMA-pr-consolidation-20261019` on `audit/luma-pr-consolidation-20261019`, branched from `main` `5c82285251be18c9cf876ae5fd8c307075904029`. The remote PRs and `main` have **not** been modified by this integration. No deployment and no production data changes.

## Dependency graph / intended treatment

| PR | Content | Integration disposition / requirement |
|---|---|---|
| #39 | Mobile CTA, CX acceptance | Parent already included through #43; original isolated browser CI red. |
| #43 | Hydration/DOM stability, accessibility | Parent chain from #39 included; no real authenticated staging sign-off. |
| #45 | Synthetic Hotmart paid learner/coach/refund | Test-only branch included; outdated tenant-only coach assumption updated to explicit offering-assigned RBAC fixture; real Hotmart unverified. |
| #50 | Jeremy/Abigail/Adan baseline; QA-only auth bridge | Include negative evidence as historical findings, not proof of completion. Development-only emulator auth bridge requires dedicated source/security approval before release. |
| #51 | Identity-safe learner and protected course delivery | Reconciled with multicourse picker and server-confirmed UID/program evidence; editorial/licensing/media release gates still NO-GO. |
| #53 | Trusted premerge source attestation, pre-promotion recovery | Added release-readiness to the CI dependency graph; current source lacks independent SHA-bound approval, therefore intentionally BLOCKED. |
| #60 | Independent first-client QA NO-GO baseline | Source QA retained; historical branched Graph event chain preserved separately, not spliced into current append-only chain. |
| #62 | Authorized multicourse learner/coach selection | Ancestor of #65/#66/#67; preserve program-scoped headers and UI choice. |
| #65 | Program-offering assigned coach RBAC | Ancestor of #66/#67; keep strict denial of unassigned same-tenant instructors and partial-cohort access. |
| #66 | Verified academy request intake | Ancestor of #67; self-provisioning forbidden; flags OFF by default. |
| #67 | Two-reviewer institution approval, owner invite and first **draft** course | Integrates stacked #62/#65/#66. First content publication and wider abuse/retention policy still missing. |
| #70 | Bottom Liquid Glass LiveKit dock and acceptance gate | Visual/browser guest checks are not real LiveKit audio/video sessions. Must validate multi-actor provider E2E, deployed SHA and independent product-scope coverage; Graph Harness dependency is separate. |

## Three Git conflicts reconciled as product/security contracts

1. `#51` against stacked `#67`: merged `adaptive-learning-home.tsx`, `practice-session.tsx`, `learning-api-client.ts`. Remote snapshot state is bound to current Firebase UID **and** selected program; no previous user's or previous course's evidence can be rendered/replayed. The server still authorizes every API request.
2. `#60` vs `#67`: forked append-only Graph evidence chains must never be interleaved or edited. Kept the currently valid chain and preserved `#60` source chain and independent QA script in `evidence/first-client-e2e-2026-10-14/branch-*` for independent audit.
3. `#53` vs `#67`: all institutional and coach jobs remain required pre-deploy; release-readiness is an additional blocker, not a substitute. Imported LUMA-069 root Graph node as `ready` **not** `approved`; preserved `#53` historical Graph fork in `evidence/cicd-premerge-guard-069/branch-*`. This aggregate must be independently reattested at the exact final source SHA.

## Evidence recorded from the combined local checkout

| Check | Result / limitation |
|---|---|
| `npm ci` | PASS. |
| TypeScript and ESLint | PASS. |
| Next production build | PASS. |
| Vitest ordinary suite | 388 PASS, 85 configured SKIP. |
| Firestore integration suite in demo Firebase Emulator | 54/54 PASS. |
| Identity/roles/institution publication suite in demo Firebase Emulator | 31/31 PASS. |
| Playwright Chromium desktop/mobile full suite | 154 PASS, 22 configured SKIP, zero failures and no flaky failures. |
| Multicourse/RBAC server customer journey in demo Firebase Emulator | 16/16 PASS. |
| Institution intake customer journey in demo Firebase Emulator | 13/13 PASS. |
| Institutional approval, invite, owner activation, first draft in demo Firebase Emulator | 20/20 PASS. |
| Hotmart simulated purchase > entitlement > practice > assigned coach > refund | First integrated run exposed outdated coach RBAC fixture. Fixed fixture by seeding an explicit active offering, mapping purchase to it and adding unauthorized same-tenant coach check. Rerun 23/23 PASS; never connected to Hotmart or charged a customer. |
| Production dependency audit (`npm audit --omit=dev --audit-level=high`) | PASS, zero vulnerabilities reported at test time. |
| Source-ready Python tests | 7/7 PASS. |
| Graph Harness main chain validation | VALID, 84 unique nodes and 712 source events. Historical Graph forks retained, never falsely joined. |
| Source-bound release readiness | **BLOCKED**, expected: independent source digest approval for this aggregate is missing. |
| Live-classroom product acceptance | **NO_GO**, expected: independent four-axis proof for 18 critical actor actions and production revision missing. |

**Important:** This is technical integration evidence, **not** proof of complete product acceptance. Synthetic emulators, guest browser runs, and CSS fixtures do not prove real institutional operations or that code is deployed.

## Explicit NO-GO and next release gates

- Run authentic learner, academy operator, admin, assigned-coach, and instructor/participant customer journeys **against the same validated staging build**. Verify all actions visible/reachable, not only static screens or APIs; include real identity and session restoration without cross-account leakage.
- Validate actual Hotmart webhook delivery/sale/refund in an authorized provider environment, OAuth session, GCS signed assets/media rights, LiveKit multi-user devices, disconnection, moderation, session closure, attendance, and entitlement revocation.
- Complete institution curriculum publication and rubric/evidence cohort provenance; confirm authorization and retention policy, App Check/WAF, notifications, and institution/client sign-offs before any first-client activation.
- Manually validate accessibility with assistive technology and physical mobile devices, field Core Web Vitals, dark/light/Seres appearances; independent adverse review of source and production attestation.
- Secure independent source review + Graph Harness SHA-bound approval covering **the aggregate changes and all CI/release tooling**. Only after those gates are satisfied and merge-to-main deployment is separately authorized, set GitHub branch protection required checks. Do **not** bypass failing readiness or claim #70 is a Zoom replacement.

The source PRs deliberately remain Draft/NO-GO, and release flags remain disabled. Avoid closing or merging those PRs until a source-bound reviewed integration path is available.
