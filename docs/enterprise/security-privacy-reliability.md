# Security, Privacy, Reliability & AI Data Handling

| Topic | Classification | Required evidence |
| --- | --- | --- |
| Firebase Auth | VERIFIED (source) | ID token verification; live settings and issuer proof outstanding |
| Firestore rules | VERIFIED (repository) | Client deny-all; validate actually deployed rules |
| Hotmart and Stripe ingress | VERIFIED (code) | Hottok / timestamp HMAC; signed sandbox receipts required |
| Replay | VERIFIED (code) | Ledger and deterministic entitlement; run Firestore emulator gate |
| Coach/admin RBAC | PARTIALLY VERIFIED | Scoped APIs exist; public Twin example MUST NOT display real people |
| Tenant isolation | PARTIALLY VERIFIED | Commercial keys and coach scopes; cross-tenant penetration test / export audit required |
| Secret Manager/IAM/Cloud Storage | NOT YET VERIFIED | Live service-account scope, ACL, key rotation, bucket policy |
| Data ownership | NOT YET VERIFIED | Controller/processor DPA, export/exit, data residency, subprocessors |
| PII retention/deletion | NOT YET VERIFIED | Payment, evidence, transcripts, logs and voice purpose-specific schedules |
| RAG privacy | PARTIALLY VERIFIED | Source permission, tenant filtered retrieval and video timestamp accuracy validation |
| Voice | PARTIALLY VERIFIED | Explicit consent/license, secure storage, opt-out and fallback |
| Observability | PARTIALLY VERIFIED | Event correlation exists; alerts, reconciliation and audit access policy pending |
| Backup, recovery, incidents | NOT YET VERIFIED | Restore exercise, named incident owner, tested RTO/RPO, runbook |
| Contract SLA | NOT YET VERIFIED | 99.9% target only until workload, incidents and recovery can justify it |

## Conditions before real pilot

Verify provider test-mode activation, idempotent replay/refund/chargeback and out-of-order recovery. Audit every real-data UI/export for role/tenant constraints. Validate deployed Firebase rules, IAM, Secrets, HTTPS and storage. Define retention/deletion, deletion evidence, data controller and vendor DPA, AI data processing policy, source copyrights and voice consent. Exercise actual tenant restore and document observed objectives. Define service escalation and incident communication.

AI/RAG/voice downtime must degrade optional functions without losing a confirmed commerce event. Firestore/ingress downtime requires provider retries, monitoring and reconciliation; code-only tests are not an SLA.
