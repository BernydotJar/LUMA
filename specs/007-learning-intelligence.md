# SPEC-007 — Learning Intelligence Studio

**Status:** client-showcase implementation complete; cohort aggregation and production data services are extensions

## Outcome

Give instructors and program owners evidence about whether the curriculum is producing learning, which concepts are blocking progress, which interventions work, and who requires human support.

## User value

- Instructors see concept and competency gaps rather than only activity.
- Repeated questions and misconceptions identify weak curriculum sections.
- Human intervention is routed with context.
- Quality scores are decomposed and inspectable.

## Scope

- verified learning progress metric;
- active learners, median mastery, human-intervention count, and quality score;
- concept bottlenecks with affected-learner share;
- explainable LUMA insight panel;
- intervention-effect comparison;
- repeated-question signal;
- decomposed quality score;
- human-intervention queue with assign action;
- context-pack product contract.

## Non-goals

- replacing institutional BI or gradebooks;
- ranking learners for punitive purposes;
- exposing raw private Twin data to all instructors;
- treating correlation as causal intervention evidence;
- using views/watch time as the north-star metric.

## Acceptance criteria

1. `/studio` answers “Is the course teaching?” above the fold.
2. Verified learning progress is visually primary.
3. The dashboard identifies at least four concept bottlenecks.
4. Selecting a bottleneck changes the evidence-backed interpretation.
5. Intervention-effect copy includes sample size and avoids causal certainty.
6. Quality score displays component values.
7. A repeated learner question is visible as curriculum feedback.
8. Human-intervention rows include signal, confidence, recommendation, and assignment.
9. Assignment control changes state visibly and passes E2E.
10. Desktop/mobile layout, browser error, and accessibility checks pass.

## Metrics

### North star

```text
Verified Learning Progress = change in demonstrated competency / effective learning time
```

### Supporting

- time to mastery;
- delayed retention;
- transfer success;
- goal achievement;
- intervention success;
- recommendation acceptance;
- human-escalation latency;
- curriculum quality components.

### Guardrails

- learner satisfaction;
- cohort dropout;
- tutor grounding error;
- unsafe inference rate;
- privacy incidents;
- differential outcome review where lawful and appropriately governed.

## Aggregation contract

```ts
type CohortLearningSignal = {
  tenantId: string;
  cohortId: string;
  curriculumVersionId: string;
  period: { from: string; to: string };
  metricId: string;
  value: number;
  denominator: number;
  confidence?: number;
  privacyThreshold: number;
  computationVersion: string;
  generatedAt: string;
};
```

No cohort insight is shown below an approved minimum group size. Purpose-limited individual context remains in the intervention workflow.

## Intervention context pack

- learner goal and requested support;
- affected concept/competency;
- relevant observed and self-reported evidence;
- explicitly labeled inference;
- attempts and intervention history;
- source segment or assessment item;
- uncertainty and recommended human question;
- consent and data-purpose boundary.

## Failure behavior

- data freshness below SLA: show timestamp and stale state;
- group below privacy threshold: suppress or aggregate;
- insufficient intervention sample: label result exploratory;
- conflicting data sources: block metric and open data-quality finding;
- assignment service unavailable: keep row unassigned and expose retry;
- curriculum version mismatch: separate cohorts rather than blending metrics.

## Verification

- E2E assigns a learner to intervention;
- selected bottleneck updates visible evidence;
- quality components sum to a transparent presentation score policy;
- no private detail is required for aggregate dashboard rendering;
- axe scan passes;
- visual audit reports zero horizontal overflow and zero clipped text.

## Evidence

- `src/components/studio-dashboard.tsx`
- `src/components/studio-dashboard.module.css`
- `docs/learning-model.md`
- `docs/research/competitive-pain-matrix.md`
- `evidence/verification/e2e.log`
- `evidence/verification/a11y.log`
