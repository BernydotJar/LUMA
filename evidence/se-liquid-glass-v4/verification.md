# LUMA-067 — independent verification and scope accounting

## Verified story

When Seres is selected, a learner or coach sees the same functional optical material hierarchy as Liquid Light: navigation and controls are glass-like, the institutional logo remains fully legible above a bounded refractive pane, and learning/reading surfaces remain opaque. This is a presentation-layer change; no API or enrollment behavior changes.

## Actual checks

| Control | Evidence | Measured outcome |
| --- | --- | --- |
| ESLint | `lint.log` | PASS |
| TypeScript | `typecheck.log` | PASS (full lockfile installed with `npm ci`) |
| Unit tests | `unit.log` | **291 passed**, 52 emulator tests skipped by their required environment |
| Production build | `build.log` | **PASS**, Next.js 16.3.8 webpack, 52 static pages generated |
| Optical E2E | `e2e.log` | **8/8 PASS**, production standalone server, desktop + mobile |
| Targeted a11y/optical inspection | `audit.json`, `audit.log` | **10/10 PASS** across SE/Light/Dark and desktop/mobile, zero Axe WCAG A/AA findings or page errors |
| Full glass adversarial | `full-glass-report.json`, `full-glass-audit.log` | **72/72 PASS**, zero horizontal overflow, out-of-bounds content, clipping, nested glass, active reduced-motion animation or WCAG A/AA violations |
| WebKit browser engine | `webkit-audit.json`, `webkit-audit.log` | **10/10 PASS** across 3 themes, desktop/mobile, logo/lens, Library and Twin; no Axe A/AA findings. This is WebKit Linux, not native macOS Safari. |
| Visual assets | `seres-preview-desktop.png`, `seres-preview-mobile.png`, `webkit-desktop.png`, `webkit-mobile.png` | Bounded optical preview captured from the production-compiled route |
| Brand provenance | `docs/design/seres-brand-provenance.md` | Public-asset-derived palette; **not** brand-owner-approved |

## Problems caught and fixed by the independent sweep

1. Library mobile hero title/min-content and oversized `qualityScore > strong` caused 44px horizontal overflow in SE, Light and Dark. Fixed by responsive `minmax(0,1fr)`, constrained heading and responsive score type. Full rerun verifies zero overflow.
2. Learning Twin active filter color `#2D1B1D` yielded Axe contrast **4.47:1** on Liquid Light blue. Fixed to the theme-specific `--active-control-ink`; full rerun has zero color-contrast findings.
3. The first new dedicated E2E selected both a hidden and visible appearance-preview copy; corrected the selector to use the visible instance. Re-run 8/8 PASS without changing the product's hidden content.

## Independent adversarial review

Granite initial verdict BLOCK is retained as `granite-initial-block.md`. After adding 10 WebKit parity checks and clarifying that institutional brand approval and future deployment are not software-PR quality gates, independent follow-up `granite-critic.md` reports PASS for scoped code review; the brand status is still `provisional`. Human verifier independently checks the evidence and does not transfer authority to the model.

## Operational and product limitations

- CSS-based refractive preview is not a WebGPU physical-refraction implementation; there is no runtime Glass-HQ dependency.
- Tests verify Chromium desktop and emulated mobile, including reduced transparency. **WebKit Linux has been tested (10/10 PASS). Native macOS Safari pixel-identical rendering is not independently proven.** CSS has unsupported-filter fallback.
- Source-backed color references are not proof of an official corporate branding manual. Brand-owner approval remains outstanding and is explicitly excluded from the software-release PASS.
- A passing local production build and standalone browser test are **not proof that Firebase production has deployed this branch**. GitHub PR checks, merge and Firebase rollout must be checked separately.

## Verification decision

**PASS** for code, optics, accessibility and scoped architecture quality, subject to the separate GitHub release policy for merging and Firebase promotion.
