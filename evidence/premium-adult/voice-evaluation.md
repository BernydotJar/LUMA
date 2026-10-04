# Voice Modality Evaluation — Connector Check

## Environment check

The current ChatGPT plugin directory was searched for an ElevenLabs / text-to-speech connector.

Result:
- no ElevenLabs connector was available in the returned plugin set;
- Runway is connected and supports spoken voiceover generation;
- HeyGen is available but not installed.

## Product decision

No provider is selected in this increment.

The product contract remains provider-neutral because provider choice should follow a pedagogically necessary voice prototype.

## Prototype candidate

Recommended first experiment:

**Communication practice — spoken response under mild interpersonal pressure**

The learner:
1. hears a short scenario;
2. responds aloud;
3. receives a transcript;
4. separates event / thought / emotion;
5. records a second response;
6. the system stores the observable speaking artifact and learning event.

The system must not infer mental health, personality, protected traits, deception, or medical state from voice.

## Gate to implementation

A provider integration should proceed only after:
- Latin American Spanish quality review;
- latency test;
- interruption / streaming review;
- data-retention review;
- consent and deletion UX;
- cost estimate;
- text-only fallback;
- coach evidence usefulness test.
