# LUMA first-client course selection architecture

Base: main at 7ef32ba9ff3c56896da536a86ca14286b99ddfb3. Scope: FIRSTCLIENT-002 (#56), academy-to-learner and coach course selection in a deployment-scoped pilot tenant.

## Data flow

1. On login, the Firebase SDK obtains a current ID token. GET /api/programs/my-courses verifies the token, requires a verified email in entitled mode, claims pending institutional enrollment by verified email (idempotently), filters active records to the configured tenant and authenticated learner UID, and joins matching active course offerings.
2. The client renders the authorized course list by title. A first-time learner with multiple active programs must choose one; one available program is selected automatically. A UID/audience-scoped browser preference is never proof of an entitlement.
3. The program selection is sent in x-luma-program-id to server learning plans, events, tutor, content intelligence, coach learner roster/detail, and intervention reads. Each server endpoint independently authorizes requests; changing local storage cannot grant another program.
4. Queued practice receipts include the original selected program. A queued event is not uploaded against a different program. Remote learning plans are identified by UID and selected program to prevent client-side evidence mixing.
5. The live schedule is filtered to the currently selected program in the learning home. The schedule API may return all live sessions for courses to which the user has entitlement; the UI only displays the active program.
6. Coach course lookup GET /api/coach/programs accepts only signed-in coach/admin roles and returns active offerings in the configured tenant, filtered by assigned coach or tenant admin, with a hard 100-offering bound. Coach evidence requests still require program-scoped server checks.
7. Errors and empty states are explicit; the learner or coach can refresh the program listing after a new grant or connectivity failure.

## Trust boundaries and limitations

- The tenant is configured by LUMA_LEARNING_TENANT_ID for the current deployment. This is NOT unrestricted dynamic multi-tenancy.
- The existing catalog of learningExperiences is showcase/static content, not a tenant-published academic curriculum. This change does NOT authorize it as institution-owned lessons, questions, or rubrics.
- The enrolled learner can only select an authorized program; the server must continue to deny revoked and foreign-tenant access.
- Institution provisioning remains a separate P0 workstream (#55); support tickets and outbound follow-up automation remain separate P1 workstreams (#58 and #59).
- Staging browser authentication, per-program coach assignment RBAC semantics, editorial publication provenance, provider-driven payment and live video, manual WCAG and field performance remain independent release gates.

## QA acceptance

Tests use localhost and demo-luma-firstclient-20261014 Firebase Auth/Firestore Emulators with disposable identities only. Verify one/two/no course choices, guest 401, cross-tenant 403, coach course selection, persistent evidence after fresh ID token, revocation, pending event isolation, and live schedule filtering. Separate static React tests validate select labels, prompt, retry and refresh. A PASS in an emulator is not real Hotmart, Firebase production, or authentic first-client enrollment proof.

Status: HOLD / NO-GO. No merge, deployment, production claims or real customer records.
