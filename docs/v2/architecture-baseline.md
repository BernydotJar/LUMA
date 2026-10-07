# LUMA V2 Architecture Baseline — Post Client Meeting

## Current verified baseline
The V2 starting point combines the current production main line with the completed Class Intelligence release and the gated CX/RAG integration. The combined codebase passes lint, typecheck, 73 executed unit/integration tests, and the Next.js production build.

## Target domain flow
```text
Hotmart ----\
             -> Commerce Provider -> Normalized Commerce Event -> Entitlement -> Enrollment -> LUMA
Stripe -----/                                                        |
                                                                       +-> Learning Twin
                                                                       +-> AI Coach
                                                                       +-> Coach Intelligence
```

## Architecture boundary
Learning code must not know whether access originated in Hotmart, Stripe, manual enrollment, enterprise bulk enrollment, scholarship, or migration.

## V2 engineering order
1. Commerce domain contract and normalized events.
2. Idempotent provider-event ledger.
3. Entitlement lifecycle.
4. Hotmart adapter.
5. Stripe adapter.
6. Provider-agnostic observability and correlation IDs.
7. Capacity/security/cost gates for enterprise pilot.

## Release principle
Each material slice follows Producer -> Critic -> Fixer -> Independent Verifier -> Release Gate -> Evidence.
