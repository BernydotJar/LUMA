# LUMA Live Classroom — Release Gate Evidence

Date: 2026-10-09
Branch: feat/enterprise-live-classroom-20261009
Base: e819b16 (origin/main at branch creation)
Scope: Existing LUMA + additive LiveKit integrated classroom.

## Independent checks

| Check | Execution evidence | Result |
|---|---|---|
| New classroom and existing schedule unit tests | `npm run test:run -- src/lib/live-classroom.test.ts src/lib/program-schedule-status.test.ts` | PASS: 15/15 |
| Full unit suite | `NODE_OPTIONS='--max-old-space-size=400' npm run test:run -- --maxWorkers=1` | PASS: 181 passed, 44 emulator-gated skipped (33 files total) |
| Targeted changed-file ESLint | `NODE_OPTIONS='--max-old-space-size=384' node /workspace/projects/LUMA/node_modules/eslint/bin/eslint.js ...` | PASS after fixing effect-based state update |
| Git whitespace review | `git diff --check` | PASS |
| TypeScript / Next build | First typecheck PASS before final moderation / UI edits; later complete revalidation repeatedly interrupted by shared workstation OOM/timeouts | BLOCKED; rerun in dedicated CI before merge |
| Firebase Firestore emulator | Not started in current environment | BLOCKED; 44 emulator-specific tests skipped |
| Provider E2E / WebRTC | No LiveKit Cloud credentials provisioned or production token validated | BLOCKED |
| Security, accessibility and >100 user load | Require enterprise environments and device matrix | NOT STARTED |

## Adversarial findings / mitigation

1. **Cross-tenant enrollment replay:** exact tenantId + programId + offeringId + uid access checks with unit coverage.
2. **Coach role spoofing:** role alone insufficient; required assigned coachId and coach claim, except admins.
3. **External link bypass:** integrated provider rejects supplied external meeting URL and ignores stale existing links.
4. **Pseudonymous participant isolation:** stable room/participant digests derived from room context and UID.
5. **Unauthorized recording:** media JWT denies roomRecord; no LUMA egress creation when policy `none`. Out-of-band screen capture cannot be prevented.
6. **Instructor kick bypass:** server stores `bannedAt`, rejects new tokens for banned identity; on LiveKit Cloud removes participant and revokes existing token with cutoff. Provider E2E not yet validated.
7. **Webhook spoof/replay:** WebhookReceiver signature verification, event ID dedupe and authorized roster lookup. Live provider redelivery tests and reconciliation remain release gates.
8. **Attendance != mastery:** an interval ledger does not automatically update competency progress.
9. **Capacity cost spike:** room maxParticipants defaults to 120, per-account concurrent quota and downstream costs documented; budgets and active safeguards remain release gates.

## Release disposition

**HOLD** for production enablement. The integration is implemented in a reviewable feature branch and disabled by default via LUMA_LIVE_CLASSROOM_ENABLED. An enterprise release requires complete CI (including typecheck/build), LiveKit Cloud token/webhook E2E, Firebase emulator integration and capacity/quality/security signoff. Do not claim 500-camera classroom support until a controlled load test passes.

No secrets or media JWTs should be checked into Git.
