# SPEC-006 — Best Next Learning Action

**Status:** deterministic engine and explainable UI complete

## Outcome

After meaningful interactions, rank candidate learning actions and present one primary recommendation that is useful, time-compatible, prerequisite-aware, and explainable.

## User value

- The learner does not have to navigate a course catalog to decide what to do.
- Known material can be skipped.
- Repeated failure causes remediation rather than blind advancement.
- A recommendation explains the evidence and what would change it.

## Scope

- deterministic candidate-action scoring;
- mastery gap and confidence gap;
- repeated-failure signal;
- completion/mastery mismatch;
- learner time fit;
- action-kind fit;
- prerequisite penalty;
- ranked alternatives;
- learner-facing reason and confidence;
- visible source link;
- guided-practice action for the Module 3 golden learner.

## Non-goals

- optimizing time on platform;
- engagement manipulation or streak pressure;
- black-box ranking without score components;
- recommending inaccessible or unapproved content;
- using payment value as a learning priority signal.

## Acceptance criteria

1. The learner home presents one dominant next action.
2. The action includes duration, recommendation confidence, and source.
3. “Why this?” opens evidence, inference, and route-change conditions.
4. A learner with mastery ≥ 0.82 prefers advance over repeat.
5. A learner with at least two consecutive failures prefers remediation over advance.
6. Completing content while mastery is weak prefers transfer practice over more passive content.
7. An action that fits available time outranks an otherwise equivalent long action.
8. Unmet prerequisites penalize downstream actions.
9. Unit tests cover the four golden conditions.
10. The selected action opens a functioning learning experience.

## Scoring model

The showcase implementation is intentionally transparent:

```text
score =
  mastery_gap * 3.10
  + confidence_gap * 1.25
  + failure_signal * 2.35
  + completion_mastery_mismatch * 1.90
  + time_fit * 1.10
  + action_kind_fit * 1.20
  - unmet_prerequisite_count * 0.45
```

Weights are policy version `showcase-v1`; they are product hypotheses, not universal learning constants.

## Decision receipt

```ts
type RecommendationReceipt = {
  recommendationId: string;
  learnerId: string;
  goalId: string;
  curriculumVersionId: string;
  twinProjectionVersion: number;
  candidateActionIds: string[];
  selectedActionId: string;
  scoreComponents: Record<string, number>;
  reason: string;
  confidence: number;
  policyVersion: string;
  generatedAt: string;
};
```

## Failure behavior

- no valid candidate: recommend human help or curriculum-owner review;
- projection stale: show last recommendation with stale label or wait for required evidence;
- source unavailable: choose another approved object or block action;
- time constraint impossible: ask learner to revise available time or split the object;
- tied scores: prefer lower learner burden, stronger evidence, and more reversible action;
- confidence below policy threshold: expose uncertainty and use a diagnostic action.

## Verification

- `src/lib/learning-engine.test.ts` validates advance, remediation, completion/mastery mismatch, and time fit;
- E2E opens and explains the selected recommendation;
- practice flow records a learning event;
- TypeScript types prevent an action without source, duration, target mastery, or prerequisites;
- recommendation reason is rendered in learner language.

## Evidence

- `src/lib/learning-engine.ts`
- `src/lib/learning-engine.test.ts`
- `src/components/next-action-card.tsx`
- `src/components/practice-session.tsx`
- `evidence/verification/unit-tests.log`
- `evidence/verification/e2e.log`
