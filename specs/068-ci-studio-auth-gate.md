# LUMA-068 — CI strict-locator hotfix for unauthenticated Studio gate

## Reason for change

Merged release `79f945292f6db3fb6ed6201abbffe02a33662de3` passed PR #40 quality checks but did not deploy. The `main` push GitHub Actions run `38088552918`, job `114320374253` (`browser`), failed the Playwright test `e2e/enterprise-boundary.spec.ts:31`. The default `CI=true` setting rejects flaky tests. CI reported `116 passed`, `7 skipped`, `1 flaky` and exit code `1`, preventing production promotion.

## Root cause and scope

The assertion `getByText(/Accede para consultar a tus participantes/i)` matched *two* identical `<h2>` elements. Playwright strict locators cannot choose between them. This is a test selector ambiguity observed during route rendering/hydration, not evidence of an authentication bypass, server failure or incorrect product text.

Change only the E2E locator: constrain to a semantic `role="status"` authentication gate that contains the expected accessible heading, choose one of the duplicate gate instances, verify the heading is visible and verify the nested login link still targets `/login`. Keep the negative checks that forbid fabricated metrics.

The product's authentication, permission model, code paths and output must remain unchanged.

## Quality and release contract

- Producer: one test-only locator edit; no app runtime, API, auth or CI policy changes.
- Independent critic: inspect that the narrower scope is not weakening the assertion and that a missing/login-incorrect state still fails.
- Independent verifier: targeted Chromium/mobile test repeated at least 12 times each, complete browser E2E suite, lint and TypeScript, and repeat CI on a pull request.
- Gate: record actual immutable files and SHA-256 in the append-only Graph Harness ledger; never reset or rewrite historic events.
- Release: merge only after GitHub workflow checks pass. The deployment on `main` must subsequently pass `deploy`, smoke, rollback-validation and `/api/version` SHA verification. Graph DONE for this node certifies the test fix, not that Firebase is already running it.

## Evidence

- Prior failing GitHub Action: `https://github.com/BernydotJar/LUMA/actions/runs/38088552918/job/114320374253`
- Local targeted stress: `evidence/ci-studio-auth-gate-068/stress.log`
- Full Playwright: `evidence/ci-studio-auth-gate-068/full-e2e.log`
- Lint/TS/unit: files under `evidence/ci-studio-auth-gate-068/`
- Adversarial review and Graph receipt: files under `evidence/ci-studio-auth-gate-068/`
