# Theme hydration hygiene

The persistent-twin release gate exposed a pre-existing SSR/client theme mismatch.

## Root cause

`ThemeProvider` initialized from `document.documentElement.dataset.theme` on the client while server rendering always used the default SE theme. The early bootstrap script could set Light/Dark before React hydration, so the initial client component tree differed from the server tree.

## Fix

The provider now uses `useSyncExternalStore`:
- server snapshot: deterministic SE default;
- hydration snapshot: same deterministic value;
- post-hydration browser snapshot: persisted `data-theme`;
- explicit theme changes dispatch a local theme event;
- storage events synchronize cross-tab changes.

The early bootstrap can still paint the stored theme before React for visual continuity without changing the first React render tree.

## Verification

- Theme persistence scenario: PASS.
- Iconography theme scenario: PASS.
- Full Chromium showcase: 17/17 PASS.
- No React hydration mismatch emitted in the final full showcase run.
