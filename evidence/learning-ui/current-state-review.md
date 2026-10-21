# LUMA Learning UI — Current-State Independent Review

## Decision

PASS_TO_NEXT_GRAPH

## Current-state finding

LUMA already implements most of the underlying learning-intelligence capabilities associated with current adaptive/AI-native learning products, but the product story is fragmented across routes.

The simplification of learner navigation is beneficial: the primary participant navigation is small and role-appropriate. The remaining problem is not missing navigation items; it is that some capabilities are not yet connected into a coherent class/runtime experience.

## Verified current surfaces

### Participant
- `/login`
- `/onboarding`
- `/learn`
- `/learn/experiences`
- `/learn/experience/[slug]`
- `/learn/session/pas`
- `/classroom/[offeringId]/[sessionId]`
- `/learn/certificates`

### Coach / institutional
- `/studio`
- `/studio/learners/[learnerId]`
- `/studio/class-intelligence`
- `/studio/programs`
- `/studio/enrollments`
- `/studio/certificates`
- `/library`
- `/studio/reflections`

## Capabilities already present

- adaptive next-best action;
- persistent authoritative Learning Twin;
- append-only evidence ledger;
- per-experience micro-diagnostics;
- evidence-authority separation;
- criterion-based scored P.A.S. simulation;
- coach intervention queue;
- content-intelligence search;
- reviewed knowledge reflection;
- source-grounded class refresh candidates;
- live-program schedule and integrated classroom;
- Google authentication and institutional enrollment.

## Gaps worth addressing

1. Program-level capability assessment before a learner chooses an experience.
2. Explicit class/objective/Twin context envelope for the learner assistant.
3. Reusable scenario/simulation runtime beyond P.A.S.
4. A unified class runtime instead of a page that vertically stacks diagnostic, idea, practice and reflection.
5. One coach/superuser Learning System Map connecting source → class → evidence → Twin → intervention → reflection → reviewed update.
6. Evidence-based evaluation of cohort/peer learning rather than copying open community/chat mechanics.

## UX conclusion

Do not grow the primary navigation again.

Use progressive disclosure:
- small role-specific navigation;
- strong next-best action;
- context-specific class controls;
- secondary intelligence surfaces for coach/admin only.

The target is to simplify navigation without simplifying the learning system.
