# LUMA / Seres de Excelencia — Minimal public landing

**Date:** 2026-10-31
**Branch:** `feat/seres-violet-landing-20261031`
**Base:** `origin/main` at `fb5409a` (2026-10-28)
**Release decision:** SOURCE_ONLY — no merge or production deployment.

## Outcome

Replace root `/` redirect with a restrained, image-led public landing for Seres de Excelencia. Preserve `/learn`, `/login`, Firebase Authentication, institutional branding source, tenant and program controls. The visitor should find the purpose and enter the existing login in one click.

## Scope and design decisions

- One hero with original violet-flame-inspired art, restrained headline, one prominent login CTA and one anchored approach link.
- One information section with three unboxed descriptions: biodescodificación, biocodificación and consciencia.
- Minimal navigation, footer, semantic landmarks and reduced-motion support.
- No counters, made-up testimonials, fake courses, empty calls to action or new provider integrations.
- Artistic inspiration: violet-flame symbolism associated with Saint Germain; this is visual metaphor, not a scientific claim.
- Explanations are educational and nonclinical. Biodescodificación is not presented as a verified diagnosis or treatment, and the disclaimer expressly says so.
- Asset: original generated scene optimized to `public/media/seres-violet-hero.webp` (~86 KiB). The image is a decorative background with empty alt text.

## Verification

- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm run test:run` — PASS: **331** passed, **81** emulator-dependent tests skipped.
- `npm run build` — PASS: root `/` statically rendered.
- Playwright Chromium desktop + mobile for public content, navigation, Google sign-in entry, viewport overflow and Axe WCAG 2.0/2.1 A/AA serious/critical findings: **10/10 PASS**.
- Visual captures at desktop **1440 x 900** and mobile **390 x 844**: hero image loaded, exactly one `main`, no horizontal overflow. Screenshots saved alongside this file (`desktop-full.jpg`, `mobile-full.jpg`, `desktop-hero.jpg`, `mobile-hero.jpg`). No DevTools overlay in final captures.

## Adversarial review and remaining gates

- Challenge: user could mistake biodescodificación for a medical service. Mitigation: language uses reflection rather than causal or therapeutic promises, with an explicit health disclaimer.
- Challenge: a public hero can accidentally bypass login or access the wrong institution. Mitigation: links target existing `/login` and `/learn`; no auth, token, program or tenant boundary changed.
- Challenge: typography and image can fail on small screens. Mitigation: responsive CSS, readable overlay, real mobile screenshot and Playwright overflow/Axe checks.
- Challenge: root entry had earlier test expecting a `/learn` redirect. Mitigation: update that test to assert public root and independently verify `/learn` still works.
- **Pending:** independent product/design acceptance and standard exact-SHA release/signature gate. Do not interpret local checks as permission to merge or deploy.
