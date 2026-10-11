# Institutional publication preflight — read-only operations

**No tenant activation is implemented.** This service inspects bounded authoritative Firestore `programOfferings` records against a versioned institutional draft, then reports which program assets have evidence ready for further approval. It is intentionally incapable of publishing anything.

## Endpoints and gates

`GET /api/platform/institutions/{tenantId}/publication-preflight`

- Disabled unless the server-only flag `LUMA_INSTITUTION_PREFLIGHT_ENABLED=true`. This flag is not set in App Hosting, and must not be added to any production environment just to demonstrate source capabilities.
- Only a Firebase revoked-token-verified `superuser=true` or `role=superuser` can invoke the route. Tenant admin roles are not publication authority.
- Uses `institutionDraftStore.getDraftForTenant` and a separately injected Firestore inspector; neither implements a published `InstitutionConfigStore`. The API is read-only and never invokes merchant services, course ingestion, enrollment or learner evidence.
- HTTP: 401 anonymous, 403 not platform-authorized, 404 missing valid draft, 503 disabled or corrupt/unavailable dependencies. All responses include `cache-control: private, no-store`.

## Meaning of checks

`localChecksPassed` means only that a draft and all its declared programs have appropriately scoped **active** offerings within bounded local inspection. `activationAllowed` is permanently `false` in this module. Its blocking list always includes pending identity/membership, content/RAG isolation and independent production release checks. A no-blocker list for local offerings is NOT permission to deploy or publish.

The response includes `configVersion`, `observedAt`, and `inspectionDigest` (SHA-256 of validated config and sorted matched offering IDs/statuses (including inactive statuses)). Hashes are for comparison and diagnostics, not cryptographic approval or authorization. The preflight is not a transactionally frozen publication snapshot: offerings can change immediately after inspection.

## Index and scaling

`firestore.indexes.json` declares a collection-scope index `(tenantId ASC, programId ASC, __name__ ASC)`. This must be provisioned separately in the appropriate environment; a passing emulator does not validate managed Firestore index readiness. For each declared program the inspector retrieves at most 51 offerings and blocks if more than 50 exist; this keeps reads bounded and avoids false positives from incomplete result sets. Expansion to larger catalogs requires pagination with a cursor and a separately verified global snapshot contract.

## Safety contract

Always use the Firebase Admin SDK only on the server; honor existing deny-all client Firestore rules. Do not render untrusted offering title or expose coach emails, live session join URLs or learner records in the response. Requests with data corruption or over-cap result sets must not return `localChecksPassed=true`. No on-the-fly migration, tenant picker, live RAG access or new certificate policy is part of this slice.

## Next gate

Future `publishInstitutionConfig` must obtain explicit platform authorization and scoped validation of program ownership, commerce policy, tenant-bound RAG, impersonation risks, resource quotas, rollback plan, audit and replay. It must atomically verify `configVersion` and avoid publishing a stale preflight. Neither this preflight nor its hashes can substitute for those requirements.

### Defense in depth — data access boundary

The domain `FirestoreInstitutionPublicationInspector` now receives a **read-only `ScopedOfferingReader`** and a **read-only draft lookup**, not a raw mutable Firestore SDK or a writable draft store. `FirestoreScopedOfferingReader` is the only component with the SDK handle and always performs exact tenant + program equality predicates with a hard limit. The preflight additionally rejects program IDs outside the strict draft contract, even when older generic scope validation would accept them. This narrows misuse from future internal callers, but still does not substitute for a separately authorized server route and IAM controls.
