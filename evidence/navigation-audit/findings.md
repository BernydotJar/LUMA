# LUMA navigation and notification adversarial findings

## Confirmed

- P0: Studio navigation previously used prefix matching and could highlight `/studio` simultaneously with `/studio/certificates`, `/studio/class-intelligence`, and `/studio/reflections`. Fixed by choosing only the most-specific route.
- P1: `AppShell` on the checked main branch has search navigation and `AccountMenu`, but no Bell or notification component or retrieval pipeline. The bell shown in the user screenshot therefore differs from checked-in main. Notification delivery, unread count, and mark-as-read are **not verified** and must not be treated as implemented.
- P2: Search control is a navigation shortcut to library/experiences, not a global searchable popover.
- P2: Role switch is independent from theme switch, but the visual treatment creates similar selected-state emphasis for both; this can be confusing and needs UX review.
- P2: Hash anchor links are intentionally excluded from path-based active navigation; deep-link state should be tested independently.

## Verification

- Added dedicated Playwright regression for singular active navigation on coach routes.
- App build, E2E and full visual audit require a clean CI run before merge.
- Do not add a decorative notification badge, fabricate unread counts, or claim functional notifications without an authenticated backing service and tests.
