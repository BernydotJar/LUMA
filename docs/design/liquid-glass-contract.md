# Liquid Glass Product Contract

## Purpose

LUMA uses liquid-glass principles as a material system, not as a decorative effect.

This contract is derived from the user-supplied Apple Liquid Glass motion reference and adapted to a production learning product.

## Material rules

1. **Glass behaves like a lens.**
   - keep translucency restrained;
   - preserve background depth;
   - emphasize the rim rather than covering the whole surface with heavy blur.

2. **Specular hierarchy.**
   - primary rim light comes from the top-left;
   - a weaker counter-highlight may appear at the lower-right;
   - contact shadow stays soft and low-opacity.

3. **Glass does not stack on glass.**
   - nested glass is a blocking adversarial finding;
   - content inside glass uses solid or vibrant fills rather than another glass card.

4. **Concentric geometry.**
   - inner radii must visually derive from outer radius minus padding;
   - arbitrary nested corner radii are a review failure.

5. **Motion is direct and interruptible.**
   - interaction feedback begins immediately;
   - no decorative bounce;
   - restrained overshoot;
   - reduced-motion mode must collapse long-running motion.

6. **Accessibility overrides aesthetics.**
   - text contrast wins over transparency;
   - reduced-transparency mode removes backdrop filtering;
   - focus states remain visible in every theme.

## Theme interpretation

### Seres de Excelencia

Glass sits over institutional blue / pink / plum fields but never uses those colors to imply gender.

### Liquid Light

The light theme uses the strongest lens/material expression:
- system-like off-white canvas;
- one primary active blue;
- calm teal/violet/peach fields behind material;
- translucent rather than milky surfaces;
- typography and spacing carry most of the hierarchy.

### Nocturne Intelligence

Glass is quieter and denser:
- aubergine foundation;
- champagne intelligence accent;
- shallow rim highlight;
- reduced glow.

## Adversarial requirements

The glass harness must fail on:
- semantic horizontal overflow;
- clipped text;
- nested glass;
- fixed glass overlap with primary actions;
- WCAG A/AA violations;
- long-running animation under reduced motion;
- missing reduced-transparency fallback.

Manual review also checks:
- excessive glass coverage;
- frosted-plastic appearance;
- mismatched corner radii;
- glass used where an opaque information surface is clearer.


## Refraction v2 boundary

The CodePen reference supplied for the v2 review demonstrates a cross-browser bounded-lens technique: render a duplicate of the local scene inside the lens, generate a rounded-rectangle displacement map, and apply SVG `feDisplacementMap`; keep tint, blur, and glint as separate layers.

LUMA adopts that technique only where the scene is small, stable, and intentionally showcased. A refractive preview may therefore use a generated displacement map, but ordinary learning cards remain CSS-only. This prevents a design-system effect from becoming a permanent GPU tax.

For bounded refraction:
- generate the map on mount or resize, not continuously;
- prefer one displacement pass and keep chromatic aberration off by default;
- refresh the filter id only when the displacement map is regenerated; never churn it per frame;
- preserve an opaque reduced-transparency fallback;
- keep meaningful text outside the warped clone;
- never stack a refractive lens inside another glass surface.

## Implementation boundary

The web product uses CSS material approximations for most application surfaces and bounded SVG displacement only for deliberately small showcase lenses. The user-supplied 1440×1440 motion prompt describes a WebGL2 rendering approach for motion artwork; LUMA does not need to reproduce that renderer in every application surface to preserve the design principles.

## Functional-layer placement v3

Liquid Glass is a functional interface layer, not the default content-card material.

- Reserve real backdrop material for navigation, floating controls, parallel overlays, and deliberately bounded optical showcases.
- Dense learning, analytics, and corpus panels default to `content-surface`: high-legibility surfaces with depth but no backdrop filtering.
- Apply glass to the outer interactive control rather than stacking it on inner labels or icons.
- Preserve concentric geometry between a glass container and the controls it owns.
- The adversarial audit blocks viewport-summed backdrop coverage above `0.95` or more than `14` active backdrop-filtered elements on a route/viewport.
- Static refraction must not pin a compositor layer with `will-change`; regenerate displacement only when lens geometry changes.
- When reduced transparency is requested, do not merely hide the refracted pixels: skip displacement-map generation entirely.

