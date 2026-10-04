# SPEC-002 — Explainable Learner Twin

**Status:** showcase implementation complete; server projection and persistence are production extensions

## Outcome

Give each learner a persistent, human-readable view of current capability that separates observed evidence, self-reported context, and inference.

## User value

- The learner can understand what LUMA believes and why.
- Uncertainty is visible instead of hidden behind a score.
- The learner can correct and export the Twin.
- Instructors receive only purpose-limited context.

## Scope

- six learner-facing dimensions: knowledge, application, communication, confidence, consistency, retention;
- evidence category and confidence on every claim;
- selected-dimension evidence inspection;
- correction flow that records self-reported evidence;
- JSON export in the showcase;
- trajectory simulation explicitly labeled as prediction;
- privacy and prohibited-inference copy.

## Non-goals

- personality typing;
- medical or psychological diagnosis;
- protected-characteristic inference;
- using the Twin for pricing pressure or manipulative sales;
- presenting a projection as certification evidence without policy review.

## Acceptance criteria

1. `/twin` exposes all six dimensions with status and score.
2. Selecting a dimension changes the visible evidence.
3. Evidence can be filtered by observed, inferred, and self-reported.
4. Every visible inference includes confidence and source language.
5. The learner can register a correction without deleting historical evidence.
6. Export downloads a structured representation of learner-visible state.
7. Prediction copy distinguishes forecast from observed evidence.
8. Privacy rules are visible inside the product.
9. Automated accessibility checks pass.
10. No horizontal overflow or clipped text occurs at desktop or 390 px mobile width.

## Event inputs

```text
GOAL_DEFINED
DIAGNOSTIC_ANSWERED
CONFIDENCE_REPORTED
CONTENT_EXPOSED
PRACTICE_ATTEMPTED
SIMULATION_COMPLETED
ASSESSMENT_COMPLETED
LEARNER_CORRECTION_RECORDED
INSTRUCTOR_INTERVENTION_RECORDED
RETENTION_CHECK_COMPLETED
```

## Projection rules

- an event can create observed evidence only when the event schema and task validity permit it;
- self-reported confidence remains distinct from measured performance;
- inferred evidence must reference source evidence IDs and a policy/model version;
- duplicate event idempotency keys cannot update the projection twice;
- conflicting evidence lowers confidence and can trigger a diagnostic;
- content completion alone does not update mastery;
- corrections alter the projection path while preserving audit history.

## Failure behavior

- projection delayed: show last generated version and a pending-update state;
- evidence unavailable: do not render an unsupported score explanation;
- export failure: retain state and offer retry;
- correction service unavailable: preserve draft locally and do not claim it was registered;
- prohibited inference: reject and record policy finding.

## Security and privacy

- every Twin read is scoped to tenant and authorized learner/instructor purpose;
- instructors do not receive unrelated learner context;
- export and deletion are audited;
- provider prompts include only purpose-limited context;
- retention policy varies by evidence category;
- production projection is rebuildable from an append-only event ledger.

## Verification

- E2E loads `/twin` in desktop and mobile projects;
- axe WCAG A/AA scan passes;
- visual-layout audit shows zero page overflow and zero clipped text;
- architecture review confirms evidence categories, correction, deletion, and projection semantics.

## Evidence

- `architecture/digital-twin.md`
- `docs/learning-model.md`
- `src/components/twin-detail.tsx`
- `src/lib/luma-data.ts`
- `evidence/verification/e2e.log`
- `evidence/verification/a11y.log`
