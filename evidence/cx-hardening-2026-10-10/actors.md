# Learner → Coach — independent QA coverage ledger

**Result: BLOCKED for the complete real-actor chain.** The repo exposes auth/entitlement and server API capabilities, but approved QA identities + dedicated entitled staging tenant were not provided. Production learner data, real customer accounts, enrollment, emails, payments and role changes were not touched.

| Segment | Test evidence | Result |
| --- | --- | --- |
| Guest access | /learn HTTP 200, guest state, stable CTA; /login entry | Partial PASS |
| QA learner Firebase sign-in | No permitted disposable learner browser login | BLOCKED |
| Enrollment / entitlement | learning-entitlement unit tests, no authorized enrolled actor | Component PASS, actor BLOCKED |
| Onboarding goal/profile | Demo Playwright writes browser-local onboarding | Demo PASS, remote BLOCKED |
| Practice execution/feedback | Demo Playwright recorded SIMULATION_COMPLETED in localStorage | Local-only PASS |
| Firestore persistence/version | FirestoreLearningStore emulator tests 4/4 include onboarding, event append, idempotency, distinct stores and recovery after re-read | Emulator PASS |
| Server receipt in a new browser session | No approved signed-in actor to close/reopen | BLOCKED |
| Coach insight | coach-scoped-learning 5/5 and learning-server.auth 4/4 isolated tests | Component PASS, signed-in coach BLOCKED |
| Tenant/program separation | Test exercises same UID across tenant-a/course-1, tenant-a/course-2, tenant-b/course-1; checks store-scoped read and revoked entitlement writes denied | Emulator PASS; live API actor BLOCKED |
| Anonymous API access | GET and PUT /api/learning/plan, POST /api/learning/events, GET /api/coach/learners return 401 | PASS |
| Cleanup | Emulator demo project was stopped with no permanent QA accounts; no production changes | Local PASS |

**Emulator conditions:** firebase-tools 15.32.1, Java 21 (/opt/luma-jre21), demo-luma-qa39, Firestore 127.0.0.1:8091, Auth 127.0.0.1:9101, tests src/lib/learning-store.emulator.test.ts (4), learning-entitlement.test.ts (13), coach-scoped-learning.test.ts (5), learning-server.auth.test.ts (4): 26/26 passed, 4 files. Initial emulator invocation without JAVA_HOME 21 failed on Java 17; correcting the local process-only JAVA_HOME allowed the full tests to pass. No production Firebase/Firestore was contacted.

**Next actor QA fixture request:** disposable QA tenant with one entitled program; consented learner and coach Firebase test accounts with scoped IDs; a foreign-tenant actor; seeded approved educational content/rubric; explicit cleanup mechanism. Required proof: token/tenant membership, program authorization, stored rubric provenance, API Firestore document readback after a new browser session, scoped coach read, foreign tenant denial and revocation negative test. Redact all tokens and personally identifying user data from artifacts.
