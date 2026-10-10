# Seres de Excelencia — brand provenance and temporary design tokens

## Classification

**Public-asset-derived design reference; NOT an approved institutional brand guide.** LUMA's theme uses color samples found in public Seres de Excelencia assets. The theme must not be described as formally certified, brand-guideline-compliant or officially approved until the brand owner signs off on the HEX codes, permitted logo variants and intended color roles.

## Verified public references (retrieved 2026-10-10)

| Evidence | Public source | Observations | Status |
| --- | --- | --- | --- |
| Public Seres logo, 2021 | `https://seresdeexcelencia.com/wp-content/uploads/2021/05/Recurso-1ic_.png` | 672 × 160 asset contains bright blue and pink; its colored areas match the current optimized LUMA logo closely | Public reference, **not** a signed style guide |
| LUMA product logo | `public/brand/seres-de-excelencia/logo.png` | 420 × 100 optimized image; near the public 2021 logo's prominent `#00A2F1` and `#FF438C` tones | Derived product copy; preserve proportions |
| Public page | `https://seresdeexcelencia.com/` | Includes blue `#00A2F1` and plum `#993366` in editorial inline text; calendar plugin includes `#E64883` | Color occurrences, **not** a definitive palette |
| Site WordPress theme | Public page CSS root | `--primary-color: #EF746A` | WordPress design token; not necessarily Seres corporate primary |
| Other site image | `https://seresdeexcelencia.com/wp-content/uploads/2024/04/LOGO-EXCELENCIA-HUMANA.png` | Different logo variant/offer contains deep navy `#06194F` and hot pink `#ED1E79` | Distinct public asset; do not silently replace Seres logo |

The repository previously referenced a `logo-source.png` file which was **not present** in `public/brand/seres-de-excelencia/` during this review. The published original URL above is the available provenance link. Preserve the optimized copy, but do not invent local original files.

## Provisional theme tokens

| Role | Value | Evidence strength |
| --- | --- | --- |
| Branded blue (`--accent`) | `#00A2F1` | High: public Seres logo and site text |
| Branded pink (`--brand-secondary`) | `#FF438C` | High: public Seres logo (sampled visual color) |
| Supporting plum (`--brand-deep`) | `#993366` | Medium: public website editorial text, not the sampled logo |
| Light canvas | `#F7F9FC` | LUMA authored UI neutral, not brand-owned |
| Functional optical lens | Translucency and light effects | LUMA material-system design, not client brand token |

The color roles are intentional **LUMA design choices**. Do not treat any hue as a gender designation.

## Approval gate

The product can use this clearly labeled provisional brand interpretation during development and demos. The brand owner must approve exact colors, current logo variant, spacing/clear space and usage before a formal claim of institutional identity compliance is made. Such approval is a commercial/content-governance activity and is **not** represented as a software-test PASS.

## UX guardrails

- Logo image is never itself refracted, masked or color-shifted by the optical lens.
- Only the backdrop behind the logo is refracted; the logo appears in a higher z-index layer.
- Preserve content-surface for reading and learning panels: optical work belongs in navigation and bounded presentation controls.
- Use CSS fallbacks for non-supporting browsers, `prefers-reduced-transparency` and `prefers-contrast: more`.
- Verify desktop/mobile, active/inactive themes, focus, clipping and backdrop coverage before release.
