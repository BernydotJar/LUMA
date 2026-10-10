# LUMA — CX Review: evidence-first learning experience

**Date:** 2026-10-09
**Scope:** learner home, progress story, learning pulse, navigation semantics, and near-term information architecture.
**Benchmark:** screenshots supplied by the product owner of Hotmart public landing, Seres de Excelencia shop, ebook checkout, and an unavailable course page. These are illustrative screenshots, not a comprehensive assessment of Hotmart.

## Product distinction

Hotmart is currently the transaction/enrollment and storefront layer for Seres de Excelencia. LUMA must prove the value *after enrollment*, through a coherent, personal learning experience: **Next meaningful action → authentic evidence → grounded feedback → coach intervention → observable skill transfer**.

Marketing can borrow theatrical, scroll-driven motion from [Scrolltide](https://www.scrolltide.co/). The authenticated app should privilege legibility, direction, trust, and speed. Avoid a common visual mistake: adding glass or immersive animation to every card instead of improving task completion.

## Repository and runtime evidence

- Branch base: main at `2789619`.
- Learner route `/learn` responded 200 on `https://luma.lch-app.cloud` at audit time, with its principal next-action heading at about 973 px on a 1440x900 desktop viewport; body height approximately 4920 px.
- `ProgressStory` had hard-coded achievements and a 3/3 score; `LearningPulse` had hard-coded status labels; these must not look like factual personalized evidence for an unknown learner.
- AppShell had inert Search and Notifications buttons.
- Learner architecture already includes next-action routing, journey, evidence ingestion, practices, LiveKit schedule, course exploration, and studio separation. Preserve these capabilities.

## Experience principles and UX laws

| Law / principle | LUMA implementation requirement |
| --- | --- |
| Hick's law + cognitive load | One primary action per view, secondary choices progressively disclosed. Learner home starts with **continue practice**, not multi-column product marketing. |
| Fitts's law | Primary actions at least 44x44 CSS px, mobile-first and reachable; never use tiny icon-only controls with unclear labels. |
| Jakob's law | Keep conventional course playback, breadcrumbs, tabs, progress and navigation conventions. Innovate in intelligence, not in basic player controls. |
| Proximity + common region | Distinct surfaces for next action, documented evidence, upcoming live class, and optional discovery. |
| Zeigarnik + goal-gradient | Show a real resumable action and evidence-based progress; do not fabricate percentages or achievements. |
| Doherty threshold | Immediate feedback after click; show loading, failure and retry without fake success; measure INP and render paths. |
| Aesthetic-usability effect | Consistent optical surface system with restrained Liquid Glass, typography, whitespace and WCAG-compliant contrast. |
| Peak-end rule | Conclude a practice with grounded feedback, what was observed and the actionable next step. |

Source: https://lawsofux.com/es/

## Information architecture proposal

### Public experience

Editorial, high-impact storytelling and demonstrable outcomes: show what learners will *do* and *prove*, not a grid of feature claims. Scrolltide-inspired cinematic motion belongs primarily here, with a reduced-motion fallback and strict performance budget.

### Learner

1. **Above the fold:** greeting and one action: practice/session with time and capability to develop. If a live session is imminent, entry into the classroom may take precedence.
2. **Evidence:** render results only when the underlying event, rubric and context exist. Otherwise show an honest and inviting empty state.
3. **Course path:** simple chapter-to-practice map, content with meaningful unavailable-state/retry, contextual grounded LUMA tutor.
4. **Secondary surfaces:** coach messages, certificates, program browsing, learning history; no cross-selling that obstructs access to paid content.

### Coach

Evidence provenance, cohort insight, calibration, interventions, live session prep, and only authorized learner data. Learning Twin remains coach-facing, not exposed as a diagnostic label in learner UI.

## This patch

- Replaces fabricated `ProgressStory` achievements with an evidence-first empty state or receipt-derived criterion counts.
- First-time visitors see an explicit invitation to set their goal and a neutral learning path instead of the demo learner's supposed goals, time budget and completed journey.
- Keeps ranking data as recommendation *hypothesis*; removes a misleading uncalibrated numerical confidence claim from the learner UI.
- Replaces hard-coded metric stages with "Por explorar", "Por comprobar", and self-perception or eligible scored-evidence context, never unsupported mastery assertions.
- Changes the inert header search icon to a real destination and removes the inert notifications action.
- Retains personalized recommendation behavior for learners with onboarding, while describing visitor suggestions without implying that demo ranking is grounded in their history.
- Moderately reduces hero size and copy; preserves visual identity and existing three themes.
- Adds regression tests for honest initial and scored-receipt states, and navigation semantics.

## Release boundaries

This is a scoped CX trust/usability improvement, not a full product or Liquid Glass v4 redesign. Do not deploy until full build, mobile E2E, WCAG and product-owner visual review are green. Avoid colliding with the separate ongoing `feature/liquid-glass-v4-surfaces` branch.

## Subsequent work / priority

| Priority | Change | Acceptance |
| --- | --- | --- |
| P0 | Replace default demo learner projection with explicit guest/real state across *all* learner modules | A first-time user never sees someone else's goal, mastery, or data. |
| P0 | Role-aware app shell, guarded privileged controls | Learners see no superuser or coach navigation; authenticated coach views remain protected. |
| P1 | First-action-first layout; session brief consolidated with next-action card | Next meaningful task and CTA appear within a 900 px desktop viewport and common mobile viewports. |
| P1 | True progress feed joined to authenticated receipts | Backend receipt provenance, user binding, confidence/status disclosures, no local shared-session confusion. |
| P1 | Content failure/empty states for modules and class access | Distinguish unavailable, not yet published, enrollment missing, expired access; offer one realistic recovery path. |
| P1 | Contextual search and alerts | Implement real search/notification capabilities or omit controls. |
| P2 | Optical Liquid Glass v4 + design tokens + typography refinement | 3 themes preserve contrast, visual hierarchy and reduced-motion; no blanket backdrop blur. |
| P2 | Marketing hero motion + product preview | Tell a clear story showing tutor, practice, evidence, coach, live class; budget LCP/INP/CLS. |

## Measurement plan (targets to agree, not measured results)

- Time from landing in learner home to first meaningful action / resumed practice.
- Practice completion and re-engagement at day 7 (cohort separated).
- Ratio of recommendations with a visible factual source/explanation.
- False-positive progress claims: **0 tolerated**.
- Authorized/unauthorized data access paths: **0 critical findings**.
- Baseline Web Vitals and WCAG 2.2 AA automated + manual keyboard walkthrough.
