# Liquid Glass v2 — reference audit

## Source

User-provided reference: https://codepen.io/mr-tipton/pen/YPqGgxa

## What is materially better than LUMA v1

The reference separates four concerns that LUMA v1 had partially collapsed into heavy `backdrop-filter` blur:

- **refraction** — displacement is strongest around the rim;
- **blur** — optional and independent from refraction;
- **tint** — a separate composited layer;
- **specular glint** — a static top-left highlight with a weaker counter-shade.

It also uses a duplicated scene inside the lens because CSS `filter` can only warp an element's own subtree; it does not directly refract arbitrary DOM behind it cross-browser.

## LUMA adaptation

The production product keeps CSS glass as the default material and introduces one bounded SVG displacement lens in the Liquid Light theme preview. This gets the optical cue from the reference without multiplying GPU-heavy filters across the learning application.

The global Liquid Light surface also moves away from a milky 28px blur toward a clearer material with lower fill opacity, lower blur, and stronger directional rim lighting.

## Deliberate non-adoptions

- no full-page scene cloning;
- no continuous repaint loop;
- no default chromatic aberration;
- no draggable lens in product UI;
- no attempt to reproduce Apple UI or branding.
