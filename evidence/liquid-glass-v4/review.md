# Liquid Glass v4 - functional material consistency

Reference: Glass-HQ/liquid-glass (React/WebGPU v0.0.1); evaluate its optical behaviors without adding the dependency globally due to Safari/WebGPU constraints.

## Producer

Converted dense information surfaces in persistent Learning Twin, visual Twin detail, reflections, practice sessions, and content intelligence search from `.glass` to `.content-surface`. Replaced glass-tinted gradient base in reflection and Twin CSS modules with solid theme-aware `--surface` token. Functional sidebar, mobile navigation, control buttons and bounded optical preview remain unchanged.

## Critic

Risks: baseline global `.content-surface` styles must be confirmed across themes; programmatic conversion does not prove visual parity on Safari. No claims of GPU/frame-time improvements without profiling. Do not promote WebGPU SDK globally until cross-engine verification. No auth, payments, routes or API modifications.

## Verification

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run test:run`: 158 passed; 44 emulator tests skipped
- `npm run build`: INCOMPLETE (process exit 137, resource limit); no build PASS claim
- Glass adversarial and browser visual parity: PENDING

## Gate

REVIEW_REQUIRED: do not merge into main or deploy until build and browser gates complete.

## Unified Optical System v4, second-pass implementation

The initial v4 material migration was already present in upstream `main` on 2026-10-09. This extension builds on the then-current upstream code, retaining the newly merged enrollment, certificate and mobile navigation features.

### Producer changes

- Added distinct theme-aware, reusable content/control/popover/rim/blur/focus optical tokens; information surfaces now use opaque `--content-fill`.
- Removed the 26px full-panel blur and additional small backdrop filters from the learning pulse while retaining the progress visualization.
- Unified account popover and global experience controls; implemented reduced-transparency/high-contrast fallbacks and keyboard focus return.
- Replaced a nonfunctional search button with a Library link and removed a placeholder notification control that lacked a destination or data.
- Introduced isolated `/preview/optical-lab`: Regular/Clear/Content material selector, the established SVG DOM-clone lens, reduced-transparency state, and WebGPU capability detection without loading Glass-HQ.
- Added `e2e/liquid-glass-v4.spec.ts`, optional Playwright WebKit project, and extended the static adversarial route list from 7 to 14.

### Critic and independent verification boundaries

- Material-token integration is low risk to backend behavior but still needs real visual tests under all three themes.
- The Optical Lab checks WebGPU adapter availability only; it does not exercise a WebGPU lens engine. Do not advertise WebGPU effects as implemented.
- Existing adversarial script tests anonymous state for protected paths; authenticated journeys require separate E2E fixtures.
- Browser screenshot parity, real iOS Safari, refresh/hydration visual stability, final Next build and real frame-time comparisons are **unverified** until evidence is attached.

### Release status

REVIEW_REQUIRED. This change is intended for a draft PR, not immediate main promotion. A local script timeout or OOM is not a passing gate.
