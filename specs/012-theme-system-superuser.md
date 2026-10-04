# SPEC 012 — Theme System and Superuser Experience Console

## Outcome

LUMA supports three global visual themes across coachee and coach experiences:

1. Seres de Excelencia;
2. Liquid Light;
3. Nocturne Intelligence.

A superuser can compare coachee and coach experiences, switch themes and inspect delivery tracks from one console. Theme selection is persisted locally in the showcase and later becomes profile/tenant configuration.

## Theme model

Theme controls:

- palette;
- canvas light;
- material tint;
- border/specular treatment;
- iconography variant;
- chart accent;
- selected/active state.

Theme does not control:

- role permissions;
- learning logic;
- content truth;
- evidence policy;
- protected-trait inference.

## Seres de Excelencia

Source basis:

- official website;
- official public logo;
- measured institutional blue, pink/coral and plum.

Product palette:

- luminous blue `#00A2F1`;
- transformation pink `#FF438C`;
- plum `#993366`;
- white surface;
- dark neutral text.

Pink is an institutional accent, not a gender classifier.

## Liquid Light

Uses:

- light system materials;
- restrained refraction;
- top-left specular rim;
- direct, responsive controls;
- one clear active color;
- reduced-motion and reduced-transparency support.

It is inspired by Apple interaction/material discipline without copying Apple trademarks, proprietary icons or exact product UI.

## Nocturne Intelligence

Uses:

- aubergine / graphite canvas;
- champagne intelligence accent;
- burnt orange energy;
- sage verified progress;
- ivory type;
- higher information density for deep work.

## Superuser console

Route: `/experience`

The console contains:

- theme selection;
- coachee preview;
- coach preview;
- profile architecture preview;
- iconography catalog;
- voice/video/iconography delivery graph status.

Showcase superuser:

- Eduardo · Superuser.

Future identities:

- coachee;
- coach;
- organization admin;
- content owner;
- reviewer;
- superuser.

## Persistence

Showcase:

- HTML `data-theme`;
- local storage key `luma-theme-v1`;
- pre-hydration bootstrap to prevent theme flash.

Production target:

- user profile preference;
- optional organization default;
- user override where policy permits;
- server-rendered initial theme;
- tenant-aware branding assets.

## Acceptance criteria

1. Three themes are selectable from the top-level superuser control.
2. Theme choice persists across routes and reloads.
3. `/experience` shows coachee and coach together.
4. SE theme uses verified institutional palette and official logo asset.
5. Light theme uses restrained liquid materials and accessible active states.
6. Dark theme supports coachee and coach routes.
7. Theme changes do not alter learning state or permissions.
8. All themes pass desktop/mobile layout and WCAG checks.
9. Theme bootstrap does not create a hydration error.
10. Reduced-motion and reduced-transparency fallbacks exist.
