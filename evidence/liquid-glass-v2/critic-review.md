# LUMA Liquid Glass v2 — Critic review

## Review posture

Attempt to disprove that the Liquid Light upgrade is a production material improvement rather than a decorative glassmorphism regression.

## Findings

### 1. The old material was too milky — fixed

The former light theme combined a high-opacity white fill with a 28px backdrop blur. That read closer to frosted plastic than an optical lens. The v2 light material lowers fill opacity, reduces the default blur to 18px, and moves depth cues to directional inset rims and a restrained contact shadow.

### 2. Real refraction everywhere would be the wrong architecture — bounded

The reference technique is valuable, but duplicating large scenes and running displacement filters throughout the product would increase rendering cost and complexity. v2 therefore uses one bounded refractive lens only in the Liquid Light showcase preview. Ordinary learning surfaces remain CSS-only.

### 3. Refraction needed visible evidence — fixed

The first preview implementation had valid SVG displacement but insufficient structure crossing the lens, so the optical effect was difficult to perceive. A thin multicolor light ribbon now crosses the lens; its edge visibly bends while readable text remains outside the accessibility contract of the decorative clone.

### 4. Safari filter refresh risk on resize — fixed

The displacement map is regenerated only on mount/resize. The SVG filter id now changes only when that map is regenerated so engines that cache filter resources receive a fresh reference without introducing per-frame id churn.

### 5. Theme hydration mismatch — found and fixed

Testing with a persisted `light` theme exposed a pre-existing SSR/client mismatch in `ThemeProvider` / `BrandMark`. Theme state now uses `useSyncExternalStore`: the server snapshot remains deterministic while the client reads the bootstrap-selected DOM/localStorage theme after hydration. The targeted browser run no longer emits the hydration error.

### 6. Accessibility and hierarchy — pass

The refracted scene clone is decorative and `aria-hidden`; selected state is still a native button state; meaningful copy is not distorted; reduced transparency removes the refraction layer and preserves an opaque fallback.

## Residual risks

- The bounded SVG displacement path should still receive a manual Safari check before treating the optical effect as pixel-identical across engines.
- Refraction remains a showcase material, not a blanket mandate for every LUMA card.

## Critic decision

PASS. No blocking finding remains for the bounded Liquid Light v2 scope.
