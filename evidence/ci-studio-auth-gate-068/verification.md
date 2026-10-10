# LUMA-068 — Independent verifier

## Incident and repair

The `main` production workflow (run `38088552918`, browser job `114320374253`) refused deployment on a Playwright `strict mode violation`. The unscoped `getByText` selected two instances of the Studio login prompt. The application remained safe because the pipeline failed closed. No evidence supports a change to product authentication.

The producer replaced a global text assertion with a semantic `role=status` region, constrained by an accessible expected heading. The assertion still requires a **visible** heading and a login link to `/login`. Negative assertions for fabricated metrics remain unchanged. No product code, auth or CI policy changed.

## Reproducible evidence

| Gate | Artifact | Observed outcome |
| --- | --- | --- |
| Targeted stress | `stress.log` | **24/24 PASS** (12 Chromium desktop and 12 mobile) |
| Entire browser E2E suite | `full-e2e.log` | **117 passed, 7 skipped, 0 failed** against previously verified production standalone Next server |
| Lint | `lint.log` | **PASS** |
| TypeScript | `typecheck.log` | **PASS** |
| Unit | `unit.log` | **291 passed**, 52 emulator tests skipped as expected |
| Independent IBM Granite reviewer | `granite-critic.md` | **PASS**; review of the actual test diff; no blocker |

Skipped unit emulator tests are separately validated in GitHub CI and not interpreted as local PASS. The local E2E runner did not use `CI=true`; the authoritative `CI=true` no-flaky gate must still be run independently in the PR and following `main` workflow.

## Release decision

**PASS** for scoped software correction and independent-review gate. GitHub PR checks, post-merge release and `/api/version` verification remain separate mandatory gates and must be reported from their own evidence. Do not declare production success from this local verifier.
