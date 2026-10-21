# Visual/interaction QA — Live Classroom

## Executed
- Playwright desktop Chromium: anonymous admission and control denial passed.
- Playwright Chromium using iPhone 14 emulation: the same two scenarios passed.
- Direct provider test: browser-created media elements decoded two remote video sources per connected participant.
- Both public hosts served a guest classroom route with HTTP 200.

## Not accepted as complete

**No authenticated branded LiveKit toolbar was inspected under real media state in this run.** Therefore the bottom Liquid Glass dock, iridescent finish, camera/microphone buttons, screen share, raised hands, moderation roster, focus order, 44x44 px touch targets, 375x812 and 390x844 safe areas, reduced motion, WebKit/mobile Safari and screen-reader usability are **NOT_TESTED**.

The existing CSS-only fixture is not an authenticated UI test. Source implementation, local fixtures, and direct LiveKit SDK browser tests cannot substitute for the real customer interface connected to Cloud.
