# Learner Experience UI v2 — Critic Review

## Review posture

Attempt to falsify the claim that LUMA now feels like a learning product rather than an AI dashboard.

## Findings repaired during review

### Dual active navigation state

The first visual review showed both Today and Journey highlighted because both shared /learn. Hash navigation is no longer treated as active from pathname alone.

### Accessible tutor label

A copy replacement temporarily produced "Pregunta al Pregunta a LUMA". The input label is now "Pregunta a LUMA" and Playwright uses textbox role semantics.

### WCAG contrast

The first automated accessibility sweep found the adaptation-result caption at 4.01:1. The text color was raised to pass WCAG AA.

### Onboarding visual discontinuity

The first redesign pass left onboarding in the previous dark-green language. Onboarding now shares the warm cream, burgundy, orange, mustard, and avocado system.

### Visual-audit false positives

The layout audit counted intentionally clipped aria-hidden 3D decoration and horizontal prompt scrolling as semantic overflow. The audit now excludes aria-hidden decoration and children of intentional horizontal scrollers.

## Product review

PASS:
- one dominant next action;
- route-change explanation is progressive disclosure;
- no course catalog dominates the learner home;
- Twin is experienced as adaptation before analytics;
- tutor is contextual but secondary;
- mobile remains task-oriented;
- practice workspace feels part of the same product.

## Residual work

- Twin detail page and Library still use more of the previous visual system.
- Instructor Studio intentionally remains unchanged in this increment.
- Generated 3D WebP accents are deferred until the core visual direction is accepted.
