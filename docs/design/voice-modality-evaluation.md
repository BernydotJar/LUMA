# Voice as a Learning Modality — Evaluation

## Decision

Voice is valuable when speaking, listening, prosody, recall, or interpersonal response is part of the learning objective.

Voice is not a decorative narration layer.

## High-value voice use cases

### Communication practice

The learner responds aloud to a realistic interpersonal situation.

Evidence:
- content;
- structure;
- timing;
- hesitation;
- self-correction;
- optionally prosody, if policy and evidence quality justify it.

### Emotional-language practice

The learner practices naming an emotion, separating event from interpretation, and reformulating a response.

The system must not infer medical or psychological state from voice.

### Socratic coaching

LUMA asks one short question at a time and adapts from the learner's response.

### Retrieval practice

The learner explains a concept aloud without looking at the material.

### Human-session preparation

The learner records a concise reflection or example for a coach context pack.

## Low-value uses

Do not add voice merely to:
- read screen text;
- narrate navigation;
- create a premium-sounding assistant;
- replace text where text is faster;
- simulate intimacy as a product gimmick.

## Provider evaluation

The current ChatGPT plugin directory in this environment does not expose an ElevenLabs connector.

Provider integration should therefore remain abstract.

Evaluation criteria:
- Latin American Spanish quality;
- controllable pacing;
- pronunciation of P.A.S. and course terminology;
- latency;
- interruption support;
- streaming;
- per-minute cost;
- data retention;
- consent;
- export/delete controls;
- commercial usage terms.

A connected provider such as Runway can be used for prototyping voice output, but the product contract should remain provider-neutral.

## Architecture contract

Voice input/output must sit behind a provider adapter:

```
Learning Move
  -> modality decision
  -> voice adapter
  -> transcript / audio
  -> learning evidence policy
```

The voice provider never owns learner-state updates.

## Safety / evidence boundary

Voice may generate:
- transcript;
- response event;
- practice completion;
- observable speaking artifact.

Voice should not silently infer:
- mental health;
- personality;
- protected traits;
- emotional diagnosis;
- deception;
- medical condition.

## Next implementation gate

Prototype one communication practice where voice is pedagogically necessary.

Success means:
- learner completes a realistic spoken task faster or more effectively than with text alone;
- coach evidence is more useful;
- latency is acceptable;
- transcript and audio controls are understandable;
- the experience still works in text-only mode.
