# SPEC 020 — Liquid Glass Refraction v2

## Objective

Upgrade the `light` / "Luz Líquida" material from generic frosted glass to a lens-like material while preserving LUMA's accessibility, performance, and cross-browser product boundaries.

## Reference

The user supplied the CodePen `SVG Liquid Glass - feDisplacementMap` by mr-tipton:

- https://codepen.io/mr-tipton/pen/YPqGgxa

The useful technique is bounded refraction: duplicate the scene inside a constrained lens, generate a rounded-rectangle displacement map, and apply it with SVG `feDisplacementMap`. Blur, tint, and specular glint are separate layers.

## Product decision

LUMA will not put live displacement filters on every card. The real refractive renderer is reserved for bounded showcase surfaces where the scene is small and stable. Ordinary product cards continue to use a cheaper CSS material approximation.

## Producer scope

1. Add one reusable bounded refractive preview for the Liquid Light theme card on `/experience`.
2. Keep refraction static and event-driven; no permanent animation loop.
3. Keep chromatic aberration disabled by default.
4. Reduce the Liquid Light global glass blur/fill and strengthen top-left rim / lower-right counter-rim so surfaces read as a lens rather than frosted plastic.
5. Preserve SE and Nocturne as distinct materials.
6. Preserve reduced-transparency and reduced-motion behavior.
7. Extend adversarial evidence without increasing nested glass.

## Performance contract

- displacement map generated only after mount / resize;
- one refractive lens in the theme preview;
- no requestAnimationFrame repaint loop while idle;
- no per-frame filter-id churn because the preview scene is static;
- no chromatic multi-pass filter;
- map resolution remains 1x;
- ordinary `.glass` surfaces stay CSS-only.

## Accessibility contract

- decorative refracted clone is `aria-hidden`;
- theme selection remains the native button action;
- readable text never depends on distorted content;
- reduced transparency falls back to an opaque material;
- focus and selected state remain independent of color alone.

## Acceptance criteria

1. `/experience` renders a dedicated refractive preview for `light`.
2. The preview reaches `data-refraction-ready="true"` in a browser with Canvas + SVG filter support.
3. The preview does not create nested `.glass` surfaces.
4. `npm run lint`, `npm run typecheck`, `npm run test:run`, and `npm run build` pass.
5. `npm run audit:glass` remains at zero blocking findings.
6. Desktop and mobile screenshots show no clipping or horizontal overflow.
7. The code keeps a non-filter fallback for unsupported or reduced-transparency environments.
