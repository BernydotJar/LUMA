# Gemini Bridge Runbook — Iconography Still Approval

## Purpose

Use the authenticated browser bridge to create one premium iconography still at a time from the approved prompt pack.

## Host-to-workstation entry

Resolve the current workstation name before entering the container:

```bash
WORKSTATION="cloud-sandbox-..."

docker exec -it \
  -w /workspace \
  "$WORKSTATION" \
  bash
```

The workstation ID is environment-specific and must not be hard-coded in the repository.

## Browser preflight

1. Open `https://gemini.google.com/app` in the authenticated bridge profile.
2. Confirm the intended Google account and plan.
3. Confirm that image generation is available.
4. Keep the LUMA repository and evidence directory available.
5. Never paste private source video, learner data or secrets into the image prompt.

## First controlled run

Recommended first still:

- semantic object: `practice`;
- theme: `se`;
- metaphor: refractive prism;
- source concept: P.A.S. / reframing;
- output target: `evidence/iconography/<run-id>/practice-se-still.*`.

Use:

- shared art direction;
- SE theme suffix;
- Practice semantic prompt;

from `docs/iconography/gemini-prompt-pack.md`.

## Exactly-one-still rule

Generate exactly one still.

Then stop and collect:

- screenshot of prompt and output;
- provider/model label shown in the UI;
- generation timestamp;
- downloaded-file SHA-256;
- dimensions and alpha/background status;
- Product Owner decision: `APPROVED` or `REVISE`.

Do not generate a second variant until the Product Owner asks for one.

## Motion gate

After still approval, propose exactly one motion:

> Refraction travels through the prism, separates into two interpretation paths and converges into one focused path.

Wait for motion approval before invoking the animated 3dicon pipeline.

## Current environment status

During the latest sandbox preflight:

- the generic sandbox browser session reached Gemini but was unauthenticated;
- no supported image-provider API key was available in the workstation environment;
- therefore no Gemini-generated still was included in the current release.

The deterministic SVG baseline remains the production asset until the authenticated bridge run is completed.
