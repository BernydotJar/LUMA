# Independent deployment critic - authoritative Learning Twin production

Verdict: PASS_WITH_RISKS

Attempt to disprove the production deployment against the intended boundaries:

1. Could an unauthenticated browser access learner state through the Learning API?
   - No. /api/learning/plan returns 401 authentication_required.

2. Could an unauthenticated browser enumerate learner state through the Coach API?
   - No. /api/coach/learners returns 401 authentication_required.
   - Role semantics for authenticated non-coach versus coach are separately proven in the Auth emulator: 403 versus 200.

3. Could a browser bypass the APIs and read the learners collection directly?
   - No. Production Firestore returns 403 PERMISSION_DENIED.

4. Did the canonical hosted build actually expose the intended learner and coach product surfaces?
   - Yes. /, /learn and /studio return 200.
   - The exact main source build includes /api/learning/*, /api/coach/* and /studio/learners/[learnerId].

5. Could SE Voice accidentally depend on the workstation-only runtime in production?
   - No. The hosted UI is feature-gated and the Escuchar guia control is absent until a hosted runtime is configured.

6. Is the backend still reconciling or serving a partially applied rollout?
   - No. App Hosting reports reconciling=False after update time 2026-10-06T06:15:35.553353Z.

Remaining operational boundary:
- No production account was silently granted coach/admin/superuser custom claims by this graph. Claim provisioning remains an explicit authorization operation.

No release blocker found.
