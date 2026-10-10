# CI stabilization evidence and release boundary

## Baseline inspected

Repository: BernydotJar/LUMA. Base commit: 46546fc101f22120223557b9fc918c4332412a64.
Workflow run: https://github.com/BernydotJar/LUMA/actions/runs/38024906208.
The actual check names are verify, security, firestore, identity-roles, and browser.
The first four jobs succeeded. Browser reported 102 passed, seven failures, and seven pre-existing viewport-specific skips. Browser job: 114133576194. Its Playwright report artifact is 11659477602.

## Failure classification and repair

| Failure | Classification | Repair and retained coverage |
| --- | --- | --- |
| Adaptive loop, desktop and mobile | Obsolete editorial copy expectation | Check persisted 8/35-minute planner inputs; retain goal text, three distinct recommendations, and evidence-driven next-action assertions. |
| Prism on learner home, desktop and mobile | Obsolete object placement expectation | Assert one practice hero and orbit on /learn; assert prism on /experience, where experience-console actually renders it; retain Studio object and access checks. |
| Mobile single-active Studio navigation | Wrong navigation region plus real missing product state | Select the visible mobile navigation, open More for secondary routes, and mark secondary links with the same most-specific aria-current logic as primary links. Assert exactly one selected, visible destination. |
| Mobile certificates | Obsolete direct-primary-navigation assumption | Open More; retain destination visibility, five links, tap-target width, overflow, actual navigation and persistent LUMA access checks. |
| Mobile header exploration | Desktop-only control queried on mobile | Exercise the visible Programa destination on mobile and header exploration on desktop; assert href and actual destination. |

No test was deleted. No new skip or continue-on-error was added. The original five-job workflow remains unchanged in this CI-only change set.

## Scope and infrastructure boundary

This change set is deliberately the CI repair slice, not a completed production release pipeline. It must be evaluated by all five existing GitHub Actions checks. A successful result here is not proof of deployment.

During the wider assignment, an isolated worktree was created at /workspace/projects/LUMA-cicd-enterprise-20261009, branch feat/cicd-enterprise-20261009, without changing unrelated work in the main checkout. Draft release workflow, immutable version manifest, source packaging, keyless deployment orchestration, smoke verification and rollback guards were written there. Eleven initial release-policy unit tests passed using Node's test runner; those tests do not establish end-to-end deployment readiness. The draft requires integration with the repository's Vitest configuration and complete validation before publication.

The Cloud Sandbox MCP session subsequently returned error 32600, Session terminated. The CI repair slice was preserved through the independently available GitHub connection. Do not overwrite or discard the isolated worktree when restoring access.

At live discovery, main was not protected and no repository rulesets were returned. Firebase backend luma in project luma-learning-intelligence, us-central1, served build-2026-10-10-001 at 100% traffic. The rollout was SUCCEEDED and the build READY, but the archive-sourced build exposed no verified Git SHA. No backend replacement, production deployment, IAM grant, branch rule or traffic change was performed in this assignment.

## Release decision

Enterprise production release: BLOCKED. Outstanding: complete CI result for the new commit; enforced branch protection after reliable CI; live Workload Identity Federation and least-privilege deployment identity; validated deployment workflow; Granite adversarial review; Graph Harness append-only evidence and release gate; exact production SHA and smoke verification; safe rollback validation. None of those outstanding gates is represented as PASS by this document.
