# 3dicon Integration Plan

## Upstream

- Repository: `samyost1/3dicon`
- License: MIT
- Local reference checkout: `/workspace/projects/3dicon`

## Why use it

The pipeline creates a still, reuses the same still as first and last frame, animates the object, removes a known backing color and emits an animated WebP with true alpha.

## LUMA adaptation

The upstream pipeline is not allowed to invent icon meaning. Every run must reference:

- semantic ID;
- theme ID;
- approved still prompt;
- source concept;
- still approval receipt;
- motion approval receipt;
- provider/model version;
- output hash;
- verifier result.

## Mandatory two-stage approval

### Gate A — still

1. Generate exactly one still.
2. Store it under `evidence/iconography/<run-id>/still.*`.
3. Show it to the product owner.
4. Record `APPROVED` or `REVISE`.

### Gate B — motion

1. Propose exactly one physical motion.
2. Record the selected strategy, energy and emission flags.
3. Obtain approval.
4. Only then run animation/matting/encoding.

## Initial motion proposals

| Icon | Strategy | Energy | Motion |
|---|---|---|---|
| Practice prism | `surface` | `still` | Refraction travels through the prism and converges into focus |
| Progress orbit | `native` | `calm` | Satellites move at different rates while the core breathes subtly |
| Coach strata | `part` | `calm` | One architectural plane rises, receives light and settles |
| Human bridge | `event` | `calm` | The span forms from both sides, locks precisely and returns |
| Voice resonance | `native` | `calm` | Bars respond asynchronously to one measured phrase |
| Video frame | `part` | `calm` | The chapter marker advances and the frame aperture opens once |

## Runtime delivery

- Animated WebP for normal motion.
- Approved still for `prefers-reduced-motion`.
- Responsive source sizes: 128, 192, 288 and 384 px.
- Performance target: under 850 KB at the selected display size unless the release gate explicitly accepts more.

## Current environment boundary

The LUMA sandbox currently has no configured `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY` or authenticated Gemini browser profile. The deterministic SVG set and prompt pack are therefore the current production baseline. Generated stills require the authenticated bridge or an approved provider credential.
