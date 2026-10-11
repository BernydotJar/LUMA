# Post-merge release-gate incident — Studio auth locator

## Impact

GitHub PR #40 was successfully merged into `main` at `79f9452`. The `push` workflow correctly refused to deploy because its mandatory browser test was flaky (`116 passed`, `7 skipped`, `1 flaky`). Firebase `/api/version` still reported the earlier stable commit `7daba30` immediately after the blocked run.

## Source evidence

GitHub Actions run `38088552918`, `browser` job `114320374253`, step `Run npm run test:e2e`:

- `Error: strict mode violation: getByText(/Accede para consultar a tus participantes/i) resolved to 2 elements`
- Both matches were identical `h2` headings inside page content.
- The preexisting test selected global text, without scoping it to the unauthenticated Studio status region.
- Playwright CI configuration sets `failOnFlakyTests` to true; one flaky retry counts as a failed job.

## Repair strategy

Use semantic accessibility roles rather than `getByText` globally. The narrowed test must still fail if the access prompt is absent or invisible, if the login link does not exist, if it points anywhere but `/login`, or if fabricated evidence/metrics appear.

The code change is intentionally limited to the test file. No auth policies, Graph runtime, CI permissions, release policies or frontend behavior are altered.

## Delivery control

- Tests and append-only Graph Harness evidence: validate before pushing.
- Open a small PR against `main`, require all checks, merge without bypass.
- Verify the consequent production pipeline's exact SHA, health and smoke. Do not present merge as deployment.
