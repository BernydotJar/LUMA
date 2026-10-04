# SPEC 010 — Coachee / Coach Experience Separation

## Product intent

LUMA has two different jobs:

- for the coachee: make the next useful learning action obvious;
- for the coach: expose the internal learning model, evidence, confidence, provenance, and intervention context.

The coachee experience should communicate progress through plain language and action. Internal constructs such as the Learning Twin, evidence categories, confidence scores, curriculum reflection, and model governance belong in the coach-facing workspace.

## Copy principle

State what the experience is and what the learner is doing.

Prefer:
- "Hoy llevas lo que sabes a la práctica."
- "Tu journey avanza con lo que demuestras."
- "La aplicación es tu foco de hoy."
- "Tu punto de partida está listo."

Avoid defining the experience by negation or contrast:
- "No necesitas otra lección."
- "No sigues módulos."
- "Sin contenido de relleno."
- "La teoría no es el problema."
- "No es un diagnóstico."

Negative language remains only when it is semantically required inside a learning exercise, safety policy, or factual source content.

## Coachee information architecture

### Learner navigation

- Hoy
- Journey
- Práctica
- LUMA

The learner navigation must not expose:
- Learning Twin
- evidence taxonomy
- Curriculum Reflection
- Content Intelligence
- model governance
- internal confidence scores

### Learner home

The learner sees:
- goal context;
- today’s practice;
- qualitative progress signals;
- the next useful action;
- a plain-language explanation of why that action fits;
- the Journey;
- contextual help from LUMA.

The learner does not need raw Twin scores or direct access to the internal Twin.

### Onboarding

Use learner language:
- goal;
- starting point;
- available time;
- profile of learning preferences and demonstrated capability.

Do not frame onboarding as "building the Twin."

### Practice

Use learner language:
- what the exercise strengthens;
- what was demonstrated;
- what comes next.

Do not expose "what the Twin observes."

## Coach information architecture

### Coach Studio

The internal navigation contains:
- Coach Studio
- Learning Twin
- Content Intelligence
- Curriculum Reflection
- Coachee view

### Learning Twin coach view

Route:
- /studio/learners/mariana

The view contains:
- learning-state dimensions;
- observed evidence;
- bounded inferences;
- self-reported signals;
- confidence;
- coach note;
- projection/scenario;
- governance.

The view must be explicitly marked:

"© 2026 LUMA. Learning Twin model & evidence framework. Proprietary coach view."

This marking communicates proprietary product IP. It is a product label, not a legal opinion about the scope of copyright protection.

### Legacy route

/twin redirects to /studio/learners/mariana.

## Visual system

Coachee:
- warm cream;
- deep brown;
- burgundy;
- burnt orange;
- mustard;
- muted avocado;
- editorial typography;
- restrained liquid glass.

Coach:
- same design DNA;
- deeper burgundy / aubergine workspace;
- mustard as intelligence accent;
- avocado as verified-progress accent;
- stronger information density;
- clear proprietary/internal labeling.

The two modes should feel related but unmistakably different in audience and purpose.

## Content Intelligence

The current technical Library becomes coach-facing Content Intelligence.

Positive framing:
- "El contenido se convierte en relaciones."
- "Cada publicación conserva fuente y revisión experta."
- "Los módulos conservan la estructura editorial; el journey se organiza por capacidades y evidencia."

## Acceptance criteria

1. Learner navigation contains no Learning Twin or Content Intelligence entry.
2. Learner home contains no "Learning Twin" wording.
3. Learner home uses positive action-oriented copy.
4. Learning Pulse uses qualitative learner-facing signals rather than raw Twin scores.
5. Onboarding contains no "Learning Twin" wording.
6. Practice contains no "Twin" wording.
7. /twin redirects to the coach Learning Twin route.
8. Coach Learning Twin is available at /studio/learners/mariana.
9. Coach Learning Twin visibly displays the proprietary copyright marking.
10. Coach Studio and Content Intelligence use the updated coach visual system.
11. Existing grounded tutor behavior remains intact.
12. Existing high-stakes claim blocking remains intact.
13. Existing learning-event receipt remains intact.
14. Desktop and mobile have zero horizontal overflow and zero clipped text.
15. Automated WCAG A/AA checks pass.
16. Production build passes.
