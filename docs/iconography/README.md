# LUMA Iconography System

## Purpose

LUMA iconography gives a stable visual meaning to six product moments:

| ID | Meaning | Visual metaphor |
|---|---|---|
| `practice` | Practice | Refractive prism |
| `progress` | Progress | Orbital field |
| `coach-insight` | Coach Insight | Architectural strata |
| `human-intervention` | Human Intervention | Bridge / threshold |
| `voice` | Voice practice | Resonance field |
| `video` | Video learning | Editorial frame |

The set is generated for three themes:

- `se` — Seres de Excelencia institutional interpretation;
- `light` — Liquid Light;
- `dark` — Nocturne Intelligence.

## Files

```text
public/iconography/
  manifest.json
  se/*.svg
  light/*.svg
  dark/*.svg
```

The SVG set is the deterministic baseline. It is accessible, small, source-controlled and available even when generated media is unavailable.

## Asset hierarchy

1. **SVG baseline** — always available.
2. **Approved still** — generated from the prompt pack and reviewed by a human.
3. **Animated WebP** — produced through the 3dicon loop pipeline only after still and motion approval.
4. **Reduced-motion fallback** — the approved still remains available next to every animated asset.

## Product constraints

- No mascots, cartoon brains, trophies, rockets, emoji or primary-school visual cues.
- No textual information embedded inside the icon.
- The icon never carries meaning that is missing from accessible UI text.
- Motion must describe the object’s meaning rather than generic floating/spinning.
- Theme changes material and palette; it does not change semantic meaning.
- Generated assets must pass contrast, halo, loop, file-size and reduced-motion checks.

## Provenance

The institutional SE palette was measured from the official Seres de Excelencia website and public logo asset. The original logo is retained under `public/brand/seres-de-excelencia/logo-source.png`; the optimized product copy is `logo.png`.

The animation pipeline is inspired by and compatible with the MIT-licensed `samyost1/3dicon` workflow. LUMA keeps its own prompts, review receipts, generated assets and provider choices.
