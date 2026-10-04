# 3dicon Upstream Audit

- Upstream: `samyost1/3dicon`
- Local checkout: `/workspace/projects/3dicon`
- Commit reviewed: `9539d3a79ae6937205bf44f6b102af5ea15b9d49`
- License: MIT
- Skill reviewed: `skills/3dicon/SKILL.md`

## Pipeline reviewed

1. generate a still;
2. use the same still as first and last frame;
3. generate motion;
4. remove a known backing color;
5. encode animated WebP with alpha.

## LUMA controls added

- source-concept mapping;
- three theme prompts;
- exactly-one-still review gate;
- separate motion approval gate;
- static reduced-motion fallback;
- output hash and verifier receipt;
- no provider credential stored in the repository.

## Environment finding

The current LUMA sandbox has no configured supported image-provider API key and the sandbox Gemini browser session is unauthenticated. Automated generated still production remains gated. The deterministic SVG baseline is release-ready.
