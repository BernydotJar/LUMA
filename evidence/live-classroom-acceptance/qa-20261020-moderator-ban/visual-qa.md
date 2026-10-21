# Visual QA — scope and exclusions

**Executed:** Playwright `e2e/live-classroom-auth.spec.ts` in separate desktop Chromium and mobile Chromium contexts, 4/4 passed against a local Next.js development server on an isolated loopback port. Assertions cover anonymous UI visibility and denial of guest access to media token, moderation, attendance and learning controls.

**Not executed:** authenticated instructor/student Liquid Glass dock interaction, audio/video tracks through the branded component, responsive screenshots at 375x812, 390x844 and tablet, 44px tap-target measurements, keyboard/screen reader accessibility, WebKit or iPhone hardware.

**Result:** PASS for anonymous access behavior only; enterprise actionable-UI acceptance remains BLOCKED. No screen design or rendered control is approved merely because its code exists.
