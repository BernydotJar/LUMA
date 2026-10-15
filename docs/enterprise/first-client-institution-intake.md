# LUMA — First-academy request intake (bounded LUMA-073)

**Release: NO-GO.** This is an unprivileged, verified-applicant request and follow-up capability, not full self-service tenant provisioning or activation for #55.

## First visitor flow

1. On `/login`, the visitor sees **«¿Diriges una academia? Solicitar un espacio institucional»** and enters `/academia/solicitud`. The root `/` still serves the learner experience; a full B2B entry landing remains outstanding.
2. Unauthenticated visitor follows `/login?next=%2Facademia%2Fsolicitud`. Login redirects only to the exact allowlisted destination; arbitrary `next` is ignored to prevent open redirects.
3. Verified Firebase identity submits organization name, country/timezone, role (informational only), delivery type (live/evergreen/hybrid) and learner band. No technical tenant ID, claims, admin role or requested status is in the payload.
4. POST `/api/institutions/applications` uses revoked-token Firebase verification and requires `email_verified`. It stores immutable status `received`, actor UID and email from the trusted ID token in Firestore. GET reads only current actor's record (never query param identity).
5. Replaying the same form is idempotent (HTTP 200); submitting changes after first accepted request returns HTTP 409. Concurrent submissions are serialized with Firestore transactions; first returns 201, duplicate 200. Owner can consult the server-persisted status after reload; a new role or academy is never minted.
6. A separate explicit **human operator approval and audit workflow**, based on existing reviewed `scripts/provision-tenant-admin.mjs`, must verify the organization and issue the first tenant grant; not built in this slice. The institution drafts API remains privileged and feature-flagged.

## Security and operational gates

- `LUMA_INSTITUTION_REQUESTS_ENABLED` defaults **OFF**. Only a deliberately configured staging tenant should turn this on for QA. When disabled, API responds 503 and page shows a clear unavailable state; no production changes.
- Strict allowlisted JSON schema with 4096-byte streaming limit, 415 for non-JSON, 413 for oversized content, and malicious role/tenant/status/email fields rejected. Document key stable SHA-256 of authenticated UID; request cannot submit a foreign UID or grant custom Firebase claims.
- **Not yet enterprise-ready:** centralized rate limiting/App Check/WAF for verified-account abuse, retention/deletion policy for applicant contact data, notification/review queue, verified operator decision and audit trail, invitation expiry/revocation, institution dashboard onboarding and first published course. No admin role assignment from UI.
- No real customer data, payments, roles, tenant config, or production permissions used in QA; emulator identities are disposable.

## Evidence

`src/lib/institutions/application.test.ts` and `src/app/api/institutions/applications/route.test.ts`: 23 input/replay/privilege and default-OFF flag unit tests. `scripts/qa/first-client-institution-gate.sh`: 13 real Next HTTP + Firebase Auth/Firestore Emulator scenarios: auth, verified identity, malicious fields, size/content type, idempotency/race, server persistence and cross-user access. API test ID `demo-luma-firstclient-intake-20261014`. Independent, disposable-authenticated Playwright Chromium provided 8/8 real-browser journeys PASS, including 390×844 mobile + 1440px desktop, signed-in application and Firestore receipt reload, cross-applicant privacy, open-redirect denial and axe-core automated WCAG 2 A/AA, 2.1 AA, 2.2 AA on Seres/Light/Dark with zero detected violations. See `evidence/first-client-institution-request-2026-10-14/browser/README.md` and six screenshots. This is **not** a manual screen-reader signoff. The `institution-browser` CI job uses an ephemeral QA-only Git worktree and synthetic Firebase login; the helper auth-overlay and QA login page are never included in the build/release source.

**Verdict: INTAKE IMPLEMENTATION PASS locally, ENTIRE FIRST-ACADEMY JOURNEY BLOCKED**, pending trusted approval, institutional config and curriculum publication (#55, #57, #63).

## Protected CI (exact SHA)

The quality workflow adds **two independent release-blocking jobs** after the `verify` exact-source build: `institution-intake` replays 13 API tests against the preserved production build, with fresh (non-committed) result and exact GitHub SHA attestation; `institution-browser` checks out an isolated temporary worktree, applies a QA-only Auth Emulator overlay, and runs the 8 Chromium scenarios including multi-theme axe, mobile sizing, form confirmation, and cross-applicant isolation. Its helper login route is not shipped. Both jobs become `deploy.needs` gates, while actual production activation remains OFF and PR events cannot deploy.
