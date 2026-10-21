# Live Classroom — enterprise product acceptance / SHIP gate

**Date:** 2026-10-19
**Source baseline:** `main` at `7ef32ba9ff3c56896da536a86ca14286b99ddfb3`. Liquid Glass is in `feat/live-classroom-glass-acceptance-20261019`, **not yet released**.
**Customer:** Seres de Excelencia. This document does not conflate LUMA with I-DO's separate agrochemical-customer acceptance workflows.
**Decision:** **NO-GO** for replacing Zoom in customer-facing production until every P0 business action is validated in source, accessible UI, live provider E2E and published revision.

## Acceptance contract

The canonical action inventory is [live-classroom-acceptance.json](./live-classroom-acceptance.json). Each of its **20 critical customer actions**, in **four end-to-end persona workflows**, requires four independently verified proofs:

1. **Implemented:** a passing assertion tied to the exact source revision; existence of a UI component is insufficient.
2. **Available/actionable UI:** authenticated, role-appropriate browser automation actually executes the control and observes a state transition; screenshots alone fail.
3. **Real business journey:** multi-person instructor/student, live-provider WebRTC event and backed/persisted API state, no mocked provider or synthetic tenant offered as final acceptance.
4. **Published:** evidence from the published website on an independently attested production commit matching the acceptance source SHA. HTTP 200 is only infrastructure availability, not feature acceptance.

`graph-harness.live-classroom.project.json` and its append-only `.events.jsonl` are the execution graph; the separate acceptance manifest covers **breadth** across all customer actions and cannot be closed by a narrow test. Graph Harness CLI `product-acceptance` is the executable review gate, and `evidence/live-classroom-acceptance/proofs.json` starts empty rather than claiming tests never run.

Hand-raise and acknowledgement are distinct learner/instructor actions. The UI may render before a provider has been exercised, so their implementation and deployment evidence remain intentionally empty until independently verified.

The four required journeys are: **tenant administrator** (cohort, trainer, schedule, admissions, reschedule/cancel); **instructor** (join, share, control discussion, moderate, end for everyone); **learner** (find session, preflight, join, bottom dock/leave, reconnect); **operations** (refund disconnect, provisional attendance reconciliation, provider incident/rollback). These workflows must be validated across appropriate devices and tenant boundaries, including negative authorization tests.

## Grounded code / UI / evidence / release comparison

| Business requirement | Source at baseline | UI | Live E2E evidence | Production proof |
| --- | --- | --- | --- | --- |
| Schedule live sessions | `src/app/studio/programs`, `src/app/api/programs/admin` | Form/UI exists | No authorized real-provider customer journey | Not verified |
| Create classroom token and restrict roles | `src/lib/live-classroom-server.ts`, `/api/live/classrooms/.../token` | Join/auth routes exist | Guest denies are tested; authorized provider join unproven | Not verified |
| Learner camera/mic, screen share, chat, leave | `src/components/live-classroom.tsx` uses `VideoConference` | Library's control bar exists; bottom Liquid Glass refactor on this branch | No connected live-provider action proof | Refactor not published |
| Instructor remove and finish-for-everyone | `/moderate` and `/close` APIs + roster | Instructor view included | Provider room deletion/rejoin behavior not verified end-to-end | Not verified |
| Attendance and refund revocation | Signed webhooks + Firestore attendance records | Coach attendance view | Real webhook replay/reconciliation and already-connected refund E2E open | Not verified |
| Change or cancel a future scheduled live class | Not established as a complete, safe customer edit flow | Not established as usable | Not verified | Not verified |
| Learner hand raise / instructor acknowledgement / mute-all | Implemented on stacked educator-controls source branch | UI added in the classroom with role-specific controls | Firestore and unit checks only; LiveKit Cloud multi-user actions not verified | Not verified |

## UX decision: bottom Liquid Glass controls

Preserve the real `VideoConference` controls and SDK behavior. Position the `.lk-control-bar` **bottom-center**, in a single translucent, blurred dock within the video stage, with understated plum/blue iridescence rather than saturated glow. Reserve safe space below participant tiles. Default camera/mic OFF before entering. Desktop and mobile must keep controls within viewport, minimum 44px target, visible focus, readable labels/tooltips, no hover-only critical affordances. Leave call is a distinct red-tinted control; instructor `Terminar clase para todos` stays separately confirmed. Support forced-colors, reduced-motion and no-backdrop-filter fallback.

Do not advertise raise hand, mute-all, or breakout rooms as released features until controls, role permissions, backend actions and real-user tests are complete; the first two are implemented only on an unmerged stacked branch. Mobile Safari WebRTC, poor bandwidth, rotated screens, keyboards, on-screen navigation, and lower safe areas are mandatory manual and automated review cases.

## Independent release checklist

- Validate graph and current status with `PYTHONPATH=<pinned Graph-harness-sdlc checkout> python3 -m graph_harness --project graph-harness.live-classroom.project.json --events graph-harness.live-classroom.events.jsonl validate` and `status --pretty`.
- Run the cross-product `graph-harness product-acceptance` command over manifest, evidence file and **trusted runtime production SHA**. Result must be `GO` before enabling the classroom feature flag or describing it as Zoom replacement.
- Execute a real scheduled 90-minute instructor-led session with at least two separately authenticated learners (one unauthorized control subject); verify join/toggle/chat/screen share/kick/reconnect/end, playback policy `none`, attendance and post-session ledger reconciliation.
- Perform live capacity and failure testing (20, 50, 100 and target cohort size), security, accessibility and UX QA; assess privacy/retention, cost budgets, on-call, backup, support and fallback. Get formal Seres program administrator and instructor signoff.
- Independently confirm `LUMA_LIVE_CLASSROOM_ENABLED` and LiveKit secret injection on hosted runtime, auto-room creation disabled, webhooks valid, version parity and tenant isolation. Do **not** infer success from `apphosting.yaml` or a functioning unauthenticated page alone.

**Current blockers:** actual LiveKit Cloud provision + webhook configuration, real provider test accounts, production deployment attestation, critical customer controls not implemented/verified, independent breadth review and performance/compliance acceptance. All are *release blockers*, not completed work. Do not merge or publish solely on the basis of any one browser test succeeding.
