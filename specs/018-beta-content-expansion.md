# SPEC 018 — Beta Content Expansion

## Goal

Add source-grounded content for the first-user beta without turning LUMA into a module-by-module LMS.

## Source scope

### Practitioner · Módulo 2 — Comunicación Emocional

Source ID: 166Ucwvs8pilTOwGkrp5wRQ3lvpS4Z5l-

Included concepts:
- verbal, non-verbal and paraverbal communication;
- congruence;
- calibration as observation before interpretation;
- synchronization / rapport;
- listening and asking as communication skills.

Excluded from learner-facing beta content:
- percentage claims about verbal/non-verbal communication;
- prenatal or psychogenealogy causal claims;
- therapeutic or health assertions;
- unsupported causal claims about birth and later behavior.

### Practitioner · Módulo 3 — Redescubriendo y transformando tu poder

Source ID: 1OwHgWtDXC_AzkU31f6a7tuoHWHl0gv5V

Included concepts:
- thought → emotion → action → objective;
- P.A.S.;
- logical levels;
- beliefs as interpretive filters;
- values and identity.

## Product structure

The coachee browses experiences / capabilities, not modules:

1. Congruencia: tres canales, un mensaje
2. Calibración: observar antes de interpretar
3. Rapport: crear sintonía con respeto
4. P.A.S.: detectar y reformular
5. Niveles lógicos: elegir dónde intervenir
6. Creencias: separar evidencia e interpretación
7. Valores e identidad: alinear lo que importa con cómo actúas

Each experience contains:
- capability;
- why it matters;
- source-grounded idea;
- real-world practice;
- reflection prompt;
- provenance label;
- evidence boundary.

## Evidence boundary

Completing a reflective experience emits PRACTICE_REFLECTION_RECORDED.

This records participation and reflection only. It does not automatically claim mastery or diagnosis.

## Acceptance criteria

1. /learn/experiences renders at least seven source-grounded experiences.
2. Learner navigation points Práctica to the experience catalog.
3. Each experience has a stable dynamic route.
4. Every experience is traceable to a source module internally.
5. Private Drive URLs and IDs do not appear in the learner UI.
6. A reflection can be recorded locally as a learning event.
7. Completion states that reflection is practice evidence, not mastery.
8. The P.A.S. experience links to the existing scored simulation.
9. Excluded Module 2 claims are absent from learner-facing copy.
10. Desktop/mobile, WCAG, themes, build, and production smoke pass.
