# LUMA Twin Intelligence — P0 UAT and pilot runbook

**Audience:** independent educational reviewer, institution owner, instructor, QA/security and finance.
**Outcome:** decide whether to authorize a real pilot and, afterwards, whether a pilot exit *candidate* exists.
**Product source:** `specs/072-luma-twin-intelligence-p0.md`

## Preflight — before creating any accounts

- [ ] Institution confirms program owner, instructor, permitted content/source rights, assessment rubric, data-retention and incident contacts.
- [ ] Participant consent/notice reviewed, including withdrawal and deletion; minors excluded in this P0.
- [ ] Allocate participants to arms without withholding necessary teaching support. Preserve assignment receipts and a pre-registered analysis protocol.
- [ ] Staging is isolated and explicitly authorized. Separate test Firebase project, no production identity grants.
- [ ] Verified instructor `coach` role and exact `coachTenantIds` scope, one pinned UID.
- [ ] Production/staging promotions remain independently gated; source-only tests are not authorization.

## Stage A — deterministic source verification

Use the isolated LUMA checkout, never the current production URL:

```sh
npm ci --ignore-scripts
./node_modules/.bin/vitest run src/lib/twin-intelligence src/app/api/twin-intelligence --maxWorkers=1 --no-file-parallelism
./node_modules/.bin/eslint src/lib/twin-intelligence src/app/api/twin-intelligence
```

A complete TypeScript `typecheck` and Next.js production build must also pass on a suitably resourced isolated runner before GO. Do not kill processes in the shared workstation to make room.

## Stage B — authenticated API UAT (staging only)

Set the six `LUMA_TWIN_*` and `LUMA_LEARNING_*` variables from SPEC-072 **only** on an approved staging service. The feature defaults disabled, and must stay disabled in production until the release authority signs off.

### Instructor methodology approval

- `GET /api/twin-intelligence/teaching-twin` with verified teacher bearer token and `x-luma-program-id` header: empty draft/approved for first use.
- `PUT` with `{"expectedRevision":0,"method":{...}}` using teacher-authored method pack: returns revision 1 as `DRAFT`.
- Verify learner `GET /api/twin-intelligence/next-action` returns 409 before educator approval.
- `POST` `{"action":"approve","expectedRevision":1}`: approval receipt and pinned digest.
- Learner now receives read-only proposal from their own Learner Twin, with `sourceVerification=TEACHER_DECLARED_NOT_RETRIEVAL_VERIFIED`. No source text, score or certificate is written by this endpoint.
- Edit draft revision 2 without approval: learner remains on version 1.
- Instructor approves revision 2: learner proposal references version 2 and audit receipts preserve version 1.

### Human follow-up

- Obtain a **real stored learner event ID**, not a generated chatbot answer.
- `POST /api/twin-intelligence/interventions` with `learnerId`, `reasonEventId`, `idempotencyKey`. Replay must return same intervention.
- `PUT` with `interventionId`, `learnerId`, `expectedRevision:1`, `outcome:"COMPLETED"`, `followUpEventId`; completion fails until a different *later* event is verified on the same scoped learner.
- Instructor may `DISMISSED` an intervention with a documented decision; do not translate dismissal into student failure.
- Coach's `GET` must exclude learners with revoked enrollment.
- Replay/competing closure must not create duplicate history or overwrite earlier human action.

### Negative tests (mandatory)

1. Learner without valid ID token: 401.
2. Valid learner with no active scoped enrollment: deny.
3. Other institution token, even with same learner ID: deny.
4. Other program in same institution: deny.
5. Other teacher with broad coach claim but without assigned UID: deny.
6. Wrong `x-luma-program-id`, forged tenant header, invalid scope: deny.
7. Revoked instructor token: deny.
8. Unauthorized `PUT`/approval: deny, preserve previous approved Twin.
9. Missing/unapproved source rights: do not invoke generative provider or claim source verified.
10. Oversized input, malformed JSON, duplicate event, stale revision, wrong follow-up time: reject.
11. Scoped RAG backend is down: no global/foreign content fallback.
12. Read/write after enrollment revocation: reject/omit.

**Current automation:** unit tests use mocked Firestore and mocked authentication. They are not a substitute for real emulator and authenticated staging E2E.

## Stage C — educational evaluation protocol

Use comparable pre/post transfer scenarios with four or more criterion-level observations. Independent scorer receives anonymized artifacts without seeing intervention arm wherever feasible. Rubric versions must match. Keep explicit absences; do not exclude failures or withdrawals from the assignment denominator.

- Baseline: day 0; capture source event and scoring receipt.
- Post: days 11–14; equivalent/new scenario, blind scoring.
- Retention: days 21–28; new situation, delayed performance.
- Contact: educator intervention, response latency and later criterion-based follow-up.
- Budget: provider billing receipts, infrastructure allocation, teacher time, active and completed learner counts.
- Reviewer: someone other than the approving teacher must sign the evaluation receipt.

The analysis calculator is `evaluateTwinPilot()`. It returns `PENDING_REAL_PILOT` for every `tier=synthetic` or `tier=verified_emulator` bundle regardless of attractive demonstration values.

**Do not manually label a bundle `verified_pilot` without independently authenticating receipts against the source-of-truth event ledger, consented assignments, approved rubric and billing records.** That evidence ingestion/attestation pipeline is a separate release prerequisite.

## Graph Harness gate-to-evidence table

| Gate | Required artifact | Current honest state |
| --- | --- | --- |
| Educational gain | Consented assignment registry, pre/post rubric receipts, analysis with attrition | Not collected |
| Human effectiveness | Educator action log, later independent learning assessment | Domain route implemented, live UAT pending |
| Institutional isolation | Two authorized emulator/staging tenants and negative access/RAG traces | Unit mocks only, real boundary not attested |
| Evidence accuracy | Rubric version audit, verified source IDs, tamper/duplicate tests, independent review | Code tests exist, independent audit pending |
| Unit economics | Provider invoices, infrastructure allocations, educator hours, latency observations | Calculator exists, no actual production costs |
| Security and privacy | Authorization, records retention, rights, incident response, cancellation/erasure proofs | Policy review pending |
| Runtime acceptance | typecheck, prod build, Playwright E2E, accessibility, load | Not all verified in current constrained workstation |
| Release | Signed SHA, protected review, staging rollout, production authorization | Explicitly not authorized |

## Findings recording

Create a dated `evidence/luma-twin-intelligence-p0-YYYYMMDD/` subdirectory containing:

- command transcripts, exit codes and hashes;
- blinded assessment receipt export or encrypted/pseudonymous proof;
- negative access traces with no raw PII;
- model/provider and cost receipts, if authorized;
- reviewer role, decision and signed SHA;
- product go/no-go decision with blockers, without replacing human consent.

## Stopping rules

**SAFETY_STOP** for any possible cross-tenant data leak, unauthorized role elevation, model export of protected data or minors without approval. **PARTIAL_WITH_DOCUMENTED_BLOCKERS** when only independent permissions, external UAT, provider costs or resource limits remain. The present branch belongs in the latter state until live review and staging evidence exist.
