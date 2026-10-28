# SPEC-072 — LUMA Twin Intelligence P0: Human-led learning pilot

**Product:** LUMA Twin Intelligence — *Personalized learning. Human-led.*
**Status:** P0 source implementation; no real student rollout or production activation authorized
**Graph:** LUMA-TWIN-INTELLIGENCE-P0-20261027
**Scope:** one program, one explicitly authorized instructor, consenting enrolled learners, two isolated study arms.

## Product thesis

LUMA Core provides an evidence-first Learner Twin and a versioned, teacher-approved **Teaching Twin**, connected by a bounded pedagogical decision engine. The objective is to improve **demonstrated capability**, not to maximize chatbot responses or replace instructors.

The Teaching Twin is a curriculum/method/rubric configuration with explicit authorization and provenance. It is **not** an identity, personality, psychological, or voice clone of the teacher.

The product offering is B2B SaaS / licensed institution deployment; LUMA Core can eventually serve other shells through stable APIs/SDKs. Current work does **not** enable general multi-tenancy or customer onboarding.

### Existing foundations reused

- Persistent Learner Twin: authenticated Firebase ID token, Firestore event ledger, deterministic next action.
- Tutor: source-grounded RAG contract, policy control, source trust boundaries.
- Coach access: verified role claims, program-scoped enrollment and tenant claims.
- Scoped RAG: configured strict backend; production deployment and source approval remain separate requirements.
- Graph Harness: verifiable evidence and no autonomous approval of production changes.

## P0 deliverables (source only)

1. **Teaching Twin**: teacher-authored methodology, approved source identifiers, instructional strategies, rubric/version and human escalation policy. An explicit designated teacher approves a revision; published revision never changes because a draft changes.
2. **Learner-to-Teaching orchestration**: read-only endpoint joins server-owned Learner Twin state with an approved method, returns structured proposed action, source provenance status and human escalation flag. **No model invocation and no mastery mutation**.
3. **Human intervention ledger**: idempotent, tenant/program-specific, only for an actively enrolled learner and backed by an existing verified learning event; completion requires a distinct later verified event. Role revocation or enrollment revocation blocks further reads/actions.
4. **Evaluation engine**: paired baseline/post/retention, full assignment denominator, rubric/phase/cross-tenant consistency, human follow-up metrics and actual billable + infrastructure + teacher cost components.
5. **Fail-closed rollout**: disabled unless *all* pilot feature flags and server-verified academic enrollment context match. No UI injection into the existing SE learner journey.
6. **Adversarial tests and Graph Harness ledger**: observable evidence of what passed, what failed, and what remains externally blocked.

## Authorized pilot protocol (proposed, not yet executed)

**Program:** P.A.S., within an independently authorized Seres de Excelencia cohort or an equivalent approved training program.
**Instructor:** one designated educator with independently provisioned, revocable Firebase coach role and tenant membership.
**Learners:** target 20 consenting adult participants, allocated 10/10 to Twin-assisted and standard-support arms. Both groups retain access to the same qualified instructor and all normal human help.

**Do not create actual students, enroll them, issue tokens, enable billable inference, change published content, or deploy without authorization and a privacy review.** The protocol remains illustrative until curriculum owners, the institution and the participants approve it.

### Study sequence

| Stage | Both arms | Twin-assisted arm | Standard-support arm |
| --- | --- | --- | --- |
| Pre-register | Objective, approved rubric, twin version, observation window and inclusion criteria | Same | Same |
| Baseline (day 0) | Equivalent form A, blind independent scoring, anchored rubric | Same | Same |
| Practice (days 1-10) | Same approved course and teacher access | Teacher-approved Twin next action and contextual practice | Existing LUMA standard journey and teacher access |
| Human contact | Intervention when needed, same service levels | Evidence-linked suggestions, teacher decides | Teacher monitors and responds without automated Twin recommendations |
| Post-test (days 11-14) | Equivalent form B, identical criteria, independent scorer | Same | Same |
| Retention (days 21-28) | Novel transfer example, same rubric dimensions | Same | Same |
| Evaluation | Analyst computes metrics without changing historical observations | Descriptive gains | Descriptive gains |

Assignment must be recorded before results are available, balanced transparently, with exclusions/withdrawals and attrition disclosed. This small pilot **cannot establish statistical or causal superiority**. Expansion requires sample-size design, bias analysis and additional study. Never withhold needed human support.

## Preregistered measurable gates

### G1 — Educational gain

- **Population:** all initially assigned participants, not only post-test completers.
- **Pair:** independent criterion-based baseline and post evidence for the **same learner**, rubric ID/version and comparable form difficulty.
- **Primary estimand:** mean (post - baseline) in Twin-assisted minus mean (post - baseline) in standard support.
- **Exploratory target:** >= 0.10 (10 percentage points) differential; at least 10 paired learners per arm for the *actual* pilot, >=80% paired completion. Software tests permit smaller fixtures only to exercise logic.
- **Report:** mean change per group, differential, assigned N, paired N, attrition, uncertainty, ceiling effects and retention. No use of synthetic values as measured benefits.

### G2 — Effective human interventions

