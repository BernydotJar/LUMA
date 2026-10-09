# LUMA V2.1 — Enterprise Learning Product Graph
**Engineering requirements, generic reference · Not a customer contract**

## Outcome contract
Move from consumption-first lessons toward personalized, evidence-supported adult learning. Preserve a partner's existing checkout and modes of delivery. Adapt teaching to the learner's prior knowledge, use guided questioning, require observable practice and distinguish measured learning from business causality.

## Runtime boundaries
```text
Commerce provider
   ↓ verified event, idempotency, retry
Entitlement & purchase identity
   ↓ verified enrollment
Program offering: live | asynchronous | hybrid
   ├─ live: cohort / trainer / session / join URL / recordingPolicy
   └─ async: content / practice / supported tutor
                 ↓
Learning evidence → Learning Twin (coach scoped) → intervention
                 ↓
Cohort-level adoption and outcomes with traceable denominators
```

**Rules:** Payment is not mastery. Attendance is not mastery. A diagnostic is not mastery. A sampled coach API is not a whole-organization statistic. Recordings are never assumed for live sessions. A voice/AI outage cannot revoke a valid entitlement. No raw internal data or graph implementation labels in user-facing surfaces.

**Current privacy boundary caveat:** The publicly reachable `/studio/learners/mariana` example renders non-production example evidence without role checks. Coach-only access describes the required real-data product boundary, not the present public showcase behavior. Before connecting any real learner data, require authenticated, tenant-scoped coach authorization at the server and secure evidence exports. Treat this as a blocking security gate, not a cosmetic copy adjustment.

## Surface contracts
| Role | Job to be done | Explicit exclusions |
| --- | --- | --- |
| Learner | Start at useful point, practice, review next step; see entitled upcoming live sessions | No internal graph, QA gates, AI prompt/version labels, invented completion |
| Coach | Review authorized evidence, uncertainty and supported interventions | No unsupported diagnosis, no unverified sample-to-population extrapolation |
| Administrator | Manage program and cohort, eligibility and session policy | No cross-tenant access or unlogged entitlement adjustments |
| Executive | Compare measured access, usage, capability and behavior outcomes | No claim of causal revenue uplift without causal study |

## Proposed Graph Engineering workstreams
| Node | Depends on | Boundary and release gate |
| --- | --- | --- |
| LUMA-063 — Enterprise CX/data integrity | LUMA-059 | No missing-as-zero management data; CI, a11y and independent review |
| LUMA-064 — Live schedule continuity | LUMA-058, 063 | Distinguish authorized empty, unavailable and denied; safe retry and cross-cohort tests |
| LUMA-065 — Provider activation | LUMA-057 | One verified test purchase → mapping → entitlement → active enrollment; refunds and retries |
| LUMA-066 — Program operations | LUMA-058, 065 | Scoped admin RBAC, audit, sessions/coach controls and no automatic live recording |
| LUMA-067 — Engagement outcomes | LUMA-059, 065 | Real telemetry, denominators, trend freshness, coach confirmations and privacy |
| LUMA-068 — Operational proof | LUMA-061, 062 | Tested load/soak, backup/restore, RPO/RTO and evidence-based commercial obligations |
| LUMA-069 — Optional media and voice | LUMA-060 | Permissioned source provenance, licensing, consent, revocation and fallback |

These IDs specify proposed work boundaries only; do not mark them approved until independent evidence exists.

## Acceptance paths
**Live:** Given an eligible learner belongs to cohort A, when the authenticated schedule is read, only cohort A's session details and valid HTTPS join URL may be returned. If the service fails or returns malformed 2xx data, show an explicit recoverable error; do not fabricate an empty agenda. Live recordings are optional by explicit offering policy.

**Evergreen:** Given an active mapped purchase, the learner sees a relevant objective, practice and grounded guidance; no fake live session is created. Progress is updated only by an appropriate learning event.

**Commerce:** Verified provider events must be durable and replay-safe. Refund of purchase X cannot revoke distinct active purchase Y. Checkout redirection alone does not confer entitlement.

**Administration:** A global admin-only API must not be presented as tenant-scoped administration until server-side tenancy authorization and audit trails are implemented.

**Quality:** Producer → Critic → Fixer → Independent Verifier (unit, emulator, browser, build, security, a11y) → Release Gate → Evidence. Never merge/deploy on red gates, and never claim a client pilot without actual acceptance data.

## External dependencies and proof
Merchant credentials, signed provider sandbox events, resource ownership, permissioned content, data processing terms, support agreement, exact concurrency workload, financial assumptions and SLOs are deployment-specific inputs; no guessed figures belong in this public engineering document.

Private discovery interview material remains outside this public repository.
