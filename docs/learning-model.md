# Learning Model

## Principle

LUMA measures evidence of capability, not content consumption. Watching a complete video can be useful evidence of exposure; it is never sufficient evidence of mastery.

## Core entities

### Learner

Identity and account boundary. Protected characteristics are not inferred.

### Goal

A learner-defined capability or outcome with target date, context, and success evidence.

### Competency

A demonstrable capability that can combine knowledge, application, communication, confidence, consistency, and retention.

### Concept

A unit of meaning in the curriculum graph. Concepts can require other concepts and can be taught, practiced, demonstrated, or assessed by different learning objects.

### Learning object

A source-backed segment, explanation, worked example, exercise, simulation, assessment, or human interaction.

### Learning event

An immutable record of a meaningful interaction. Events update projections of the Twin; they do not mutate historical evidence.

### Learning Twin

A current, explainable projection of learner state generated from evidence and bounded inference rules.

## Evidence categories

| Category | Meaning | Example |
|---|---|---|
| Observed | System-verifiable interaction or result | Correctly distinguished event from interpretation in a new scenario |
| Self-reported | Context explicitly provided by the learner | Confidence 2/5; 12 minutes available |
| Inferred | A hypothesis derived from other evidence | Concept is recognized but not yet fluent under pressure |

Inference records require confidence, provenance, model/rule version, and a correction path.

## Twin dimensions used in the showcase

- **Knowledge** — conceptual understanding and retrieval;
- **Application** — transfer to a novel or contextual scenario;
- **Communication** — ability to explain in the learner's own words;
- **Confidence** — self-reported calibration against observed performance;
- **Consistency** — useful learning rhythm, not streak manipulation;
- **Retention** — delayed retrieval rather than same-session recall.

Each dimension exposes supporting evidence and uncertainty. Dimensions are not personality traits.

## Mastery update rules

A production implementation should use versioned Bayesian or evidence-weighted updates. The showcase uses deterministic, auditable rules so expected behavior can be tested.

Example rule:

```text
IF concept consecutive_failures >= 2
THEN prefer review/practice/simulation over continue
AND surface human escalation when confidence is low or failures continue
```

Additional invariants:

1. `completion != mastery`;
2. strong prior mastery permits skip or acceleration;
3. unmet prerequisites penalize downstream actions;
4. learner time constrains recommendations;
5. a single fast answer is insufficient evidence of mastery;
6. conflicting evidence reduces confidence rather than silently choosing one source;
7. observed evidence outweighs inference, but never erases self-reported context;
8. human correction becomes evidence, not an untraceable overwrite.

## Best Next Learning Action

Candidate actions:

- continue;
- skip known material;
- review a prerequisite;
- watch an exact segment;
- answer a diagnostic question;
- perform guided practice;
- run a simulation;
- ask the tutor;
- join a human session;
- demonstrate a competency;
- take an assessment.

The deterministic ranking in `src/lib/learning-engine.ts` combines:

- mastery gap;
- confidence gap;
- consecutive failure signal;
- completion/mastery mismatch;
- time fit;
- action-kind fit;
- prerequisite penalty.

Every ranked action returns a reason and recommendation confidence.

## Tutor decision model

The tutor selects a learning move, not just text:

```text
EXPLAIN | ASK | SOCRATIC_QUESTION | SHOW_EXAMPLE |
RECOMMEND_SEGMENT | GENERATE_PRACTICE | RUN_SIMULATION |
ASSESS | REMEDIATE | REVIEW | ADVANCE | ESCALATE
```

Grounded answers include source, concept, and confidence. A production tutor must return a structured decision and citations before natural-language rendering.

## Human escalation

Escalate when one or more conditions persist:

- repeated failure after remediation;
- reported confidence collapse;
- assessment contradicts behavioral evidence;
- repeated expressions of confusion;
- learner asks for an expert;
- system confidence is below policy threshold;
- content safety or unsupported-claim policy is triggered.

The instructor receives a context pack containing the goal, relevant evidence, attempts, interventions, learner language, and explicit uncertainty. It excludes unrelated Twin data.

## Golden learner scenarios

| Scenario | Expected behavior |
|---|---|
| Learner already demonstrates concepts 1–5 | Do not force lessons 1–5; offer test-out or advance |
| Learner fails concept 3 repeatedly | Do not blindly advance to concept 4; remediate or escalate |
| Learner watches an entire class but fails transfer task | Record exposure, not mastery |
| Learner reports low confidence but performs well | Preserve both signals; test calibration before concluding |
| Prerequisite evidence is weak | Prefer prerequisite action over downstream simulation |
| Learner has 8 minutes | Recommend a useful 8-minute action, not a two-hour class |

The first four are executable unit or E2E scenarios in the showcase release.
