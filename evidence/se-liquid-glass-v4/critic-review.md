# LUMA-067 — Adversarial Critic Findings and Release Decision

## Review posture

Attempt to disprove the claim that Seres can have a perceptible Liquid Glass identity while remaining legible, accessible and faithful to public brand reference assets. Evaluate the complete 72-combination audit, compiled-browser results and code scope rather than approving based on screenshots alone.

## Evidence-backed risks

1. **Insufficient glass material in Seres** — baseline had mainly white-on-white, including fully opaque preview. **FIXED:** CSS lens now has background light fields, bounded `blur(9px) saturate(1.26)`, specular rim and a distinct branding layer. Sidebar and controls have a more transparent material without turning content cards into glass. Production-compiled browser verifies actual computed filters.
2. **Logo masking or distortion** — prior decorative pills occluded preview text. **CONTROLLED:** the original logo is rendered above the pane (`z-index: 2` vs `1`), remains inside the preview, and is not subjected to SVG refraction. E2E validates geometry in desktop/mobile and legacy Liquid Light cases remain green.
3. **Heavy material and motion** — **CONTROLLED:** one bounded preview lens, with no WebGPU dependency, added full-page glass, static compositor hint or perpetual animation. Reduced-transparency disables optical filtering; there is a CSS unsupported-backdrop fallback.
4. **Brand provenance misrepresentation** — prior README used the phrase "official" and iconography docs referenced a missing `logo-source.png`. **FIXED:** documented 2021 logo reference, source URLs, alternate 2024 logo, provisional HEX roles and pending brand-owner approval. The owner retains brand rights; LUMA's software testing cannot approve its palette.
5. **Mobile overflow beyond scope** — first full audit flagged 44px Library overflow across the three themes. **FIXED:** constrained min-content tracks and oversize qualityScore typography; full rerun 72/72 verifies zero horizontal overflow.
6. **Color contrast beyond scope** — selected Learning Twin filter in Liquid Light measured 4.47:1 on an active blue control, below 4.5:1. **FIXED:** theme-derived `--active-control-ink`, and zero WCAG A/AA findings in full rerun.
7. **Test reliability** — hidden and visible duplicate preview elements initially confused a new test. **FIXED:** assertions target the visible preview, still testing lens/background, z-order and logo containment; the combined legacy + new regression suite passed 14/14 on the production compiled standalone.

## Independent evidence

- IBM Granite initial adversarial review: `granite-initial-block.md`, `BLOCK` on external client-brand signoff, native Safari visual parity and future production deployment. This initial verdict is preserved verbatim.
- IBM Granite follow-up on the strictly scoped software PR gate after 10 WebKit tests passed: `granite-critic.md`, `PASS` with no software blockers. This follow-up specifically distinguishes PR-readiness from external brand-owner approval and the post-merge production rollout. Both prompt hashes and model output are retained; the reviewer is not authorized to certify brand or deploy.
- Independent Playwright, Axe, WebKit engine, Next.js build and TypeScript artifacts verify actual behavior independently of model opinion.
- Playwright, Axe, Next.js build and TypeScript artifacts verify actual behavior independently of prose claims.

## Residual nonblocking conditions

- Safari native optical parity has not been manually verified. Chromium results and CSS fallbacks do not prove WebKit pixel equivalence; recommend a native visual pass before promising pixel-identical material.
- Brand palette is **provisional** until approved by Seres' authorized brand owner. Never claim corporate brand compliance from a source sampling exercise.
- Software release PASS does **not** mean the new commit is already deployed to Firebase; production rollout must be verified after the PR gate.

## Critic decision

**PASS** for the scoped software quality/release gate with these explicitly bounded residual limitations. External brand signoff and production promotion remain separate conditions.
