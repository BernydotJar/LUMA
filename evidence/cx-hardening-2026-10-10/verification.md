# CXH-001 — Verification ledger (2026-10-10)

**Work branch:** `feat/cx-hardening-20261010` (derived from `main` `7daba30`).
**Source change:** responsive mobile hero spacing + CTA scroll margin + bottom-nav iOS safe-area behavior, with geometry regression tests.

## Baseline — pre-change, public guest surface

See [baseline.json](baseline.json). Playwright headless Chromium, touch emulation, DPR 2, production `https://luma.lch-app.cloud/learn` (HTTP 200).

| Viewport | CTA Y range | Nav Y range | Result |
| --- | --- | --- | --- |
| 390×844 | 747.375–796.375 | 762–834 | **FAIL:** 34.375 px overlap |
| 428×926 | 712.75–761.75 | 844–916 | PASS |
| 360×740 | 755.531–804.531 | 658–730 | CTA below fold; scroll required |
| 320×568 | 828.125–877.125 | 486–558 | CTA below fold; scroll required |

No horizontal overflow was observed in these guest baseline viewports.

## Proposed fix and scope

The patch **does not** change the learner's primary action semantics, navigation destinations, evidence model, auth policies, Firebase runtime or theming. It only:
- decreases excessive mobile whitespace above the primary CTA while maintaining readable typography,
- keeps a tappable practice CTA and scroll margin,
- positions the fixed nav relative to the device safe-area inset and preserves bottom scroll space.

An **in-browser CSS override simulation only** on the deployed guest page gave CTA bottom **675.3125 px** and fixed nav top **762 px** at 390×844, about **86.6875 px** clearance. This is a design sanity check, **not an acceptance result** from the patched build. After-build measurement must populate `after.json` with real browser evidence.

## Tests initiated

- **TypeScript:** PASS (`npm run typecheck`, dependencies from compatible installed workspace).
- **Targeted ESLint:** PASS (`npx eslint e2e/mobile-cta-occlusion.spec.ts`).
- **Vitest:** PASS, **291 passed, 52 skipped** in 58 files. Skipped emulator tests require their own provider/emulator gate and are not considered complete.
- **CSS parse:** PASS for all three modified CSS modules.
- **Git whitespace:** PASS (`git diff --check`).
- **Browser regression:** `e2e/mobile-cta-occlusion.spec.ts` authored; execution on exact patched production build **PENDING** GitHub Actions.
- **Role actor test:** BLOCKED for real QA actors until approved tenant/test identity scope is provided; emulator checks remain in roadmap.
- **A11y and Web Vitals:** NOT EXECUTED in this phase.

## Gate result

- **G0 (reproduction): PASS**
- **G1 (mobile correction): IMPLEMENTED / NOT YET VERIFIED ON EXACT BUILD**
- **G2–G5:** QUEUED or BLOCKED per canonical acceptance matrix
- **Merge/deployment:** **NOT APPROVED**. Use GitHub draft PR / exact-SHA CI.

All subsequent tools must preserve current product behavior and continue the P0 → P1 order in [PRIORITIES.md](../../docs/product-experience-hardening/PRIORITIES.md).
