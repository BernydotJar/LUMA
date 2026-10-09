# LUMA Product Completion — Development Gate

**Objective:** finish LUMA as an operational AI-native learning product, not a disposable demo. This document is an evidence-oriented living inventory, not a statement that the product is live.

| Product journey | Code baseline | Remaining production acceptance |
|---|---|---|
| Account / profile / onboarding | Firebase Auth and learner onboarding | Real enterprise role provisioning, verified identity and recovery |
| Enrollment / entitlements | Hotmart + Stripe signed webhooks, entitlement ledger, institutional admissions added | Real merchant sandbox purchase+refund+replay, invitation identity E2E, Stripe Checkout optional |
| Learner pathway / practice / persistent Twin | Scoped Firestore learner record, events, evidence, practice UI | Restore drill and real multi-tenant journey under program selection |
| Tutor grounded in SE content | Scoped RAG gateway/tenant filtering, policy fallback | Approved SE corpus indexed with legal rights; real backend and quality evals |
| Coach operations | Learner and intervention views, source provenance | Full roster not just bounded sampling, admin assignment, measurable follow-up |
| Live classroom | LiveKit integration, admission, attendance, moderator controls | LiveKit account/credentials, network/volume soak, accessibility and recording policy acceptance |
| Certificates | Institutional Stirling X.509 and optional DocuSign, verifiable PDF | Approved CA certificate, Docker/GCP private service, signature validation test, license and legal review |
| Mobile UX | Learner primary navigation with all destinations accessible via More | Playwright Chromium/mobile, VoiceOver/TalkBack, actual devices |
| Support and operation | CI, GitHub audit, health endpoints | Incident owner, email notification integration, backup/restore, monitoring, RTO/RPO, rate limiting |
| FinOps/compliance | Capacity and security design | Measured usage, signed customer terms, retention/privacy review |

## Engineering policy

Work **incrementally on main** through reviewed PRs. Do not replace existing abstractions. Each change must have a user journey, backend permissions, transactional/persistence proof, CI build, browser checks and evidence. Report source implementation independently from production activation and legal approval.

## Current workstream

- Resolve PR #20 browser regression where the mobile navigation hides LUMA when certificates were added; keep a discoverable path to credentials and every trainer tab.
- Add institutional cohort admissions without fake commerce events, with admin tenant scope, reason, expiry, email claim, revocation and immutable audit.
- Update CI emulator coverage and index management.
- Fix source-level regressions and leave production external-provider gates explicit.

### Adversarial security review (current product increment)

The certificate endpoints were found to accept an unrestricted administrative role; this could cross tenant boundaries. The fix introduces explicit tenant authorization for issuer configuration, revocation, coach completion, issuance, certificate status, and the coach's cohort list. A tenant admin without the correct claim fails closed; `superuser` remains explicitly global. **Full authorization regression and CI results must be captured before merge.**
