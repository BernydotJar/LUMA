# LUMA — Platzi-informed Learning UI Gap Map

Date: 2026-10-20
Status: product baseline for Graph Harness LUMA-069–076

## Principle

LUMA should preserve a small primary navigation while making its deeper intelligence visible at the moment it is useful. The goal is progressive disclosure, not a return to an LMS dashboard with dozens of competing actions.

## What LUMA already has

### Participant
- `/login` — Google identity and preferred display name.
- `/onboarding` — goal/profile setup.
- `/learn` — adaptive home, next-best action, progress/evidence, live schedule, tutor.
- `/learn/experiences` — seven-module program + digital practices.
- `/learn/experience/[slug]` — objective, micro-diagnostic, key idea, practice, reflection.
- `/learn/session/pas` — criterion-based scored simulation.
- `/classroom/[offeringId]/[sessionId]` — integrated live classroom.
- `/learn/certificates` — learner certificates.

### Coach / trainer
- `/studio` — intervention priorities and operational coaching signals.
- `/studio/learners/[learnerId]` — authoritative persistent Learning Twin and append-only evidence.
- `/studio/class-intelligence` — objectives, evidence contracts and class-quality observability.
- `/studio/programs` — programs, cohorts and live sessions.
- `/studio/enrollments` — institutional enrollment.
- `/studio/certificates` — certificate operations.
- `/library` — content intelligence and grounded search.
- `/studio/reflections` — knowledge reflection and reviewed content updates.
- live-class roster/moderation inside the classroom.

### Internal / superuser / design
- `/experience` — role/theme experience control.
- `/iconography` and `/preview/liquid-light` — design-system/showcase surfaces, not learner navigation.

## What is already aligned with Platzi / current AI-EdTech patterns

- Pre-class micro-diagnostics already choose a useful entry route.
- Learning progress is evidence-based rather than completion-only.
- P.A.S. already has a scored simulation with rubric/criterion receipts.
- Tutor/RAG already preserves source provenance and tenant/program scope.
- Coach sees intervention signals and an authoritative Learning Twin.
- Internal knowledge can create reviewed class refresh candidates instead of silently mutating production content.
- Live classes are integrated into the same program identity and entitlement model.
- Content Intelligence already gives grounded source search rather than a generic chatbot.

## Where LUMA is still weaker than the product thesis

### 1. Program-level assessment is missing
Current diagnostic is per experience. The learner still has to choose an experience before LUMA can diagnose that capability.

Target: a short program-level capability assessment that maps the learner to the most useful starting experiences.

### 2. The tutor is grounded but not fully class-aware
The tutor sends recent conversation context and uses scoped RAG, but the client does not yet send an explicit learning envelope containing current class, objective, capability, recommended next action and relevant Learning Twin state.

Target: class-aware Answers-style context without exposing internal architecture to the learner.

### 3. Simulation is still too concentrated in P.A.S.
The evidence runtime is strong, but the most mature scored simulation is P.A.S.

Target: a scenario runtime reusable by rapport, congruence, communication, sales/leadership-style roleplays and future programs.

### 4. The class page is still structurally a page
The current experience screen stacks diagnostic, key idea, practice and reflection. The underlying class graph is richer than the UX communicates.

Target: an adult class runtime that progressively reveals objective → diagnostic → learning move → practice → evidence → remediation → transfer → recheck.

### 5. Organizational memory exists as parts, not as one visible system
Today source intelligence, class intelligence, learner evidence, interventions and reflections exist in separate surfaces.

Target for coach/superuser: a Learning System Map showing the causal operating chain:
Source → Class → Session/Practice → Evidence → Learning Twin → Intervention → Reflection → Reviewed Class Update.

This is the LUMA-native version of an "organizational cortex". It is not a learner surface.

### 6. Peer/cohort learning is not yet a first-class product decision
Platzi makes community central. LUMA is a high-ticket coaching product with live sessions and trainer intervention, so copying an open community chat would be a product mistake.

Target: evaluate smaller cohort patterns—peer practice, accountability pairs, post-session reflection, trainer-approved discussion—before implementing a community product.

## Recommended information architecture

### Participant primary navigation
1. Hoy
2. Ruta
3. Programa
4. LUMA
5. Más → Certificados / profile / secondary utilities

Keep this small.

### Participant contextual surfaces
- Next best action
- Upcoming live session
- Progress/evidence story
- Program-level starting assessment
- Active class runtime
- Practice/simulation
- Contextual LUMA assistant
- Deferred recheck

These should appear when relevant; they do not all need permanent navigation items.

### Coach primary navigation
1. Estudio
2. Participantes
3. Programas y clases
4. Inteligencia de aprendizaje
5. Más → Matrículas / Certificaciones / Contenido / Actualizaciones

### Coach intelligence sub-surfaces
- Intervention queue
- Learner Twin
- Class Intelligence
- Learning System Map / Organizational Learning
- Content Intelligence
- Content Reflection / update review
- Cohort/session performance

### Superuser / buyer
- Organization / program health
- capability coverage
- evidence quality
- trainer intervention load
- class effectiveness
- content freshness
- source → learning → outcome map

Do not show Graph Harness, model routing, prompt versions or internal pipeline terminology unless the user is an internal operator.

## Product rule

Simplify navigation, not capability.

The learner should feel:
- "LUMA knows where I am."
- "I know what to do next."
- "I practice something real."
- "My progress changes because I demonstrated something."

The coach should feel:
- "I can see what is happening."
- "I know why LUMA is recommending this."
- "I know where to intervene."
- "I can see whether the class itself is working."

The buyer/superuser should feel:
- "Knowledge becomes measurable learning and the system retains what the organization learns."
