# LUMA / GRUV — Operational Engineering Command

This repository is the shared product foundation. Follow
`docs/strategy/luma-gruv-operating-command.md` and the relevant `specs/` before editing code.

## Product hierarchy

- **LUMA Core**: evidence-backed Learning Twin, tutor, knowledge graph, adaptive learning, identity and entitlements.
- **LUMA Platform**: institution-facing SaaS administration, content, programs, billing and governance.
- **Seres de Excelencia**: the existing priority customer experience. Preserve its current brand, content and production journey.
- **GRUV**: a future languages-focused product shell powered by LUMA Core. It is NOT a second core, a deployed tenant or a reason to rename LUMA.

One shared trunk and short-lived, reviewable feature branches. No permanent fork. Do not replace working subsystems merely to increase abstraction.

## Source-informed data-intensive engineering rules

The attached Spanish video transcript summarizes *Designing Data-Intensive Applications*; use these ideas as design principles, not as proof that the full book was reviewed.

1. Make trade-offs explicit: reliability, scalability, maintainability, and cost. Document why each abstraction or storage system is needed.
2. Choose data design from access patterns, consistency and recovery requirements, not from fashionable tools.
3. Expect partial failures, retries, timeouts, duplicate/out-of-order messages and clock differences at remote boundaries.
4. Prefer small, versioned, idempotent domain events for asynchronous side effects. Request/response is fine for short synchronous reads and transactions.
5. Preserve immutable learning evidence and traceable, recomputable Twin projections. Content consumption is not competency mastery.
6. Enforce tenant/program authorization server-side before reads, writes or retrieval. Branding, URL, header, theme and AI prompts never grant access.
7. Never infer production readiness from synthetic tests alone. Measure workloads and verify backup/restore, security, accessibility and real provider paths.

## Agent operating loop

`OBSERVE -> SPEC -> PLAN -> PRODUCER -> CRITIC -> FIXER -> INDEPENDENT VERIFIER -> RELEASE GATE -> EVIDENCE -> NEXT`.

- Inspect `git status`, active branch and source truth first. Preserve existing work and use an isolated worktree when needed.
- Begin from a user outcome and explicit acceptance criteria. Implement the smallest verified increment.
- Critic must challenge authorization, evidence integrity, hidden fallbacks, tenant data leaks, retries, UI regression and operational failure modes.
- Do not merge, deploy, spend, create tenants, activate billing, enable billable APIs or handle customer data without the applicable authorization and release gates.
- Record exact commands, pass/fail, outstanding external gates and an honest release status under `evidence/`.
- GRUV may remain a product template while runtime tenancy and entitlement isolation are independently proven.

## Success criteria

Two independent, authorized institutions can eventually use the same learning engine with different branding and curriculum without exposing each other's data. Until then, call the multi-tenant SaaS flow a target, not a verified production feature.

## Current institutional control-plane increment

- Read `specs/068-institution-draft-control-plane.md` and `docs/enterprise/institution-config-draft-operations.md` before touching tenant onboarding.
- `LUMA_INSTITUTION_DRAFT_ADMIN_ENABLED` defaults off, and must not be set in production without an independent security/release decision.
- Only platform superusers may create institutional drafts. Tenant administrators must have dedicated `adminTenantIds` and revoked-token checks; legacy learner/coach scope claims are insufficient.
- `InstitutionDraft` is NOT the published `InstitutionConfigStore`, so drafts cannot change entitlement, curriculum access, AI provider budget or CEFR certification.
- Firestore emulator tests use an isolated `demo-*` project. The local workstation has a Java 21 runtime under `/opt/luma-jre21`; do not change system Java or production IAM to run tests.
