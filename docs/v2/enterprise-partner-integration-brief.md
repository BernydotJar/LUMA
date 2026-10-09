# LUMA — Enterprise Partner Integration Brief
**Public, reusable product reference · 2026-10-09**

## Product decision
LUMA is an evidence-centered learning experience that can coexist with an existing checkout provider and an existing instruction model. Organizations may operate synchronous, asynchronous or hybrid offerings without migrating sales infrastructure or requiring recordings of live workshops.

This document deliberately omits customer-specific conversations, negotiated fees, program names, individual pricing, private content and commercial commitments. Those belong in restricted commercial records.

## Operating models
| Mode | Keeps | Adds |
| --- | --- | --- |
| Live cohort | Instructor-led sessions, scheduled meetings, human participation, no default recording requirement | Cohort-based access, timezone-aware agenda, evidence and coach follow-up |
| Evergreen | Self-paced published material and outside checkout | Contextual learning, practice, review and non-intrusive engagement |
| Hybrid | Explicit live and self-paced components | One evidence model with distinct event semantics |

### Purchase → access architecture

```text
Existing checkout provider / optional alternative
           ↓ authenticated provider webhook
       Normalized purchase event
           ↓ durable idempotent ledger
       Product/tenant/cohort mapping
           ↓
       Entitlement (right to access)
           ↓ verified learner enrollment
          +----------------------+
          |                      |
    Live cohort              Evergreen
   Session & coach          Practice & tutor
          +----------------------+
                   ↓
       Learning evidence, coach support
                   ↓
       Adoption and observable outcomes
```

**Invariant:** payment ≠ entitlement ≠ enrollment ≠ attendance ≠ mastery.

## Roles and outcomes
- **Learner:** appropriate starting point, immediate action, contextual explanation, practice and next step.
- **Coach:** authorized evidence, uncertainty, timely intervention and learner-specific context.
- **Program administrator:** product mapping, cohort schedules, learner rights, exceptions and support.
- **Organization:** adoption, evidence coverage and actual cohort outcomes; never present sampled counts as totals.
- **Internal engineering:** versioning, graph topology, release receipts, security checks and incident detail.

## Capability status and dependencies
The LUMA source tree includes provider-neutral commerce adapters, a durable event ledger, purchase identity, product mapping, effective enrollments, live/hybrid/async program delivery, scheduled sessions and sample-based coach interventions.

**This is code-level implementation evidence, not confirmation** that any particular merchant account is activated, provider webhook is configured in production, contractual service level is signed, or a third-party organization is using the product.

When a schedule API is unreachable, malformed or denies access, the learner must not see a misleading zero. When a real authorized API returns an empty list, it may legitimately indicate no sessions are scheduled.

Media indexing and AI voice are independent, optional features. Source rights, voice permissions, privacy and learner opt-out must be established before activation.

## Enterprise evaluation criteria
| Concern | Required proof |
| --- | --- |
| Checkout interoperability | Signed webhook in provider test mode; idempotent replay; product/cohort mapping; refund, renewal and cancellation tests |
| Pricing | Quoted provider contract plus infrastructure consumption and support model; fixed fee vs monthly active learners assessed with real forecasts |
| Financial settlement | Provider's official local account/currency/payout terms verified separately; LUMA must not promise bank settlement |
| Concurrent use | Load profile distinguishes registered people, monthly active learners, simultaneous API requests, media streams and voice compute |
| Data control | Controller/processor agreement, retention and deletion, role-based access, tenant isolation, restoration and ownership |
| Availability | Defined SLO and measured recovery; 99.9% is a target only until independently tested and contractually specified |
| Educational outcomes | First-value time, practice completion with rubric, independent ability recheck, engagement and coaching intervention logs |

A provider's cloud certifications do not automatically certify the application.

## Safe delivery order
1. Preserve checkout and mapping correctness.
2. Demonstrate effective program access with verified learner identity.
3. Validate live-session agenda reliability and cohort isolation.
4. Offer coach intervention with truthful missing and partial states.
5. Instrument adoption and learning outcomes before displaying business claims.
6. Run capacity and recovery proof before committing to commercial SLAs.

The public UI describes goals, evidence and next actions. Private delivery graph IDs, prototype assets, raw storage inventories, prompt/pipeline versions and release checks remain internal.
