# SPEC 015 — Glass Material Adversarial Harness

## Objective

Treat glassmorphism as a governed material system rather than a decorative effect.

## Risks

- glass on glass;
- poor text contrast over bright fields;
- excessive blur/GPU cost;
- nested materials with ambiguous hierarchy;
- non-concentric radii;
- clipped content;
- loss of hierarchy when transparency is reduced;
- motion without reduced-motion fallback;
- active state distinguishable only by color;
- theme-specific regressions.

## Matrix

Run against:

- themes: SE, Liquid Light, Nocturne;
- roles: coachee, coach, superuser;
- viewports: desktop, mobile;
- routes: `/learn`, `/studio`, `/experience`, `/iconography`, `/library`;
- media preferences: default and reduced motion.

## Automated checks

- horizontal overflow;
- clipped text;
- semantic out-of-bounds content;
- nested `.glass` materials;
- total glass-surface budget;
- fixed glass overlap;
- reduced-motion active animations;
- presence of reduced-transparency CSS fallback;
- WCAG A/AA via Axe in the E2E suite;
- theme persistence and hydration health.

## Human review

- material hierarchy;
- text legibility over the brightest canvas field;
- specular rim consistency;
- corner-radius relationships;
- whether the surface feels like a lens rather than frosted plastic;
- whether the design resembles a template or clone.

## Acceptance criteria

1. The adversarial script emits JSON evidence.
2. Blocking findings exit non-zero.
3. Glass-on-glass is either absent or explicitly whitelisted.
4. Reduced-motion mode exposes no long-running semantic animation.
5. Reduced-transparency fallback is present.
6. Every theme/route/viewport combination has zero overflow and clipping.
