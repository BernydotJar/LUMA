# LUMA-070 / LUMA-071 — Authenticated enterprise-style UAT (nonproduction)

**Change proposal:** Add reproducible authenticated browser acceptance to the integration candidate [PR #83](https://github.com/BernydotJar/LUMA/pull/83). **Local integration source under test:** `9747ecbcc33d2ae8fa2362a1b5680828165993a6`.

## Test boundary

This suite launches a **local Next.js development server**, headless Chromium, Firebase Auth Emulator and Firestore Emulator. User accounts, enrollments and purchases are synthetic. Production Firebase, Hotmart, LiveKit and external RAG are **never accessed**. A suite PASS does not imply release authorization or stakeholder UAT.

This deliberately exercises a stronger trust boundary than previous guest-only browser tests:

| Acceptance dimension | Real test action | Result on local integration source |
| --- | --- | --- |
| Implemented API | Authoritative `/api/learning/plan`, assessment GET/POST, entitled program selection, token verification and revocation | PASS |
| Visible learner UI | Complete five class-contract questions, see persisted personalized route, reload, open actual class tutor and observe recovery when RAG is unavailable | PASS |
| Full QA learner journey | Synthetic enrollment in two programs -> signed browser login -> select program -> assessment -> scoped persisted route -> switch program -> signed tutor query -> revoked enrollment rejection | PASS **within emulator QA boundaries** |
| Tenancy & concurrent writes | Cross-program isolation, cross-learner isolation, unenrolled principal denial, two concurrent event IDs produce one committed assessment | PASS |
| Mobile | Signed-in participant can discover and open assessment at 390 px viewport without horizontal overflow | PASS |
| Deployed product | Production/staging SHA, real Hotmart transaction, LiveKit instructor+learner and real RAG-grounded teaching outcome | **NOT TESTED — NO-GO** |

**Latest local result:** 13 out of 13 scenarios PASS on a clean disposable emulator run. No source changes to the student, tutor or Firebase business runtime were required to make the new UAT pass. A hydration race in the *test harness* was corrected by waiting for the React-controlled form to mount before typing.

## Run the same tests

Install dependencies with `npm ci`; provide Java 21+ (Firebase Emulator requirement). Run from the exact checkout:

```bash
firebase emulators:exec --project demo-luma-learning-uat-20261020 --only auth,firestore "bash scripts/qa/run-learning-assessment-uat.sh"
```

The runner refuses non-`demo-luma-learning-*` projects and missing loopback emulator hosts. It starts Next on `127.0.0.1:3298`, disables all scoped production RAG credentials, creates only `example.test` synthetic accounts, and tears down the local server on exit.

Run output is saved to `evidence/learning-ui/qa-authorized-learning-uat.json`. **This file is gitignored intentionally.** A fresh run is required for every SHA: a historical PASS cannot be recycled. Screenshots of synthetic learners are written to `/tmp/luma-learning-qa-20261020`, not committed.

## GitHub Actions

The proposed `quality.yml` job `learning-auth-uat` runs after `verify`; it must pass before `release-readiness` or `deploy` can execute. It installs Node 22, Java 21, Chromium and Firebase CLI pinned to the existing CI version. A validation step requires all **13** checks, zero defects, explicit synthetic-only scope and `report.sourceSha === GITHUB_SHA`. The job uploads the report artifact for independent reviewers.

There is **no** new production deployment path, no modified release attestation, no reusable secrets, no bypass of the existing protected GitHub source gate. The new CI job itself needs a fresh successful Actions run on the final PR SHA.

## Unresolved acceptance blockers

1. **Independent authorized review and Ed25519 source attestation** on the final integrated source SHA are missing. Do not record `independent-review: PASS` without a real reviewer.
2. The classroom tutor is correctly **fail-closed** when scoped RAG is unavailable, but no actual authorized RAG corpus was tested. A production-like isolated backend must be demonstrated.
3. The program-level assessment currently registers **SE Practitioner questions globally**; extend a versioned per-program configuration and institutional publication approval before offering it to other curricula.
4. Institutional user acceptance with real authorized participants, privacy/retention approval, 1/10/50-course operations, actual teacher/customer actions and production postdeploy verification remain separate required controls.
5. The integration's existing Graph Harness ledger must remain authoritative; evidence from the original #78 fork cannot be silently grafted onto its SHA chain.

**Decision:** **Technical UAT PASS** for the isolated test model, **release NO-GO**. Request independent adversarial review of exact integrated source and result artifacts before Graph Harness state transitions. Do not merge to `main` or deploy based solely on these tests.
