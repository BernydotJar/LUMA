# LUMA V2 — Production Readiness, Capacity and SLA Gate

## Current runtime baseline

Firebase App Hosting is currently configured as a small pilot runtime:

```yaml
cpu: 1
memoryMiB: 512
minInstances: 0
maxInstances: 2
concurrency: 80
```

This is a deployment configuration, not a statement that 160 students, 1,500 students, or any number of active learners is supported. HTTP request concurrency, active learners, live-session concurrency, RAG traffic, voice workloads and media delivery have different load profiles.

## Core reliability boundary

A core-health response is successful only when:
- Next.js API runtime is responding;
- Firestore server persistence is reachable.

Optional systems are reported as capability configuration and do not control core commerce durability:
- Content Intelligence/RAG;
- SE Voice;
- Hotmart;
- Stripe.

This matches the architecture rule that an AI/voice outage must not discard a confirmed commerce event.

## Data boundary

`firestore.rules` denies all direct client read/write operations. Stateful product APIs operate through Firebase Admin on the trusted server boundary. Commerce webhooks are separately authenticated at the provider adapter boundary.

Before enterprise pilot:
1. verify IAM/service-account least privilege;
2. verify Secret Manager access bindings;
3. document retention/deletion requirements with the client;
4. document backup/restore objectives;
5. test export/restore of tenant data;
6. confirm regional/data-residency requirements contractually.

## LUMA-062 — required capacity/resilience evidence

The enterprise pilot gate must not pass until we have reproducible evidence for the target deployment tier.

### Load profile
Test at least:
- authenticated learner read/navigation traffic;
- learning-event writes;
- coach dashboard reads;
- commerce webhook burst/replay;
- Content Intelligence search;
- voice requests as a separately metered dependency.

Measure:
- p50/p95/p99 latency;
- error rate;
- Firestore contention/retry rate;
- instance count/cold starts;
- CPU/memory;
- external dependency timeouts;
- cost per active learner and per 1,000 operations.

### Soak
Run a sustained workload representative of a cohort day, not just a short peak.

### Failure injection
Demonstrate:
- duplicate webhook delivery;
- out-of-order webhook delivery;
- RAG unavailable;
- voice unavailable;
- Firestore transient error/retry;
- instance restart;
- provider retry after mapping was initially unavailable.

### Recovery
Establish and test:
- RPO;
- RTO;
- Firestore backup/export and restore;
- deployment rollback;
- incident ownership and escalation.

## SLA rule

A commercial SLA such as 99.9% should be offered only after:
- the SLO is precisely defined;
- the measured production-like workload meets it with margin;
- monitoring and alerting exist;
- exclusions/dependencies are documented;
- recovery procedures have been exercised.

Until then, 99.9% is a target, not an engineering guarantee.
