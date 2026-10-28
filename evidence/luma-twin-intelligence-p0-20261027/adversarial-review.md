# Adversarial review — LUMA Twin Intelligence P0

**Review type:** internal adversarial code and product review (NOT independent external attestation)
**Scope:** `src/lib/twin-intelligence/`, `src/app/api/twin-intelligence/`, SPEC-072
**Verdict:** source increment ready for independent verification; **NO-GO for live pilot and production**.

## Attempt to disprove the product claim

| Finding | Severity | Attack / failure | Observed defense | Remaining gate |
| --- | --- | --- | --- | --- |
| TI-P0-01 | Critical | Different coach/tenant asks for an approved methodology or another learner's intervention | Named verified instructor UID, exact tenant/program claims and active enrollment checks; hashed per-scope persistence | Emulator tests against real Auth/Firestore and two tenants |
| TI-P0-02 | Critical | Instructor types an unapproved or legally restricted source ID and model hallucinates from it | Schema is bounded; decision declares source IDs **teacher-declared, not retrieval-verified**; no generative call in P0 | Source-rights registry + approved RAG citation validator before LLM |
| TI-P0-03 | Critical | Chatbot recommendation silently changes learner mastery | Next-action endpoint is GET/read-only; returns `masteryMutationAuthorized:false` | End-to-end trace into persistent Twin projection |
| TI-P0-04 | High | Student/teacher revocation arrives after initial access checks | ID-token revocation check and active entitlement checks in API; list filters revoked enrollments | Staging race tests, revoked tokens, atomic protected reads where required |
| TI-P0-05 | High | Duplicate or stale intervention hides prior teacher decision | Idempotency key, bounded event linkage, revision check and append history | Real Firestore concurrent transaction test and unique index verification |
| TI-P0-06 | High | Attractive mock scores imply proven teaching improvement | Synthetic/emulator bundles always yield PENDING_REAL_PILOT; evaluator counts assigned dropouts, rubric/phase checks | Actual consented pre/post/retention, independent blind scorer |
| TI-P0-07 | High | Outcomes improve because only completers are analyzed | Fixed assignment denominator, paired completion threshold, changed-arm rejection | Sample allocation, dropout/bias reporting and protocol pre-registration |
| TI-P0-08 | High | Inference cost is declared zero without invoices, ignoring staff | Billing must be verified and infrastructure + teacher time included | Real reconciliation and agreed cost ceiling |
| TI-P0-09 | High | Simulated teacher voice/persona replaces educator | Teaching Twin is pedagogical methodology; teacher controls approval and intervention; no identity cloning | Educator UX acceptance and explicit content/voice rights |
| TI-P0-10 | Medium | Rule-based inference mistakes an onboarding prediction for observed failure | Only actual attempts can trigger low-confidence escalation; no mastery mutation | QA across complex/uncertain concepts beyond P.A.S. |
| TI-P0-11 | Medium | Coach UI falsely declares complete intervention without later student evidence | Completion requires distinct later verified learner event | Real UI/Playwright workflow and assessor validation |
| TI-P0-12 | High | Shared memory pressure makes a passing source suite look like a build | Focused TypeScript/lint/test and broad unit regressions are separate evidence | Full project typecheck, production build on resourced executor |
| TI-P0-13 | High | A bundle self-labels `verified_pilot` and becomes a false GO candidate | Result label is **only** `PILOT_EXIT_CANDIDATE`; never production GO | Independent identity-verified evaluation ingestion/signature (NOT YET IMPLEMENTED) |

## Fixes made during this iteration

- Protected next-action from reading an approved Teaching Twin belonging to an earlier designated instructor.
- Moved teacher authorization context into one authenticated read rather than re-verifying the same token 20 times per list call.
- Added documented assignment denominator instead of counting only participants with observed results.
- Added later-event validation for completed human interventions; scope checks remain server-owned.
- Added bounded request-body parsing and explicit feature-off default.
- Repaired Firestore event typing found by targeted TypeScript.

## Residual architecture risks

- Teaching Twin sources are teacher-declared metadata, not proof of authorized/approved corpus ingestion.
- The RAG service's strict-scoped production deployment and exact source-rights filtering remain separately gated.
- No persistent trusted pilot assignment registry, independently attested rubric scoring API, provider billing ingest or signed evaluation pipeline exists in this increment.
- Model providers are deliberately **not** wired; the deterministic engine establishes safe data/authority contracts first.
- Pilot learner/coach UX integration is not yet end-to-end. Source API tests use mocks for Auth and Firestore, not production services.
- The teacher can approve their own pedagogical method as content owner; independent product/security review is **separate**, not replaced by their approval.
- Small single-instructor / two-arm pilot is exploratory; non-random self-selection, expectancy effects and contamination remain threats to causal interpretation.
- Privacy retention/deletion, authorized data sharing and consent must be attested before real learners are onboarded.

## Independent verifier checklist

The independent reviewer must verify exact final SHA, privileged access claims, ID-token revocation, Firestore emulator isolation (two test institutions), source rights, real user flow, accessibility, denial-of-service bounds, performance, comparison design, receipts and rollback. No independent sign-off was obtained in this interaction.

**Release recommendation:** `PARTIAL_WITH_DOCUMENTED_BLOCKERS`. Keep feature flag unset and do not merge/deploy based only on the source tests.
