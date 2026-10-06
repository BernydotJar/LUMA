# LUMA × SE Voice functional integration — closure spec

## Goal

Close the remaining functional integration gap between LUMA and the already-released SE Voice Engine v0.5 without introducing any new public LUMA API endpoint.

## Fixed scope

1. Add one server-side LUMA adapter that calls the existing SE Voice `POST /v1/speech` contract.
2. Add one visible learner-facing integration: play the existing reflection prompt as audio from the learning experience page.
3. Keep learner-entered reflection text out of the voice request.
4. Preserve all existing LUMA public `/api/*` endpoints unchanged.
5. Verify locally against the real SE Voice Engine on `127.0.0.1:8097`.
6. Close the integration graph. No additional features are in scope.

## Runtime configuration

- `SE_VOICE_API_URL` defaults to `http://127.0.0.1:8097` for the colocated sandbox pilot.
- `SE_VOICE_DEFAULT_VOICE` defaults to `example_public` until an authorized SE voice is approved.
- `SE_VOICE_ENGINE` defaults to `openvoice_v2`.

## Safety/contract requirements

- Server-side only call to SE Voice API.
- No Firebase Storage URLs exposed to the browser.
- No learner response/history sent to the voice service.
- Voice service errors degrade to text-only UX.
- Mary remains unusable until the existing consent/reference gate is satisfied.
- No new LUMA route handler under `src/app/api`.

## Acceptance criteria

- Reflection page exposes an `Escuchar guía` control.
- Clicking it invokes the server action, receives audio, and plays it.
- Existing LUMA endpoints remain unchanged.
- Typecheck, lint/tests/build pass for the changed surface.
- Browser verification shows the reflection page, control, successful audio invocation, and no Next.js error overlay.
- Graph release gate passes and reaches DONE.
