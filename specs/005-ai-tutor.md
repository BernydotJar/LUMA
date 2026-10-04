# SPEC-005 — Grounded AI Tutor

**Status:** interactive source-backed showcase adapter complete; provider/RAG orchestration specified

## Outcome

Provide a tutor that understands the approved corpus, the current learning context, the learner's goal, and relevant Twin evidence, then chooses a pedagogical move instead of merely producing an answer.

## User value

- The learner can ask in natural language without losing course context.
- Course-grounded answers show their source.
- The tutor can ask a question or propose practice when a direct answer would reduce learning.
- Low-confidence situations can escalate to a human.

## Scope

### Showcase release

- interactive chat panel;
- deterministic routing for Module 3 topics;
- response source, concept, and confidence;
- quick prompts and recoverable network state;
- learner-facing disclaimer about uncertainty;
- API route with structured JSON response.

### Production extension

- hybrid retrieval across approved source segments;
- provider abstraction and model policy;
- structured pedagogical action planner;
- citation/claim validation;
- event proposal authority gate;
- eval and telemetry pipeline;
- optional speech adapter.

## Non-goals

- unrestricted general-purpose chat;
- answering from model memory as if it came from the course;
- directly updating mastery or certification state;
- voice cloning without explicit authorization;
- replacing a human when confidence or safety policy requires escalation.

## Acceptance criteria

1. `/learn` contains an operational tutor, not a decorative input.
2. A question about P.A.S. receives a relevant response.
3. The response includes a visible Module 3 source reference and confidence.
4. The tutor can frame its response as a Socratic question.
5. Empty input is rejected.
6. Network failure produces a recoverable message without losing the question context.
7. The API returns a structured `learningMove`.
8. Product copy warns that LUMA can be wrong and distinguishes inference.
9. Production architecture defines retrieval, grounding, provider, policy, and authority boundaries.
10. E2E validates the visible response and source.

## API contract

```ts
type TutorRequest = {
  tenantId: string;
  learnerId: string;
  goalId: string;
  curriculumVersionId: string;
  message: string;
  sessionContext?: string;
};

type TutorResponse = {
  action: TutorAction;
  answer: string;
  sourceRefs: SourceRef[];
  evidenceRefs: string[];
  confidence: number;
  uncertainty?: string;
  proposedEvents: ProposedLearningEvent[];
  receiptId: string;
};
```

## Grounding requirements

- every proprietary-content claim maps to a retrieved approved source;
- cited ranges exist and support the claim;
- unsupported health/psychology claims are qualified or blocked;
- learner-state claims reference evidence category and IDs;
- source insufficiency produces a clarifying question or escalation;
- prompt and model versions are stored in the receipt.

## Failure behavior

- provider timeout: approved fallback provider or deterministic response;
- no grounded source: say the course evidence is insufficient;
- invalid structured output: reject, retry within budget, then fallback;
- unsafe or prohibited inference: block and record policy finding;
- repeated learner confusion: recommend human intervention with context pack.

## Evaluation

- source faithfulness;
- citation accuracy;
- pedagogical action quality;
- unsafe inference rate;
- unsupported-claim rate;
- schema compliance;
- tenant-boundary enforcement;
- appropriate escalation;
- learner usefulness feedback.

## Evidence

- `architecture/ai-orchestration.md`
- `src/app/api/tutor/route.ts`
- `src/components/tutor-panel.tsx`
- `e2e/showcase.spec.ts`
- `evidence/verification/e2e.log`
