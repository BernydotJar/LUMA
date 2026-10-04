# SPEC-004 — Goal and Diagnostic Onboarding

**Status:** showcase implementation complete

## Outcome

Create an initial Learning Twin from a learner goal, one discriminating diagnostic task, confidence calibration, and available-time context—without forcing a learner to start at lesson one.

## User value

- The learner begins from a capability target, not a course menu.
- Prior knowledge and context influence the first action.
- LUMA avoids wasting time on known material.
- The learner sees that the initial Twin is a revisable hypothesis.

## Scope

- four-step onboarding;
- capability-goal selection;
- diagnostic item tied to Module 3 concepts;
- confidence self-report;
- session-time preference;
- initial action summary;
- persisted showcase state in local storage;
- production event contract and projection rules.

## Non-goals

- full psychometric placement test;
- diagnosing mental health or personality;
- using confidence as a proxy for ability;
- hiding the option to recalibrate later;
- automatically certifying a learner out of content from one item.

## Acceptance criteria

1. `/onboarding` opens with a capability question, not a profile form.
2. A learner can select a goal and receives visual confirmation.
3. The diagnostic cannot continue until an answer is selected.
4. Confidence is captured separately from correctness.
5. Available time changes the recommendation explanation.
6. The final summary names goal, diagnostic signal, confidence, time, and first action.
7. Completing onboarding persists a structured state and routes to `/learn`.
8. The copy states that the Twin is a revisable first hypothesis.
9. The learner can bypass with a clearly labeled showcase profile.
10. Desktop/mobile E2E and accessibility checks pass.

## Diagnostic item contract

```ts
type DiagnosticItem = {
  itemId: string;
  curriculumVersionId: string;
  conceptIds: string[];
  competencyIds: string[];
  prompt: string;
  responseType: "single_select" | "multi_select" | "free_response" | "simulation";
  scoringPolicyVersion: string;
  misconceptionMap: Record<string, string[]>;
  sourceRefs: SourceRef[];
  validityStatus: "draft" | "reviewed" | "approved";
};
```

## Initial evidence

- goal choice: `SELF_REPORTED`;
- available time: `SELF_REPORTED`;
- confidence: `SELF_REPORTED`;
- diagnostic answer: `OBSERVED` event;
- initial mastery state: `INFERRED`, with limited confidence due to sparse evidence.

## Failure behavior

- diagnostic content unavailable: allow goal/context capture and schedule diagnostic as first action;
- persistence unavailable: show an explicit retry state and never claim completion;
- item invalidated by curriculum update: preserve historical event, select a valid replacement;
- contradictory prior evidence: lower placement confidence and ask a second discriminating item.

## Verification

- E2E completes onboarding on desktop and mobile;
- local storage contains goal `beliefs` in the golden path;
- visual layout has no horizontal overflow or clipped text;
- axe A/AA scan passes;
- learner home renders the selected capability framing.

## Evidence

- `src/components/onboarding-experience.tsx`
- `src/components/onboarding-experience.module.css`
- `e2e/showcase.spec.ts`
- `evidence/verification/e2e.log`
- `evidence/verification/a11y.log`