This placement rule intentionally keeps the content visually dominant while navigation and controls retain the optical character of Liquid Light.

## v4 material consistency review

- Persistent Twin, Twin detail, reflection, practice and content search information panels use theme-aware `content-surface` instead of applying `.glass` to entire text panels.
- Keep the UI navigation and bounded optical demonstration as functional glass surfaces.
- Treat Glass-HQ WebGPU v0.0.1 as a reference and opt-in experiment, not a global runtime dependency; full cross-browser validation is required.
- A change to material class must not modify component semantics, permission checks, or event handling.

## Unified Optical System v4

### Material taxonomy and placement

| Material | Implementation | Appropriate surfaces | Exclusions |
| --- | --- | --- | --- |
| Content | `content-surface`, `--content-fill` | Long-form reading, coach evidence, learning cards, data panels and reflections | Backdrop filtering, refracted or chromatically shifted text |
| Regular | `--optical-control-fill`, `--optical-popover-fill`, `--optical-blur` | Navigation and secondary controls, account and contextual popovers | Nested glass, scroll-heavy data tables |
| Clear | Local, opt-in specimen only | Over media/visual backgrounds when underlying context matters | Charts, rubrics, scorecards, body text panels |
| Refractive | Existing local SVG displacement with cloned stable DOM scene | Optical Lab demonstration and deliberately bounded previews | Core learning workflow and automatic runtime upgrade to WebGPU |

The `se`, `light` and `dark` themes provide explicit values for `--content-fill`, `--optical-control-fill`, `--optical-popover-fill`, `--optical-rim`, `--optical-blur`, `--optical-saturation` and `--focus-ring`. The account popover and user-experience switch use the same optical control token family, and dense information surfaces are fully opaque in every theme.

### Accessible behavior

- Keyboard focus must be visible against every theme. Active navigation destinations expose `aria-current="page"`.
- Account menu supports Escape to dismiss and returns focus to its trigger; its internal scroll area remains reachable on mobile.
- The reduced-transparency and increased-contrast preferences disable backdrop effects on functional navigation, toolbars and account menus, with an opaque material fallback.
- The SVG lens skips generating its displacement map when reduced transparency is enabled. Reduced motion follows the product-wide rule.
- The Optical Lab at `/preview/optical-lab` is deliberately not indexed. An available WebGPU adapter is **not** proof that a WebGPU refraction engine has been integrated.

### Acceptance and performance gates

1. Run existing unit/TS/ESLint/build checks. Do not claim build PASS if the shared sandbox exits 137 or times out.
2. Run Chromium desktop and mobile regression including at minimum navigation, content opacity, material selector and reduced-transparency mode.
3. Run the expanded adversarial matrix: 14 routes x 3 themes x 2 viewports = 84 scenarios. Capture warnings for protected and redirected routes without treating auth placeholders as full authenticated user-flow coverage.
4. Run the opt-in WebKit Playwright project (`LUMA_WEBKIT=1`) with a supported browser binary to check Safari-like rendering. WebKit Playwright is evidence for the rendering engine, not proof of physical-device Safari parity.
5. Block promotion if there are WCAG A/AA failures, new text clipping, nested glass, broken protected workflows, or unusable reduced-motion/transparency fallbacks. Compare blur coverage/performance against an equivalent baseline instead of claiming unmeasured speed improvements.
6. Review a rendered visual snapshot on physical iOS Safari before claiming a fully production-verified optical implementation.

Glass-HQ is a design and experimental reference. It is not an unconditional dependency or a polyfill; evaluate it separately with controlled performance, browser-support and accessibility measurements.
