# LUMA-GRUV-002B — Evidence-backed publication preflight (read-only)

**Classification:** preparatory source capability. **NOT activation, tenant issuance, certification, entitlement or release approval.** Development node may execute independently of previous blocked release gates. The production control-plane node GRUV-002 still requires GRUV-001, GRUV-002A and this node to pass independent gates before activation.

## Product Owner story

As a platform owner, I need an inspectable, read-only explanation of whether a draft institution has valid program-offering evidence, so onboarding teams can find defects before requesting publication. Neither a green preview nor a config hash may grant an entitlement, activate a tenant or change the current Seres de Excelencia experience.

## Authorized experience

`GET /api/platform/institutions/{tenantId}/publication-preflight` is enabled only with server-only `LUMA_INSTITUTION_PREFLIGHT_ENABLED=true`. The endpoint requires a revoked-token-verified **platform superuser**. It does not accept client headers as authorization, learner/coach scope, role `admin` or tenant-specific admin credentials. In the deployed configuration the flag is unset and route replies 503. No POST/PUT/PATCH publication API exists.

## Domain contract

1. The preflight reads a valid draft from the existing store; missing draft produces 404, corrupt tenant data produces 503. It never falls back to Seres.
2. For each declared `programId` it queries the `programOfferings` collection by exact trusted tenant and program identity, using the server Admin SDK and query limit `51`. If any program has **more than 50 offerings** it fails closed with `OFFERING_LIMIT_EXCEEDED` (no truncated-success illusion). It counts only active offerings, never a draft/archived/completed offering as ready evidence.
3. Every returned offering is independently checked against requested `tenantId` and `programId`, document ID and allowed statuses. Unexpected or inconsistent stored data fails closed with `OFFERING_DATA_INVALID` and no payload disclosure.
4. Each missing active program adds `NO_ACTIVE_OFFERING` with only the affected program ID and count, not student information or untrusted titles. Multiple approved organizations may use the same `programId`; tenant identity always scopes the query.
5. Output includes the draft's `configVersion`, a digest of the snapshot inputs, a bounded set of per-program findings, and an `observedAt` UTC timestamp. The digest is **advisory, non-authorizing** and invalidated by any change to the draft/offerings. It never signs or publishes configuration.
6. Even if all local checks pass, `activationAllowed` MUST be **false**, with explicit unresolved release gates: `IDENTITY_AND_MEMBERSHIP_UNVERIFIED`, `CONTENT_AND_RAG_ISOLATION_UNVERIFIED`, `SECURITY_AND_PRODUCTION_RELEASE_UNAPPROVED`. No AI-produced score can bypass these.
7. API errors distinguish anonymous 401, non-platform authority 403, missing draft 404 and unavailable/corrupted backing data 503. Response is `private, no-store`. Do not leak admin token, instructor/student records or unpublished content.
8. Reads are not a transaction spanning future publication. The result is an *as-of inspection*, and any future activation flow must independently revalidate its exact version and offering evidence immediately before commit.

## Acceptance tests

- A flag missing or set to any value except exact `true` refuses the request, including requests with a valid platform bearer token.
- A valid Firebase platform superuser can inspect only a valid synthetically generated draft; tenant administrator and anonymous identities are rejected.
- A draft with valid active offerings passes `localChecksPassed` but always has `activationAllowed: false`.
- A program with only draft/completed/archived offerings yields `NO_ACTIVE_OFFERING`. An unrelated tenant's active offering does not make the program pass, including identical program IDs.
- A missing draft is 404; corrupted stored draft is 503; an unexpected offering shape yields `OFFERING_DATA_INVALID` not a partial success.
- More than 50 matched offerings per program triggers `OFFERING_LIMIT_EXCEEDED` and remains blocked.
- A draft version or an offering status change alters the advisory digest; unchanged inputs produce the same digest (timestamp excluded).
- Repeat calls create no events, config writes, purchases, activations or enrolled students.
- Unit tests, Auth+Firestore emulator tests with real ID tokens, TS, lint, production build, browser regression, Granite critic and explicit Graph evidence are required. Model review is advisory; hosted CI, human signoff and live IAM proof remain distinct.

## DDIA decision record

A strongly validated read path with exact tenancy predicates and bounded scans is simpler than introducing a new search index, queue or microservice for low-frequency institutional preflight. The backend must not advertise a globally consistent publication snapshot from independent Firestore reads; live publication will require its own compare-and-swap, audit and rollback workflow. The composite `(tenantId, programId)` index is explicit in `firestore.indexes.json` and must be deployed and verified separately before using this API in a managed environment.
