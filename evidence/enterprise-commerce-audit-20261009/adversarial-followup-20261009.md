# LUMA-063 — Adversarial follow-up / security evidence

Date: 2026-10-09. Separate from the earlier Graph Harness checkpoint.

## Findings and remediation

1. **HIGH: authorization-to-write race.** A Firebase UID can lose its entitlement between API admission and a Firestore write transaction. Previously, `FirestoreLearningStore.bootstrap` and `appendEvent` did not read commerce enrollment atomically. The scoped store now checks an active, matching tenant+program enrollment INSIDE the same Firestore transaction and fails closed, including duplicate-event replays after revocation. The global showcase store remains unchanged. `src/lib/learning-store.ts` and `src/lib/learning-store.emulator.test.ts`.
2. **MEDIUM: provider response abuse / unsuitable evidence links.** The scoped RAG adapter previously accepted unbounded JSON and any string-valued `drive_url`, including potentially unsafe URL schemes. It now caps the response at 256 KiB before parsing, enforces maximum hit count, restricts source links to HTTPS without embedded credentials, bounds field sizes, checks increasing media timestamps and validates server-resolved scope IDs. `src/lib/scoped-rag.ts` + targeted negative tests. This is adapter-side defense, not proof of backend tenant isolation.
3. **HIGH — NOT YET CLOSED: external RAG index isolation.** The actual public health endpoint `https://luma-rag.textilesdemedellin.com/health` responded HTTP 200 with `valid_sources=1`, `pending_sources=40`, `needs_review_sources=1`, `chunks=69`. A scope-shaped unauthenticated `POST /v1/search` was rejected HTTP 401. **Neither response proves that the backend supports tenant/program filtering before retrieval.** The existing service remains unscoped; strict LUMA RAG must remain disabled until a separate scope-aware service and verified token-to-scope grants are operational.
4. **INDEPENDENT CRITIC UNAVAILABLE.** `ibm/granite3.3:2b` via the local Ollama service returned HTTP 500 `llama-server process has terminated: signal: killed` under current sandbox memory pressure, even for a short one-sentence prompt. A separate Granite code review was therefore NOT completed; do not count this note as independent model approval.
5. **MEDIUM — DEFERRED: client-side demo storage.** Local browser keys for anonymous onboarding/practice are not scoped to a signed-in tenant/program. The strict server never reads these records, but authenticated UI fallback may show stale locally projected activity on shared browsers. A separate client privacy/UX guard is required before enabling strict paid learning on a public shared-device environment.

## Verified in this turn

- Local Firestore emulator `src/lib/learning-store.emulator.test.ts`: 4/4 PASS, including expiry/revocation after verified admission and no version/event changes after denial.
- TypeScript + ESLint PASS after changes.
- Negative RAG adapter tests: oversize payload, dangerous URL, malformed timestamp, too many hits and invalid scope — PASS.
- `origin/main` now includes PR #19 LiveKit classroom; feature branch must be merged/rebased and full independent CI rerun after reconciliation.

**Release gate: SOURCE HARDENING — UNDER REVIEW; ENTERPRISE PILOT — BLOCKED.** No claim of Granite PASS, production RAG isolation or merchant sandbox acceptance is justified.
