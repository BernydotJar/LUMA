# LUMA Learning Intelligence — LUMA-070 / LUMA-071 acceptance dossier

**Source baseline:** `feat/platzi-learning-ui-map-20261020` at `935aeb77dfcbbb73eb108b1291f9d88b13fe7fc9`

**Implemented in:** `feat/learning-assessment-context-20261020`

**Graph Harness decision:** implementation evidence ready; graph nodes stay **RUNNING** until an independent critic can pass the gate required to enter REVIEW. **Not** production or release accepted.

## Product scenarios and evidence

| Requirement | Code and route | Verification | Boundary |
| --- | --- | --- | --- |
| New participant can discover an assessment without extra navigation | `ProgramEntryAssessment` on `/learn` | Playwright desktop/mobile | Before onboarding, shows first step |
| Answers guide first action, not mastery | `program-assessment.ts`, persisted learner projection | Unit, route, emulator | `observed`, `twinAuthority: none` |
| Answer key and grading are server-owned | `/api/learning/entry-assessment` | 12 logic/API tests | Client only receives choice IDs/labels |
| Diagnosis survives reload and remains program-specific | scoped Firestore learner record and append-only ledger | Firestore Emulator | Tenant+program entitlement checked on write |
| Concurrent retries cannot double-submit | Firestore transaction cooldown + event ID idempotency | Emulator concurrent transactions | 60-second window; same event ID returns prior outcome |
| Scored simulation supersedes provisional route | `persistent-learning.ts` | Unit tests | Normal evidence-derived next action resumes |
| Class-aware LUMA receives an explicit class step | `TutorPanel`, `/learn/experience/[slug]` | Browser and route tests | Frontend submits only `classSlug` and a step hint |
| Client cannot spoof other learners or approved sources | `learning-context.ts`, `/api/tutor` | Unit, policy, route tests | Server builds context from scoped Twin and class contract |
| Contextual RAG may only cite authorized program and class sources | `scoped-rag` + verified source IDs | Route tests with mocked RAG | Backend service must separately attest isolation |
| Class tutor is not a large empty block | `data-context=class` Liquid Glass panel | Playwright density assertion and screenshots | Initial desktop panel height <=430 px |
| Existing learning journeys stay functional | Existing adaptive loop + Class Intelligence | Desktop/mobile browser regression | No production deployment implied |

## Reproducible verification artifacts

- `evidence/learning-ui/verify-070-071.log`: lint, TypeScript, 334 passing unit/contract tests (other emulator suites skipped when not configured), production webpack build.
- `evidence/learning-ui/build-070-071.log`: successful production build after compact tutor changes.
- `evidence/learning-ui/playwright-070-071.log`: **20 passed** across desktop Chromium and mobile Chromium, including the previously existing adaptive loop and class intelligence specs.
- `evidence/learning-ui/firestore-070-071.log`: **6 passed** against the real Firestore Emulator, including two new assessment tests and four existing store tests.
- `evidence/learning-ui/assessment-guest-*.png` and `tutor-class-*.png`: test-run screenshots.

## Independent review / release blockers

1. **Independent critic not assigned**. A producer running tests cannot approve its own `independent-review` gate. Keep both Graph Harness nodes in `running`, not `review` or `done`, because this graph requires an independent-review PASS before the transition to REVIEW.
2. **Authenticated UAT not yet performed through a real test account**. Unit/API and Firestore Emulator tests establish behavior, but do not prove the complete browser flow with a real Firebase session, active commerce entitlement, current profile and program content.
3. **Live scoped RAG not exercised**. A production-like backend with verified tenant/program isolation and source provenance is required for LUMA-071.
4. **Program configuration is presently the SE Practitioner curriculum**. Additional tenants need program-specific versioned class/assessment registration rather than assuming the five SE example classes belong to every offering.
5. **Learning step context is initially `overview` on the class route**. Step-aware contracts are supported on the API, but live step tracking and contextual remediation UI are part of LUMA-073.
6. **No merge, CI release approval, signed acceptance evidence, or Firebase deployment** from this branch has been authorized/performed here.
7. **Privacy and retention policy** for entry answers and education records still requires institutional approval.

## Next dependencies

- Reviewer inspects source, entitlement revocation, Firestore transaction, source boundary, keyboard/mobile and the screenshots.
- Conduct authenticated and authorized browser UAT with a real enrollment and scoped RAG.
- When independent review PASS is independently evidenced, transition LUMA-070 and LUMA-071 to REVIEW and then DONE.
- Then start LUMA-072 reusable simulation runtime; LUMA-073 class journey, LUMA-074 system map, and LUMA-075 cohort intelligence remain separate acceptance surfaces.

**Principle:** Simplify navigation, not capability. E2E PASS is not a production acceptance certificate.
