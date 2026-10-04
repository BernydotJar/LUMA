# SPEC 009 — Learner Experience UI v2

## Product outcome

Make LUMA feel like a learning product that already understands what the learner should do next, not an AI dashboard that explains its own architecture.

The learner must experience the consequences of the Learning Twin before being asked to inspect the Twin itself.

## Product hierarchy

1. One dominant question: what should I do now?
2. One dominant action: continue the best next learning action.
3. One concise reason the route changed.
4. Journey and tutor remain visible but secondary.
5. Twin analytics, sources, confidence, and internal intelligence use progressive disclosure.

## Visual direction

The learner surface uses:

- optimistic 1970s futurism;
- Swiss information hierarchy;
- warm analog education;
- restrained liquid glass;
- warm off-white and cream;
- deep brown and burgundy;
- burnt orange;
- mustard;
- muted avocado;
- oversized editorial typography;
- geometric orbital forms;
- subtle grain.

It must avoid:

- generic dark AI SaaS;
- LMS course catalogs;
- dense dashboards;
- decorative glass on every surface;
- disco nostalgia.

Reference principles:
- Scrolltide Mariana: depth, cinematic layering, motion-led composition.
- Scrolltide UI library: product surfaces that feel authored rather than generated.
- samyost1/3dicon: looping transparent 3D accents as optional semantic decoration, not navigation or information architecture.

## UX laws applied

### Hick's Law

The main action card has one dominant CTA. Source inspection and recommendation reasoning are secondary disclosures.

### Fitts's Law

The primary action is large, high contrast, and reachable. Mobile navigation uses persistent bottom placement.

### Von Restorff effect

The current recommendation is the visual anchor. Secondary analytics are quieter.

### Miller's Law

The learner home avoids exposing full Twin dimensions or many metrics at once. It summarizes three signals and one decision.

### Jakob's Law

Navigation, profile controls, tutor composer, progress steps, and buttons retain familiar interaction patterns even though the visual language is distinctive.

### Gestalt proximity and common region

Goal, evidence, decision, and next action are grouped into coherent regions. Technical provenance is not mixed into primary action copy.

### Progressive disclosure

"Why did my route change?" reveals observed fact, inference, next signal, and source only when requested.

## Surfaces in this increment

### /

Redirects immediately to /learn for product-showcase mode.

### /learn

- editorial learner home;
- "today" framing;
- goal context;
- one adaptive next action;
- Learning Pulse;
- three-step proof of adaptation;
- Journey;
- embedded contextual tutor.

### /onboarding

- same visual language as learner home;
- goal-first setup;
- diagnostic;
- time calibration;
- initial Twin explanation.

### /learn/session/pas

- warm intelligent learning workspace;
- practice-first task;
- contextual source;
- visible Twin evidence criteria;
- no conventional video-player layout.

## Learning Pulse

A lightweight visual representation of current learning state.

It is intentionally not a full dashboard.

The first implementation uses CSS depth/orbits and three signals:

- knowledge;
- application;
- confidence.

The generated 3D icon pipeline is a controlled future enhancement. A generated icon must never carry information that is unavailable in accessible text.

## Acceptance criteria

1. Root enters the learner product immediately.
2. Learner home has a single dominant CTA.
3. The current recommendation visibly explains why another lesson was skipped.
4. Recommendation explanation is available through progressive disclosure.
5. Learner can ask LUMA without leaving the home.
6. Onboarding, learner home, and practice session share one visual system.
7. Mobile and desktop have zero horizontal overflow.
8. Mobile and desktop have zero clipped text.
9. Automated WCAG A/AA checks pass.
10. Tutor high-stakes claim blocking still passes.
11. Learning-event receipt still passes.
12. Production build passes.
13. UI references are documented and do not create runtime dependencies on external design resources.

## Non-goals

- redesign instructor Studio in this increment;
- generate paid external 3D assets;
- replace deterministic learner-state logic;
- add voice before the core visual journey is accepted;
- add monetized niche micro-apps before the flagship learning experience is coherent.