- Interventions opened only from real existing event IDs, linked to the authorized learner and educator.
- Teacher response within 24 h for >=80% of opened interventions.
- >=80% documented follow-up from a **different, later** learning event.
- >=80% with retained/improved verified criterion score among followed cases, reported descriptively.
- “Effective” means process + observed follow-up support, **not proof** that the intervention caused improvement.
- Escalation must never be triggered solely by a model assertion or psychological inference.

### G3 — Tenant/program isolation

- No unauthorized reads or writes for tenant B, program B, another teacher, another learner, stale/revoked enrollment.
- Source isolation enforced before RAG retrieval, not only in the response.
- At least two authorized test institutions with a real Firestore emulator and scoped RAG integration; falsified identity/client headers tested.
- **Zero** confirmed cross-tenant or cross-program disclosures.
- Firestore deployment rules and live IAM must be independently verified before pilot activation.

### G4 — Evidence integrity

- Each rubric result has an event ID, teacher-approved rubric version, criterion results, timestamp and independent assessor.
- 100% of learner-state changes trace to accepted events; instruction/answer text never directly changes mastery.
- Duplicate, cross-scope, unassigned, changed-arm, out-of-order, unscored and fabricated references fail closed.
- A coach can propose observations; final academic/certification decisions require authorized review.
- Retrieval results must undergo real source-rights and citation validation before generative text is enabled.

### G5 — Sustainable unit economics

- Total = provider **billed** usage + allocated infrastructure + teacher minutes × validated fully loaded hourly rate.
- Primary denominator: active/assigned learner count; also report cost per completed learner and marginal inference cost.
- **Illustrative pilot ceiling:** USD 5 per active learner for the observation window, to be approved with the program owner after a cost baseline. This is not a contractual price.
- Separate BYOK provider fees, self-hosted power/GPU, engineering effort and human educator time.
- Missing invoice or staff-time data is **PENDING**, not zero cost. Require usage/limit telemetry, p50/p95 latency and explicit budgets before providers are enabled.

## Human authority and privacy

| Decision | LUMA can | Human remains accountable |
| --- | --- | --- |
| Explain approved material | Retrieve and propose | Approve instructional content and source rights |
| Suggested practice | Recommend within bounded rules | Override and adapt based on context |
| Concern signal | Flag uncertainty with evidence | Interpret, contact and decide support |
| Learning mastery | Record verified events through existing authority | Set/approve assessment policy and exceptional outcomes |
| Teaching methodology | Store drafts and immutable approval receipts | Select, approve and revoke methodology |
| Certification | No autonomous authority | Final authorized decision |
| Institution data | Only server-authorized tenant/program scope | Consent, retention, governance and legal basis |

No model training on private learner data without explicit lawful authorization. No children in the pilot without a separate minor-protection review; no health diagnosis, employment decisions, personality profiling, behavioral surveillance or unconsented speech cloning. Learner export/correction/erasure must be verified under institutional policies before real rollout.

## Implementation contracts

- `GET /api/twin-intelligence/teaching-twin`: teacher-scoped draft and approved versions.
- `PUT /api/twin-intelligence/teaching-twin`: CAS `expectedRevision`, new DRAFT.
- `POST /api/twin-intelligence/teaching-twin`: explicit teacher `approve`, immutable approval receipt.
- `GET /api/twin-intelligence/next-action`: enrolled learner, own state only, latest approved teacher method, structured proposal, no writes.
- `GET/POST/PUT /api/twin-intelligence/interventions`: teacher-scoped list/open/close with verified learner event links.
- `src/lib/twin-intelligence/pilot-evaluation.ts`: pure analysis calculator; only validated source bundles may be classified `verified_pilot` by an independent evaluator.

### Server-side feature gates

```text
LUMA_LEARNING_ACCESS_MODE=entitled
LUMA_LEARNING_TENANT_ID=<authorized pilot tenant>
LUMA_LEARNING_PROGRAM_ID=<authorized program>
LUMA_TWIN_PILOT_ENABLED=true
LUMA_TWIN_PILOT_TENANT_ID=<same verified tenant>
LUMA_TWIN_PILOT_PROGRAM_ID=<same verified program>
LUMA_TWIN_PILOT_TEACHER_UID=<designated verified teacher uid>
```

The actual default is **disabled**; no values were added to `apphosting.yaml`. The teacher must also hold the appropriate verified `coach` role and exact tenant assignment. An ordinary coach from another tenant cannot impersonate the teacher.

## Model strategy

Gemma 4 local, DeepSeek BYOK and Vertex AI remain optional model-provider adapters from the previous architecture assessment. **P0 is deterministic by design.** No inference API, secret, cost or export of learner data is turned on here. Later integration requires explicit provider selection, data-minimization, bounded context, strict no-cloud-fallback, real citation checks and independent semantic evaluation.

## Release decision

- **Current:** source-only pilot implementation, real UAT **NOT STARTED**.
- **Engineering tests:** source-focused tests are useful but not a product-release signature.
- **Pilot exit candidate:** requires all five gates to be verified with real authorized evidence plus independent reviewer receipt; even this is **not** a production deployment authorization.
- **Production GO:** additionally requires live role/entitlement UAT, Firebase emulator and real security controls, privacy/consent review, end-to-end Playwright, accessibility, load/latency/cost evidence, rollback/runbook, signed SHA and separately authorized release gate.

Graph Harness terminal state remains **PARTIAL_WITH_DOCUMENTED_BLOCKERS** until the external prerequisites can be met.
