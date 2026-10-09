# Capacity, Concurrency and Cost Proof

**VERIFIED configuration:** Firebase App Hosting `cpu:1`, `memoryMiB:512`, `minInstances:0`, `maxInstances:2`, `concurrency:80`. These are resource settings, **not** a measured concurrent-learner figure. Learners, logged-in sessions, HTTP requests, live attendees, AI searches and voice streams have different bottlenecks.

| Question | Status | Evidence needed |
| --- | --- | --- |
| Total learners and programs | NOT YET VERIFIED | Real tenant volume, index/query/ownership and storage profile |
| Tested concurrent learners | NOT YET VERIFIED | Authenticated load profile, p50/p95/p99 and failure budget |
| Safe concurrent users | NOT YET VERIFIED | Verified headroom at production-like autoscaling |
| Autoscaling / first bottleneck | NOT YET VERIFIED | Step/burst/soak, cold starts, memory/CPU, Firestore and network |
| RAG and voice capacity | NOT YET VERIFIED | Distinct quota/latency/cost measurements per feature |
| Live attendance | NOT YET VERIFIED | External live provider contract and measured capacity |
| Backup and recovery | NOT YET VERIFIED | Actual export/restore and observed RTO/RPO |

## Cost per active learner

For N monthly active learners:

`total_cost(N) = hosting(N) + firestore_ops(N) + ai_tokens(N) + voice_minutes(N) + media_indexing(N) + storage(N) + egress(N) + monitoring(N) + backup(N) + support(N)`

| Monthly active learners | State | Output after load/meters |
| ---: | --- | --- |
| 100 | NOT YET VERIFIED | `total_cost(100)/100` |
| 500 | NOT YET VERIFIED | `total_cost(500)/500` |
| 1,000 | NOT YET VERIFIED | `total_cost(1000)/1000` |
| 5,000 | NOT YET VERIFIED | `total_cost(5000)/5000` |

Never treat 500 included active learners as a technical limit. Load-test authenticated reads, learning writes, admin/coach dashboards, bursts of signed/replayed webhooks, RAG searches, AI/voice timeout fallback and Firestore unavailability. Record resource utilization, operational costs and sustained cohort-like loads. LUMA-062 remains a blocking release gate for SLA/concurrency claims.
