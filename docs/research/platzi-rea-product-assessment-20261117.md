# Platzi -> LUMA: public-surface REA assessment and PO acceptance

Date: 2026-11-17. Scope: public Platzi features and the LUMA learner surface. No private account, credential, paid course, binary, or non-public API was inspected. This is a competitive product analysis, **not a claim to know Platzi's internal source code**.

## Evidence and REA execution boundary

- REA official source: https://github.com/morluto/rea (README, web/browser-observation and website-script-export guides). REA supports passive CDP page inspection, bounded network/DOM/script observations, and static exported-JS analysis. Browser results require a separate, disposable Chrome profile and an eligible Node runtime.
- On this workstation, `node --version` reported `v22.23.2`; REA 6.9.0 requires `^22.23.4 || ^24.22.1 || >=26.12.1` (official npm manifest). Attempted isolated installation outside the application; it timed out before an executable was ready. **No REA capture was produced, no Platzi private code was inspected.** A repeatable passive procedure, with permission and a disposable profile, is recorded below.
- Platzi first-party product explanations (public features): https://platzi.com/cursos/introduccion-platzi/te-damos-la-bienvenida-a-platzi/ and https://platzi.com/cursos/introduccion-platzi/descubre-todo-lo-que-platzi-tiene-para-ti/ . They describe a student home with learning goals, progress/weekly statistics, personalized paths, ranking, resume point, player notes and community.
- 2026 new-feature presentation: https://platzi.com/cursos/confbog2026/platzi-learn-convierte-tus-documentos-en/ . It describes exercises during classes, automated project feedback and personalized routes. These are source-reported feature descriptions, **not authenticated first-hand E2E confirmation**.
- The public product site https://platzi.com/ describes courses, paths and certificates. Features behind login were not validated.

### REA follow-up (not run, not an acceptance prerequisite for this low-risk UX increment)

1. Install official Node >=24.22.1 and official `rea-agents`; verify package provenance and installed versions in an isolated tools directory (not LUMA dependencies).
2. Start disposable Chromium on `127.0.0.1:9222` with `--remote-debugging-port=9222 --user-data-dir=/tmp/rea-platzi-disposable`; navigate only to public https://platzi.com/. Never attach to a user's signed-in browser.
3. Run `rea list-browser-targets` and `rea inspect-web-page` against that local CDP endpoint, with retained script sources only as needed; record tool help/schema and limits; save the Evidence response.
4. If allowed and useful, `rea export-web-scripts` into a new temporary directory and `rea analyze-javascript-application` on exported static scripts. Do not publish copied assets, secrets, personal data or proprietary code.
5. Use the observations to refine LUMA design independently; treat inferred endpoint/route names as hypotheses, not complete or authorized functionality.

## Source-aware fit/gap

| Capability | Platzi public claim | LUMA source today | PO decision |
| --- | --- | --- | --- |
| Resume learning | Player remembers position | `NextActionCard` in `src/components/adaptive-learning-home.tsx` shows selected action but no verified cross-device playback resume | P1: scope course-scoped bookmark, authorization and replay before implementation |
| Weekly goal | Personal goals + weekly study statistics | Onboarding `minutes` is availability per session; no weekly-intention control | **Implement P0, client-only: 2/3/4 weekly practices tied to signed-in UID** |
| Adaptive routes | Personalized routes | `learner-projection.ts` and `learning-engine.ts` already rank next action, with Twin separation | Preserve and evaluate. Do not duplicate an AI route engine |
| Exercises + feedback | Exercises and automated project feedback | PAS evidence-rubric practice and route-scoped assessments exist; institutional publisher remains protected/incomplete | P1: add authorized rubric exercises only after source approval and independent UAT |
| Score/streak | Public rank points | LearningPulse distinguishes observed/self-reported/verified but not attendance streak | P2: optional, never equate a streak with learning mastery |
| Coach progression | Enterprise and teacher-facing reporting | Scoped coach routes and Studio already exist | P1: signals for human intervention, not a vanity dashboard |

## P0 increment delivered for review

- A compact, secondary `Mi ritmo de aprendizaje` choice next to the primary practice in `/learn`, without adding another primary CTA or new navigation item.
- Only for a signed-in user with a valid Firebase UID. The browser key includes UID and version; anonymous/invalid identities read/write nothing. Switching account switches the key; stored values are only 2/3/4, default 3.
- Clearly says that the goal is local and is neither a score nor certified progress. No new Firestore API, event, authentication permission, billing, analytics or Twin inference.
- Next-action duration is existing `plan.nextAction.minutes` data; it is an estimate, not measured study time.
- Storage denial is visible; SSR uses a stable empty snapshot to avoid hydration mismatch.

## Acceptance contract

1. Authenticated choice persists on this device; changing accounts does not show the other account's goal. Anonymous visitors do not see the editor.
2. Only 2/3/4 are accepted; corrupt local storage falls back to 3. No browser-stored number changes evidence, rank, certificates or entitlements.
3. Single primary CTA and existing learning route remain unchanged. Mobile first viewport, accessibility, no horizontal overflow and Spanish content are verified in browser.
4. Automated lint, TypeScript, unit, build and relevant Playwright tests are checked against the exact PR head SHA; any missing check means UNVERIFIED, never PASS.
5. Protected independent review/source attestation and Graph Harness release checks are respected. **No self-review, gate bypass, automatic deployment claim or merge solely on a green unit test.**

## Product outcome and measurement plan

Hypothesis: a visible, bounded weekly intention improves repeat use without inducing pressure or confusion. Track opt-in and voluntary weekly practice starts *only with approved, privacy-minimized telemetry*, compare against an agreed control cohort and measure evaluated competency independently. This patch deliberately introduces **no unapproved tracking**; verified improvement per effective learning time remains the North Star. Follow up with authenticated QA and institution-scoped telemetry design before wider rollout.

Status: public-source analysis done; direct REA capture BLOCKED by tool runtime; initial P0 code delivered for review; production GO subject to CI and independent release gates.
