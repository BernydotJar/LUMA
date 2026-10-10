# LUMA-067: Seres optical material and traceable brand tokens

## Product story

As a learner or coach who chooses Seres de Excelencia, I can recognize an institutional-inspired visual identity while experiencing the same premium optical control system available in Liquid Light, without impaired logo visibility or reading contrast.

## Scope

- Build a visibly optical Seres preview with a bounded refractive CSS lens behind the source logo.
- Tune Seres navigation/sidebar, mobile navigation and functional controls to translucent glass material with specular edges.
- Preserve the established content-surface boundary and the other two themes.
- Do not import the experimental Glass-HQ WebGPU library or run its renderer globally.
- Document brand provenance and require external confirmation before calling the palette officially approved.

## Constraints

- The logo must remain unmodified and layered above the lens.
- Decorative elements are aria-hidden; the selection button continues to convey `aria-pressed` and an accessible label.
- The lens provides `prefers-reduced-transparency: reduce`, `prefers-contrast: more` and backdrop-filter unsupported fallbacks.
- No new API, authorization, enrollment, Learning Twin or business-behavior changes.
- Changes must not increase active backdrop-filter coverage past the established adversarial limits.

## Acceptance

- TypeScript, ESLint, production build and executable unit tests pass.
- Dedicated desktop/mobile optics E2E passes, including logo/lens layering and transparency reduction.
- Extended adversarial glass audit and automated visual/contrast checks pass or explicitly gate promotion as blocked.
- Independent critic + verifier record evidence in the append-only Graph Harness ledger.
- A GitHub PR is published and may merge only after required checks pass; production rollout provenance must be verified separately.

## Full-adversarial sweep fixes

The 72-case audit exposed **pre-existing** shared surface failures: Library mobile overflow of 44px across all three themes (hero min-content and an oversized score), and a Learning Twin selected filter contrast of 4.47:1 in Liquid Light. The scoped CSS fixes use responsive `minmax(0,1fr)`, a correctly bounded title/score and `--active-control-ink`. The full matrix has now passed **72/72** after remediation.

## Browser-engine parity evidence

A separate Playwright WebKit Linux run validated **10/10** cross-theme/browser scenarios, including both responsive viewports and the two ancillary layout/contrast fixes. Native Safari on macOS remains an explicitly unproven visual parity requirement; do not claim it is covered merely because WebKit Linux passes.
