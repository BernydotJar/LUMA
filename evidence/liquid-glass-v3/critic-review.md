# Liquid Glass Functional Layer v3 — Critic Review

## Review posture

Attempt to disprove that this change improves LUMA's material hierarchy without turning Liquid Light into decorative glassmorphism, weakening accessibility, or adding unnecessary rendering cost.

## Findings

### 1. Glass was overused on dense content — fixed

The v2 baseline passed its original harness but still produced excessive backdrop coverage on information-heavy surfaces: `/library` mobile reached 1.07 viewport-equivalents of backdrop-filtered area and `/studio` desktop reached 0.69. That is visually and computationally inconsistent with the product contract that content should remain dominant.

v3 introduces `content-surface` for dense learning, tutor, twin, studio, and library panels. Backdrop-filtered `.glass` remains on navigation/control layers and the bounded optical showcase.

### 2. The new hierarchy could have become a flat-card regression — checked

The content surfaces retain theme-specific borders, depth, directional inset light, and solid premium material. They are not plain unstyled cards. The standalone browser smoke confirms the surfaces render in Liquid Light without overflow or runtime errors.

### 3. Refraction could waste compositor/GPU work — fixed

The static refraction layer no longer uses `will-change: filter`. Paint containment is bounded to the preview and lens. The displacement map is regenerated only when measured lens/root geometry changes.

### 4. Reduced transparency previously hid optics but still allowed map work — fixed

The React effect now watches `prefers-reduced-transparency: reduce` and short-circuits before displacement-map generation. The existing opaque CSS fallback remains in place.

### 5. Optical tuning changed while the regression test pinned the old blur — fixed

Liquid Light now uses a restrained 16px blur with 1.08 saturation. The old E2E test hard-coded 18px. The test was updated to assert the v3 contract and a second cross-route case now verifies that dense `content-surface` panels have `backdrop-filter: none`.

### 6. Verification could collide with an already-running LUMA process — fixed

Playwright previously hard-coded port 3100. `PLAYWRIGHT_PORT` now permits isolated verification without terminating another LUMA runtime.

### 7. Standalone full audit waited indefinitely for `networkidle` — bounded, not hidden

The 42-scenario audit passes against the isolated application runtime. Re-running the same network-idle sweep against the standalone server timed out before emitting matrix results, so that attempt is preserved as `standalone-networkidle-timeout.log` and is not represented as a PASS. A separate standalone browser smoke uses `domcontentloaded` and verifies four representative routes with HTTP 200, zero console/page errors, zero failed responses, zero overflow, and zero nested glass.

## Quantitative result

| Surface | v2 baseline coverage | v3 coverage | Result |
| --- | ---: | ---: | --- |
| `/library` mobile | 1.07 | 0.23 | materially reduced |
| `/library` desktop | 0.86 | 0.25 | materially reduced |
| `/studio` desktop | 0.69 | 0.24 | materially reduced |
| `/learn` desktop | 0.41 | 0.32 | reduced |

The stricter v3 harness allows at most 0.95 backdrop coverage and 14 active backdrop-filtered elements. All 42 audited combinations pass with zero blocking findings.

## Residual risk

SVG displacement remains browser-engine-sensitive. Chromium desktop/mobile are verified; Safari should still receive a manual visual parity check before claiming pixel-identical refraction across engines. This is a rendering-parity risk, not a functional release blocker.

## Critic decision

**PASS.** The change improves hierarchy and rendering discipline without violating the bounded-refraction, accessibility, or interaction contracts.
