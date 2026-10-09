# LUMA Liquid Glass Functional Layer v3

## Intent

Refine Liquid Light from broad glassmorphism into a disciplined optical interface system. Liquid Glass remains visible where material behavior adds spatial hierarchy—navigation, floating controls, bounded overlays, and the showcase refraction lens—while dense learning and analytics content uses opaque `content-surface` material.

This is an incremental material-system upgrade, not a product redesign.

## Product rules

1. **Content remains dominant.** Dense learning, analytics, tutor, twin, and corpus cards must not depend on backdrop filtering for hierarchy.
2. **Glass is functional.** Backdrop-filtered material is reserved for navigation, controls, overlays, and bounded optical demonstrations.
3. **No nested glass.** A glass surface must not contain another `.glass` surface.
4. **Bounded refraction.** SVG displacement is restricted to the existing Liquid Light preview lens.
5. **Geometry-driven regeneration.** The displacement map regenerates only when root/lens geometry changes.
6. **Accessibility short-circuits optics.** Reduced-transparency mode skips refraction map generation and uses opaque fallbacks; higher contrast strengthens material boundaries.
7. **No permanent compositor hint for static refraction.** Static filtered content does not use `will-change: filter`.
8. **Portable browser verification.** Playwright can use an isolated port through `PLAYWRIGHT_PORT` so verification does not interfere with an existing LUMA runtime.

## Acceptance criteria

- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run test:run` passes all executable unit tests.
- `e2e/liquid-glass-v2.spec.ts` passes on desktop and mobile, including the v3 content-surface boundary.
- `npm run build` passes.
- Glass adversarial sweep passes all 42 theme/viewport/route checks.
- Zero semantic horizontal overflow, clipped text, nested glass, active reduced-motion violations, fixed-glass overlaps, or Axe WCAG A/AA violations.
- `prefers-reduced-transparency` fallback remains present.
- Active backdrop-filtered elements stay at or below 14 per audited route/viewport.
- Summed above-fold backdrop coverage stays at or below 0.95 per audited route/viewport.
- `/library` mobile backdrop coverage is materially lower than the v2 baseline of 1.07.
- `/studio` desktop backdrop coverage is materially lower than the v2 baseline of 0.69.

## Non-goals

- No redesign of learning flows, commerce, authentication, Learning Twin semantics, or API contracts.
- No WebGL renderer introduced across application cards.
- No attempt to make every surface translucent.
- No dependency on Apple-private APIs; the implementation remains standard web CSS/SVG/React.
