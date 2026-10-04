# LUMA Product Thesis

## Product category

LUMA is a **Learning Intelligence Platform**. It is not an LMS with a chatbot attached, a video-course marketplace, or a module browser with AI-generated summaries.

The primary product object is the learner and the state of the learner's capability. Content, commerce, assessments, tutoring, and instructor analytics are supporting systems around that state.

## Core promise

> LUMA knows how you learn, explains what it believes, and helps you take the smallest useful next step toward a real capability.

A learner should be able to answer, within seconds:

1. What am I trying to achieve?
2. What have I demonstrated?
3. Where am I struggling?
4. What should I do next?
5. Why is LUMA recommending it?
6. Which source and evidence support that decision?

## Problem

Conventional LMS products optimize the management of courses. Marketplace products optimize discovery, checkout, and content delivery. Both can be useful, but neither makes demonstrated learner capability the center of the system.

This produces predictable failure modes:

- every learner starts at the same place;
- completion is treated as mastery;
- long-form video consumption is mistaken for learning;
- reporting describes activity rather than understanding;
- instructors see drop-off but not the concept or misconception that caused it;
- AI answers questions without deciding whether a direct answer helps learning;
- learners cannot inspect or correct the inferences made about them.

## Product model

```text
Learner
  -> goal
  -> current capability state
  -> target capability state
  -> learning gap
  -> best next learning action
  -> practice or evidence
  -> assessment
  -> Learning Twin update
  -> next action
```

The course remains available as a secondary curriculum view. It is not the home screen and it does not control the journey.

## Product differentiators

### 1. Persistent, explainable Learning Twin

The Twin separates:

- **Observed** — a result or interaction the platform can verify;
- **Self-reported** — context or confidence the learner chose to provide;
- **Inferred** — a hypothesis with explicit confidence and provenance.

No opaque score is presented as objective truth. A learner can inspect, export, and correct the Twin.

### 2. Best Next Learning Action

Recommendations optimize for learning velocity, mastery, retention, transfer, and goal achievement—not time on platform. Inputs include mastery, prerequisites, misconceptions, confidence, failure patterns, time available, and previous interventions.

### 3. Grounded tutor with pedagogical agency

The tutor can explain, ask, use a Socratic question, find the exact source segment, generate practice, assess, remediate, or recommend human help. It is not required to answer directly when doing so would reduce learning.

### 4. Learning Intelligence for instructors

The instructor view answers: **Is the course actually teaching?** It surfaces concept bottlenecks, repeated misconceptions, interventions that improve the second attempt, cohort competency gaps, and learners who need human context.

### 5. Content Intelligence

Original material remains immutable. LUMA proposes concepts, objectives, segments, exercises, assessments, and graph relationships with provenance. A human approves curriculum changes before publication.

## Showcase release hypothesis

The first product showcase proves that one representative module can become a coherent AI-native journey rather than a linear course:

- onboarding captures a capability goal and context;
- a deterministic diagnostic seeds the Twin;
- the learner receives an evidence-backed next action;
- a guided practice produces a real learning event;
- the Twin exposes evidence, confidence, and correction;
- the tutor returns grounded answers and source links;
- the instructor sees bottlenecks and can assign human intervention;
- the content view exposes the graph and quality model.

## Vertical slice

The representative slice is **Practitioner, Module 3: Redescubriendo y transformando tu poder**. It contains a structured PDF, three long-form classes, and supporting books. The initial product uses the document's concepts and source URL while video transcription remains a controlled ingestion task.

## North star

**Verified Learning Progress**

```text
change in demonstrated competency / effective learning time
```

Supporting metrics:

- time to mastery;
- delayed retention;
- skill transfer to a new scenario;
- goal achievement;
- intervention success;
- recommendation acceptance;
- learning velocity.

Guardrails:

- learner satisfaction;
- tutor grounding error;
- unsafe inference rate;
- dropout;
- privacy violation;
- human escalation latency.

## Commercial model

Learning and commerce are separate bounded contexts. LUMA can support subscriptions, one-time purchases, cohorts, certifications, bundles, enterprise licenses, scholarships, and coupons without allowing checkout architecture to dictate the learning model.

## Later portfolio opportunity

The observation that small niche apps can compound into meaningful recurring revenue is captured as a **later product-studio strategy**, not mixed into the current LUMA scope. LUMA's reusable Learning Twin, content ingestion, grounded tutor, and analytics capabilities can later power focused vertical learning products with simpler positioning and independent monetization.

See `docs/strategy/niche-learning-app-portfolio.md`.

## Surface value vs. product moat

LUMA does not lead client-facing experiences by explaining its internal AI operating model.

### Coachee surface

The person should experience:

- a relevant next action;
- visible progress;
- a journey that adapts;
- contextual help.

### Coach surface

The coach may inspect:

- Learning Twin;
- evidence;
- bounded inference;
- confidence;
- provenance;
- intervention context.

### Buyer surface

The commercial transformation is:

> LUMA convierte conocimiento experto en aprendizaje individualizado y medible.

### Internal moat

The underlying mechanisms can include:

- Learning Twin;
- knowledge graph;
- grounded retrieval;
- curriculum reflection;
- evidence ledger;
- human governance.

These mechanisms support the product promise; they are not the primary headline.

See `docs/product-messaging-boundaries.md` and `docs/design/source-guided-premium-system.md`.
