# LUMA-063 — Tenant/Program Learning Twin & RAG Isolation

Status: Source candidate implemented, independent review gate pending. Not an enterprise production approval.

## Problem

A verified Firebase UID can be enrolled in multiple courses or tenants, while the original learner state lives under `learners/{uid}`. Access checks alone cannot prevent a coach from seeing the state of a different program when downstream stores are global. A shared semantic RAG endpoint is not an acceptable boundary for proprietary multi-tenant content.

## Implementation contract

- Scope derives from Firebase identity, an active entitlement and tenant membership; never trust a supplied tenant header.
- Program selection may use `x-luma-program-id` only after current enrollment verification. Multi-program accounts require an explicit selection; invalid or unentitled program selections fail closed.
- Strict persistence uses `learningTenants/{sha256(tenant)}/learningPrograms/{sha256(program)}/learners/{uid}` with local event ID deduplication. No implicit global data migration/fallback.
- Coach list/detail/intervention routes validate tenant, program, UID and current enrollment before reading the scoped learning tree.
- Paid content search and tutor use `LUMA_SCOPED_RAG_URL` + server-only `LUMA_SCOPED_RAG_TOKEN`, with an explicit operator attestation flag. Both the envelope and every returned hit must prove the same tenant/program; otherwise reject the entire response, and never fall back to the global RAG.
- Demo/showcase remains unchanged unless `LUMA_LEARNING_ACCESS_MODE=entitled` is explicitly selected.
- RAG backend must filter the index BEFORE retrieval and independently prove tenant program isolation. The frontend and adapter cannot prove this by themselves.

## Gate criteria

- [x] Scope resolver denies cross-tenant/cross-program/revoked/expired access by unit test
- [x] Scoped Firestore document paths and event replay validated in Java 21 emulator
- [x] Coach sample and detail exact-program permissions covered by unit tests
- [x] Scoped RAG rejects missing/foreign envelope or result scope, invalid TLS configuration, and unavailable backend
- [x] Strict tutor does not query global RAG and provides source-grounded response only to matching program
- [x] Demo learner flows preserved by opt-in strict mode
- [ ] Separate, successful Granite security critique and independent engineer approval
- [ ] GitHub Actions CI full quality/security/firestore/browser gate on branch
- [ ] Deployed Firebase Auth/Firestore IAM/tenant scoped pen test and data export audit
- [ ] Dedicated RAG index backend implements and proves pre-retrieval filtering + source deletion
- [ ] Actual merchant test-mode purchase/refund, client consents, capacity, backups, RTO/RPO

## Security review notes

A production pilot cannot be approved merely because the code and emulator tests pass. Strict mode is not enabled in App Hosting YAML. Existing public sample learner screens MUST NOT be connected to customer PII.
