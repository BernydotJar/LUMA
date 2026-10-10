# LUMA — Editorial Learner Experience Review
**Date:** 2026-10-09

## Intent

Turn a showcase-like learner landing page into an adult learning workspace. Avoid AI-slop cues: giant generic slogans, repeated CTAs, stacked unrelated feature cards, decorative intelligence scores and overpowering refraction. Preserve the LUMA system and all three customer themes.

## Design and interaction decisions

- **Single decisive first action:** Place the actual `NextActionCard` within the editorial hero, replacing the duplicate session brief. CTA and expected duration are first-class.
- **Shorter hero:** Balanced 2-column composition with restrained serif accent, calmer institutional surfaces, measured typography and meaningful white space.
- **Navigation:** Three contextual shortcuts only (program, personal path, contextual tutor). The full module gallery remains under the program route; the learner path is an expandable disclosure.
- **Honest progress:** The existing previous patch binds real scored events to the progress story and shows an honest empty state when none exist. The learning pulse uses source-qualified statuses rather than decorative mastery metrics.
- **Clear separation of concerns:** Learners see a compact visual-theme toggle and no superuser/role-switch controls in the header. The coach/studio console retains its navigation. Role authorization is enforced server-side independently of this presentation choice.
- **Visual language:** The opaque content surfaces lead; a dark, tactile primary-action surface becomes the sole hero focal point. Glass is restrained to workspace chrome rather than every card. Three supported themes remain intact.
- **Content:** All learning routes, upcoming live sessions, chat and certificates remain discoverable.
- **Interaction:** Native disclosure, labeled actions, focus-visible states, a route anchor and optional rationale disclosure. Motion reduction is respected.

## Original benchmark measurements

Production at audit: `/learn` ~4,920px document height desktop (1440×900), ~7,271px mobile (390×844); large duplicate primary action below desktop fold. This release aims to substantially shorten both experiences; measurements must be verified from a successful new preview rather than inferred.

## Source impact

- `src/components/adaptive-learning-home.tsx` — page composition and content order
- `src/components/next-action-card.tsx` — hero practice
- `src/components/learning-pulse.tsx`, `progress-story.module.css` — integrity and compact evidence
- `src/components/experience-control.tsx`, `app-shell.tsx` — role-appropriate navigation
- `src/components/experience-shelf.tsx` — secondary discovery card hierarchy
- Local CSS modules — themed materials and responsive behavior
- `e2e/showcase.spec.ts`, `responsive-mobile.spec.ts`, `learner-home-editorial.spec.ts` — regression coverage

## Evidence and release gate

| Control | Result |
| --- | --- |
| ESLint (changed TSX/E2E) | PASS |
| TypeScript `tsc --noEmit` | PASS |
| `git diff --check` | PASS |
| Vitest | 275 PASS, 50 skipped |
| Live development browser preview | BLOCKED: Next.js 16.3.8 dev HTTP 500, missing .next/dev/.../build-manifest.json; local webpack compile hit shared sandbox contention |
| E2E/visual/axe across two viewports | NOT VERIFIED for this commit; E2E tests are authored and require a functioning preview |
| Production build and Firebase deploy | NOT EXECUTED / NOT APPROVED |

## Acceptance remaining before merge or deployment

1. Resolve isolated Next build/preview output and run targeted Playwright plus WCAG axe.
2. Capture and inspect 1440×900 and 390×844 screenshots in each theme; check first CTA visibility, overflow, contrast and mobile header geometry.
3. Exercise onboarding → suggested practice → rubric event → evidence card, live agenda and tutor under authenticated access.
4. Independent critique and release gate; only integrate after green evidence, especially because the optical v4 branch is evolving separately.
5. Track signed-in receipt provenance and backend-vs-local reconciliation as follow-up hardening; never treat seeded demo learner state as independently verified personal achievements.

## Relevant UX laws

Hick (one primary choice), Fitts (reachable controls), Jakob (conventional navigation and disclosures), proximity/common region (related information in one surface), Zeigarnik (resumable action), aesthetic-usability (restrained compositional language) and peak-end (meaningful end-of-practice feedback). Reference: https://lawsofux.com/es/
