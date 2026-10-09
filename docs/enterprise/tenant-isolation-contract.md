# LUMA — Tenant / Program Isolation Contract

**2026-10-09 | IMPLEMENTED IN SOURCE; EXTERNAL PROVIDER VALIDATION PENDING**

## Scope authority

For a commerce-backed pilot, the server obtains a scoped learner identity from verified Firebase Auth plus active Commerce Enrollment. The effective scope is `{tenantId, programId}`. The `tenantId` comes from trusted deployment configuration (`LUMA_LEARNING_TENANT_ID`), not user input. An optional `x-luma-program-id` header may select **only** an active program to which that UID is already entitled. A single active program is selected implicitly; multi-program accounts without an explicit choice receive HTTP 409 rather than guessed access.

A valid scope is obtained **before** any persistent learning event/read or proprietary RAG query.

## Scoped Twin storage (strict mode)

```
learningTenants/{SHA256(tenantId)}
  /learningPrograms/{SHA256(programId)}
    /learners/{firebaseUid}
      /events/{eventId}
```

The root `learners/{firebaseUid}` collection remains **showcase/legacy only** and is never read as fallback in entitled mode. Exactly the same UID enrolled in two organizations/programs receives independent onboarding, event IDs, replay handling, Twin state and coach interpretation. This implementation deliberately does NOT migrate legacy demo records or synthesize learning evidence from the payment.

Each enrollment is a separate commerce record; effective access is checked on every API request against the current entitlement state (including revocation and expiration). The coach uses the same scope and requires an active exact-program enrollment before viewing learner details or counting the participant.

## Protected API boundaries

| API | Strict-mode authority |
| --- | --- |
| `/api/learning/plan` GET / PUT | UID + exact authorized tenant/program |
| `/api/learning/events` POST | UID + exact authorized tenant/program; event ID local to scoped path |
| `/api/coach/learners` GET | coach claim + tenant/program + active sampled participants |
| `/api/coach/learners/[learnerId]` GET | coach claim + active exact-program enrollment + scoped Twin |
| `/api/coach/interventions` GET | scoped eligible participants only, bounded operational sample |
| `/api/content-intelligence/search` POST | authorized scope, scoped RAG adapter only |
| `/api/tutor` POST | authorized scope, scoped RAG adapter only; no global corpus or hard-coded sample fallback |

The original showcase remains operational when `LUMA_LEARNING_ACCESS_MODE` is absent or `showcase`. Showcase is not a production authorization mode.

## Scoped RAG gateway contract (not deployed)

`LUMA_SCOPED_RAG_URL`: dedicated HTTPS gateway that applies **tenant/program filters before semantic retrieval**, not after the top-K result is retrieved.

`LUMA_SCOPED_RAG_TOKEN`: server-only token provisioned from Secret Manager with least-privilege scopes and rotation (never use `NEXT_PUBLIC_`).

`LUMA_SCOPED_RAG_ISOLATION_ATTESTED=true`: an explicit operator assertion enabled only after independent enforcement tests of the backend, its index, corpus ownership, ingestion/deletion and query logs. Setting this flag alone **does not prove** vendor isolation.

Request:
```json
{"query":"¿Qué enseña la clase sobre el concepto?","limit":5,"scope":{"tenant_id":"tenant-a","program_id":"program-a"}}
```

Response:
```json
{
  "scope": {"tenant_id":"tenant-a","program_id":"program-a"},
  "retrieval":"pgvector",
  "results":[
    {
      "tenant_id":"tenant-a","program_id":"program-a",
      "chunk_id":"...", "source_id":"...", "drive_file_id":"...",
      "module":"...", "title":"...", "text":"...",
      "start_seconds":5, "end_seconds":20,
      "start_clock":"00:00:05","end_clock":"00:00:20",
      "drive_url":"https://...","srt_path":"...","transcript_path":"..."
    }
  ]
}
```

The LUMA adapter rejects the **entire response** if envelope or ANY hit is missing tenant/program labeling or does not match the verified scope. Missing credentials, unconfirmed attestation, non-HTTPS endpoints or unavailable service fail closed (no fallback to shared `LUMA_PNL_RAG_URL`). Raw result metadata does not in itself prove storage-level index isolation: a separate backend security review and cross-tenant index tests remain blocking.

## Operational limitations

- The isolated learner tree is **new**; previously captured global learning records are not copied. Migration requires client consent, scoped provenance mapping, separate verification, rollback and evidence.
- The pilot backend supports one configured tenant; future multi-tenant SaaS identity will require trusted server-resolved tenant membership and a tenant-aware program picker, not a user-supplied tenant header.
- A multi-program learner/coach may specify a verified program via `x-luma-program-id`; current first-pilot UI is optimized for one program, optionally selected by server-side `LUMA_LEARNING_PROGRAM_ID`.
- The sample coach queue remains a bounded sample, never a complete risk census or a measured impact dashboard.
- The scoped RAG backend, secrets, real merchant receipts, integration tests on deployed services, backup/restore and load/capacity proof remain **NOT YET VERIFIED**. The pilot activation gate must stay BLOCKED until those requirements are met.
