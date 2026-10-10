# LUMA v4 source attestation drift — release incident

## Incident

After Seres Liquid Glass v4 and the Studio CI hotfix merged into `main` (`cabeae9029ca56aac468584394b1e19f64ce1339`), push run [38095030727](https://github.com/BernydotJar/LUMA/actions/runs/38095030727) passed `verify`, `security`, `firestore`, `identity-roles` and `browser`. The deployment job authenticated to Google Cloud but stopped at `verifyReview()` before any object upload/build/rollout.

The immutable workflow artifact `production-evidence-38095030727-1` reports:

- `RELEASE_FAILED: Source changed since independent review`.
- Earlier source approval: `4b0fc2faa433f2698d022a452690a1bcb6181b5976ba0ff82c1ad408cc90f9dd`.
- Actual current reviewed source: `7a52d3323e6fe905e9dbe39352bd5f443372e7f1958e3154167df550b3a16a52`.
- Recovery returned `Recovery refused: another release changed traffic` because the failed run had **not** recorded a previous/build target. The message is a failed recovery precondition, not independent evidence of an external traffic change.
- Live `/api/version` continued to report previously verified `7daba30e1469bda7b9198353d95f3f7db7b74ee1`; `/api/health` continued to pass.

No step in the initial failure created a new build or rollout. No deployment policy was disabled.

## Repair

Restore the source-bound release approval via an independent incremental review of exactly twelve changed source files and preserve the previously approved release-security baseline. Use successful protected PR #41 run [38094698864](https://github.com/BernydotJar/LUMA/actions/runs/38094698864) for CI-quality evidence, because its head commit `d2053fdc047e9b868dc90fe04687ccadd98afd01` has exactly the same reviewed source bytes as the merged `main`. A new Graph release gate and source attestation must be emitted only after the critic/verifier pass. Publication and production verification remain pending until a new `main` run succeeds.

## Non-goals

No manual deployment, weakened GitHub quality policy, relaxed `review-gate.mjs`, fictitious rollback event, ignored Granite finding, reset of Graph history, or claim of brand-owner approval.
