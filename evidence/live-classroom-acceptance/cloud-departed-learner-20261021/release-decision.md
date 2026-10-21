# LUMA release decision — provider QA vs product acceptance

Provider detached-token regression: PASS (18/18 on real LiveKit Cloud).
Integrated source lint/TypeScript: PASS; unit suite: 473 passed, 107 skipped.
Current GitHub Actions manual Cloud QA: NOT RUN (QA environment 0 secrets).
A real deployed Firebase staging instructor + two learners UAT: NOT RUN.
Graph Harness product acceptance: NO_GO, 20 critical actions/82 blockers.
Production decision: NO-GO. main merge, prod Firebase and LiveKit feature flags
must remain separately approved. No approval is represented by this document.
