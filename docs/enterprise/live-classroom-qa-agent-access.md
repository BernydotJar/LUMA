# LUMA autonomous QA — staging-only agent access and release boundary

## Scope of authorization

Grant the QA agent **read/write access to feature/test branches** in `BernydotJar/LUMA` and `BernydotJar/Graph-harness-sdlc`, ability to fetch PR/review/CI status and invoke non-production GitHub Actions, and authority to run Playwright, Chromium, Firestore Emulator, synthetic users and isolated LiveKit Cloud QA. It may create commits and PRs, fix defects and rerun checks without one-by-one approval.

Never grant permission to force-push protected branches, disable checks or required reviews, impersonate an independent reviewer, spend money or change production environments/flags. Keep `main`, Firebase production, Cloudflare live host, payment APIs and GitHub `production` deployment environment behind distinct approvals.

## Current verified capabilities and gaps

- Audited Cloud Sandbox Git push to the existing QA branch works, as does GitHub connector read/admin authorization; `gh auth status` in the workstation reported an invalid CLI token. Prefer audited tools and do not print tokens.
- Node, Firebase CLI, headless Chromium/Playwright and local Firestore emulators are operational. Only the existing `luma-learning-intelligence` Firebase project was visible from the CLI; it is NOT designated staging here.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are not injected into this QA workspace. An actual independent LiveKit Cloud QA project is NOT yet authenticated.
- PR #75 already contains a `workflow_dispatch` Cloud media workflow targeting environment `livekit-acceptance`; the workflow exists on an unmerged branch, so this does not imply it is executable from GitHub's default branch.

## Protected staging bootstrap — no production credential reuse

1. Provision/identify a **distinct Firebase staging project**, with synthetic institution, instructor and learner accounts and staging-only service principal scopes. Configure revocation, tenant/cohort roles, Firestore rules/indexes and a retrievable deployed source SHA.
2. Provision/identify a **dedicated LiveKit Cloud QA project** with appropriate quotas/room limits and an explicit review of room auto-create, webhook secret, token TTL/cutoff and spending cap. No automatic purchase is authorized.
3. Configure the protected GitHub environment named `livekit-acceptance` with secrets `LIVEKIT_CLOUD_TEST_URL`, `LIVEKIT_CLOUD_TEST_API_KEY`, `LIVEKIT_CLOUD_TEST_API_SECRET`. Use environment reviewers for secret-bearing dispatch; do **not** expose to arbitrary pull_request code. Inject Firebase staging credentials using a separate workload identity limited to that staging project, not long-lived production JSON keys.
4. Bootstrap the reviewed Cloud QA workflow on default branch by a separately approved **CI-only change**. Execute only trusted pinned code/SHA in the secret-bearing environment. CI on untrusted PRs remains secretless.
5. Collect isolated user session reports, track subscribe/publish evidence, signed webhook and original/refreshed-token replay, Firebase business state, attendance and Graph Harness per-action proofs. Remove test accounts and rooms after the authorized run.

## Reproducible current controls

Run `npm ci --no-audit --no-fund`, `npm run lint`, `npm run typecheck`, `npm run test:run` and `CI= PLAYWRIGHT_PORT=3188 npm run test:e2e -- e2e/live-classroom-auth.spec.ts` (the last test uses a local Next.js server and proves only guest denial). Use Java 21 and `demo-` Firestore Emulator projects for persistence tests.

Pin Graph Harness PR #5 SHA `b3e991eaff98822defdd20287fa110586953abde`, then run:

    PYTHONPATH=/path/to/pinned-graph-harness python3 -m graph_harness product-acceptance --manifest docs/enterprise/live-classroom-acceptance.json --evidence evidence/live-classroom-acceptance/proofs.json --repo-root . --source-revision "$(git rev-parse HEAD)" --pretty

A `NO_GO` exit code is a valid product-protection outcome, not a tool error to suppress. The source, UI, customer journey and published runtime SHA must all be proven for every P0 action; no same-agent independent signature. Create a PR with red/green defect cases, reproducible artifacts and an explicitly gated release decision.
