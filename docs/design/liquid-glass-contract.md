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

## Implementation boundary

The web product uses CSS material approximations for performance and broad compatibility. The user-supplied 1440×1440 motion prompt describes a WebGL2 rendering approach for motion artwork; LUMA does not need to reproduce that renderer in every application surface to preserve the design principles.
