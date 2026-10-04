# SPEC 013 — Theme-Aware Iconography and 3dicon Pipeline

## Outcome

LUMA owns a premium semantic iconography system with six stable meanings and three material expressions.

## Semantic IDs

- practice;
- progress;
- coach-insight;
- human-intervention;
- voice;
- video.

## Delivery tiers

### Tier 1 — deterministic SVG

- source-controlled;
- accessible fallback;
- six icons × three themes;
- no provider dependency;
- available in production.

### Tier 2 — approved generated still

- exactly one still per review cycle;
- Product Owner approval receipt;
- no text, people, mascots, emoji or childish ed-tech cues.

### Tier 3 — animated WebP

- uses the approved still;
- motion approval required separately;
- seamless loop;
- true alpha;
- static reduced-motion fallback;
- verifier evidence.

## Upstream pipeline

Reference implementation:

- `samyost1/3dicon`;
- MIT license;
- local reference checkout `/workspace/projects/3dicon`.

LUMA maintains separate:

- prompts;
- source-concept mapping;
- model/provider receipts;
- approvals;
- output hashes;
- release evidence.

## Theme-specific materials

### SE

Blue, transformation pink, plum and high-white highlights.

### Liquid Light

System white, active blue, teal, violet and low-chroma refraction.

### Nocturne

Aubergine, champagne, burnt orange, sage and ivory.

## Gemini bridge

The prompt pack supports generation in an authenticated Gemini image session. The private host-browser bridge has now been verified and one SE Practice/P.A.S. still has been generated. The still remains a review candidate; deterministic SVG assets remain the published baseline until the Product Owner approves the still and, separately, the proposed motion.

## Acceptance criteria

1. `public/iconography/manifest.json` lists all themes and icons.
2. Eighteen SVG assets exist.
3. `/iconography` previews the current theme set.
4. All assets are decorative when used beside accessible text.
5. The still-approval and motion-approval gates are documented.
6. `prefers-reduced-motion` has a static fallback strategy.
7. Generated assets cannot replace semantic meaning without review.
8. Upstream MIT attribution is documented.
