# LUMA — Commerce-gated Learning Access (Pilot Control)

**Status:** Implemented in source and covered by isolated policy tests. Pilot deployment, Firebase emulator, end-to-end merchant proof and full multi-tenant isolation are **NOT YET VERIFIED**.

## Why the boundary exists

Firebase login proves identity, **not a right to consume a purchased program**. For a real high-ticket pilot, the APIs that read or mutate paid learner state or retrieve the proprietary content corpus must also check an effective commerce entitlement.

## Deployment-wide modes

- `LUMA_LEARNING_ACCESS_MODE=showcase` (or unset): preserves today's public demo/preview and existing learner flows; it does **not** prove paid access enforcement.
- `LUMA_LEARNING_ACCESS_MODE=entitled`: fail-closed for paid learner APIs. Requires `LUMA_LEARNING_TENANT_ID=<tenant ID>`. This tenant setting is reusable deployment configuration, **not** a branch-specific customer conditional.
- Any unrecognized mode, empty tenant in entitled mode or invalid tenant ID causes a service configuration error (503), never silent fallback to showcase.

The mode is chosen from trusted server environment variables, never from a caller-controlled header or query parameter.

## API enforcement (strict mode)

| Surface | Behavior |
| --- | --- |
| `GET/PUT /api/learning/plan` | Verified Firebase token + active tenant enrollment before reading/initializing the learner state |
| `POST /api/learning/events` | Same effective entitlement required before accepting evaluated evidence |
| `POST /api/content-intelligence/search` | Same entitlement required before querying the connected corpus |
| `POST /api/tutor` | Firebase token + effective entitlement required before tutor logic/RAG. Showcase remains open |
| `GET /api/programs/my-schedule` | Existing learner-specific active enrollment filter and verified ID remain in place |
| `GET /api/coach/*` | Existing coach/admin scopes and learner authorization remain separate |

The tutor UI supplies a Firebase Bearer token when available, but does not expose Hotmart/Stripe provider internals. An unauthorized learner sees a human-readable enrollment/access message.

## Admission contract

1. Authenticate through Firebase and require `email_verified` and a stable UID.
2. List the linked learner enrollments and check tenant identity, UID linkage, `status=active` and `accessEndsAt` strictly in the future when present.
3. On first access, attempt idempotent claim by verified normalized purchaser email, then read and check again. A legitimate purchase is not discarded if AI or voice is down.
4. Deny revoked, expired, unclaimed, wrong-user and wrong-tenant enrollments (403); reject invalid Firebase token (401).
5. On Firestore outage or unexpected error, do **not** grant access. Reply 5xx and rely on recovery; no response may disclose raw purchase/customer secrets.

## Security caveats / launch blockers

- Existing `learners/{firebaseUid}` records are not separated by tenant. A coach who can view a multi-tenant learner's global state may see information from another program; current pilot must use isolated identity/data scope and independently audit those permissions. A real multi-tenant environment needs a tenant/program-keyed Twin data model and authorization on exports.
- A tenant-wide entitlement gate does not, by itself, implement **per-program content permissions** or a tenant-partitioned RAG semantic index. The current optional RAG integration must be tested against the intended authorized corpus; do not attach multiple tenants' proprietary data to a shared unfiltered index.
- Anonymous sample pages and deterministic public reflection demos remain showcase-only; never show real identifiable learner evidence on a public static route.
- Enable strict mode only when signed provider sandbox tests and real tenant mapping have passed and rollback/incident support is arranged.
- The first pilot remains BLOCKED pending all merchant, Firestore emulator, operational, privacy, capacity and independent review gates.
