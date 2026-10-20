# LUMA — Independent operational baseline

**Environment/date:** `https://luma.lch-app.cloud`, anonymous GET and headless Chromium read-only, initially 2026-10-19 UTC; **rechecked 2026-10-20 15:26 UTC**. Source candidate `878bca15fad3cafb6f9e4e2d4058bf5855835dd2` (PR #67); **published** revision `6ddcae8ff2464782b7e4001c4cd5d60092dbb099`, release run `38096269154` (October 10). Not the same code. Evidence: `evidence/product-acceptance-2026-10-19/{published-version,public-ui-readonly,operational-readiness}.json`.

## Independent observations

| Route | GET/DOM | What was actually demonstrated | What was **NOT** demonstrated |
|---|---|---|---|
| `/learn` | 200, learning home visible | Learner-facing navigation and practice affordances | Persistent, cohort-scoped learner evidence, completed feedback, coach read-back |
| `/studio` | 200, sign-in prompt for learner access | Studio shell renders for guest | Coach roster, intervention or authorized real learner evidence |
| `/studio/programs` | 200 | Program page and navigation render | Multi-course editing, assignment, live sessions, authoring and publish actions behind an approved role |
| `/studio/enrollments` | 200 | Enrollment page and navigation render | Creating/revoking real enrollment and read-back; anonymous viewing is not admission authority |
| `/academia/solicitud` | 404 | Route absent | Institutional applicant path not published |
| `/plataforma/solicitudes` | 404 | Route absent | Platform approval inbox not published |
| `/academia/primer-curso` | 404 | Route absent | First course/cohort wizard not published |
| `/api/academic/offerings/invalid/curriculum-draft` | 404 | Endpoint absent for this route | In-progress course authoring API **not** published; 404 alone does not validate correct authorized offer behavior |

All observations are **anonymous read-only**. No buttons that write data were clicked and no production learner or customer identities were accessed. Guest-only UI cannot establish whether protected authenticated actions work; they remain unverified. HTTP 200 says only the route answered, not that customer operations work. Some existing LUMA experiences are source-coded static teaching material; no tenant-authorized curriculum authoring/publication was demonstrated. The independent curriculum API under development in a separate isolated branch has passed *six synthetic tests* but still has no authoring UI and is not counted as a completed product module.

## Operational readiness by required business module

| Module | Source references present | Required operations | Product verdict |
|---|---:|---:|---|
| Institution onboarding | 4 of 4 | 4 | BLOCKED: production 404, new branch unmerged |
| Multi-course catalog & cohort operations | 3 of 3 | 3 | BLOCKED: authorized UI actions, volume and variants unverified |
| Academic authoring and publication | 5 of 5 *candidate references only* | 5 | BLOCKED: no durable published curriculum version/independent approval flow |
| Enrollment and entitlement | 2 of 2 | 2 | BLOCKED: role-to-learner active entitlement journey unverified |
| Learning, questions and coach follow-up | 5 of 5 | 5 | BLOCKED: end-to-end offering evidence, restoration and interventions unverified |
| Support tickets | 0 of 2 | 2 | BLOCKED: no matching in-app source/UI surface found |
| Follow-up automation | 0 of 2 | 2 | BLOCKED: no matching in-app configuration, execution and audit surface found |
| Reporting & certificates | 2 of 2 *candidate references only* | 2 | BLOCKED: real cohort reporting, eligibility and signature evidence unverified |
| Lifecycle & privacy | 2 of 2 | 2 | BLOCKED: live revocation, retention authorization and deletion UAT unverified |

**Totals:** 9/9 modules BLOCKED; 27/27 required actions NOT YET independently approved; 5/5 full business journeys BLOCKED. This is **not** a statement that all code is defective or that every feature is absent. It is the result of a strict evidence standard for a customer go-live. Basic app render and green CI jobs retain their narrower PASS status without conferring product approval.

## P0 decisions and remediation order

1. **P0:** Align exact release source and production version, and verify authorized institutional onboarding with a permitted staging QA tenant. Do **not** deploy PR #67 automatically.
2. **P0:** Complete the academic authoring UI, content rights/versioning, different approver and actual published learner route; do not treat `programOfferings.status=active` as academic content approval. Related #57.
3. **P0:** Make cohort/offering ID immutable provenance across evidence, coaching, read-back, reassignments and archived cohorts. Related #63.
4. **P0 for this customer hypothesis:** Confirm requirements with the enterprise agrochemical representative, including role types, multi-course volume, mandatory training, ticket ownership, automations and reporting. Do not invent a real tenant or safety compliance claims.
5. **P1:** Implement and validate in-app support ticket lifecycle, course-linked follow-up workflows with delivery/opt-out, real reporting, staged QA dashboards and guided UX. A button that sends a request without status/history is not sufficient.
6. **P1:** Manual accessibility with keyboard, screen readers, physical mobile devices, performance baseline and release/privacy signoffs.

Release gate **NO-GO / BLOCKED**. This report is intentionally published alongside source inventory and policy. Human customer acceptance still has to be obtained.

## 2026-10-20 verification update

Anonymous read-only `curl` and isolated headless Chromium independently rechecked `/api/version` and all public routes. The exact production SHA remains `6ddcae8ff2464782b7e4001c4cd5d60092dbb099`. Guest-visible `/studio` and `/learn` do not prove an authorized enterprise workflow. Institutional request, operator inbox and first-course setup remain **404**. The public inventory includes observed UTC timestamps and route/visible-action lists; no customer account, permission or record was modified.

The operational gate additionally requires **protected Ed25519 reviewer attestations** and a pin of the mandatory-action catalog. There are no credible current signed customer-acceptance receipts, so the release verdict remains **BLOCKED** even though its own tests pass.
