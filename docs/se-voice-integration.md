# LUMA × SE Voice integration

Status: **closed for the internal colocated pilot**.

## What is integrated

The learner reflection experience now exposes `Escuchar guía`.

Flow:

```text
LUMA learner UI
  -> Next.js Server Action
      -> SE Voice POST /v1/speech
          -> consent/use policy
          -> OpenVoice/CosyVoice backend
          -> Firestore metadata
          -> Firebase Storage durable WAV
      <- audio/wav
  <- browser audio player
```

No new public LUMA route was introduced.

## Privacy boundary

Only the authored `reflectionPrompt` is synthesized. The learner's written reflection is not sent to SE Voice.

## Runtime configuration

The public UI is disabled by default. Enable it only after a reachable hosted Voice API is configured:

```bash
NEXT_PUBLIC_SE_VOICE_ENABLED=true
```


```bash
SE_VOICE_API_URL=http://127.0.0.1:8097
SE_VOICE_DEFAULT_VOICE=example_public
SE_VOICE_ENGINE=openvoice_v2
```

The default voice is the technical public example. Replace it only with a consent-verified SE voice.

## Failure behavior

Voice failure does not block learning. LUMA keeps the text prompt available and shows a non-blocking audio-unavailable message.

## Verified

- 29/29 LUMA tests PASS.
- typecheck PASS.
- lint PASS on integration surface.
- production build PASS.
- real Server Action -> SE Voice -> WAV PASS.
- real browser click -> audio element PASS.
- 0 browser console errors.
- 0 Next.js error overlays.

## Closure boundary

This closure proves and ships the LUMA functional integration in the shared Cloud Sandbox.

The Firebase App Hosting deployment is not pointed at the local workstation Voice API, so `NEXT_PUBLIC_SE_VOICE_ENABLED` must remain unset/false there until the hosted Voice API exists. Enabling this feature on the public hosted LUMA deployment requires a separately authenticated/reachable Voice API origin. That network/deployment step is intentionally excluded from this closed graph to avoid turning the integration into an indefinite infrastructure workstream.
