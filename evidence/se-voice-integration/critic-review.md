# Critic review — LUMA × SE Voice functional integration

## Scope discipline

The requested closure scope was intentionally narrow: one server-side bridge, one visible learner integration, no new public LUMA endpoint.

## Findings

### C1 — Browser must not call SE Voice or Firebase Storage directly
PASS. The learner UI calls a Next.js Server Action. The Voice API URL and Firebase Storage topology remain server-side.

### C2 — Learner reflection/private history must not be sent to voice
PASS. The client invokes `synthesizeReflectionGuide(experience.reflectionPrompt)`. The learner-entered `response` state is never passed to the voice action.

### C3 — Voice outage must not block learning
PASS. The action returns a bounded failure result; UI shows a text-only fallback message and leaves the written prompt usable.

### C4 — Unauthorized voice must not silently substitute
PASS. The bridge delegates authorization to SE Voice. HTTP 409 becomes `not_authorized`; there is no alternate cloned voice fallback. Current default remains the approved technical `example_public` voice until an authorized SE voice is configured.

### C5 — Server Action payload size
BOUND. Audio is returned as a data URL for a short reflection prompt, capped at 5 MiB and a 45-second voice timeout. This is acceptable for the fixed pilot interaction and avoids creating a new public streaming endpoint, which was explicitly out of scope.

### C6 — Hosted production reachability
DOCUMENTED BOUNDARY. The current verified integration is colocated in the Cloud Sandbox using `SE_VOICE_API_URL=http://127.0.0.1:8097`. The Firebase App Hosting deployment would require a reachable authenticated Voice API URL before this audio feature can be enabled there. This deployment/network exposure is intentionally not opened as a new workstream in this closure.

## Critic conclusion

PASS for the fixed integration scope. No unresolved implementation defect remains. Do not broaden the graph into public voice-service deployment as part of this closure.
