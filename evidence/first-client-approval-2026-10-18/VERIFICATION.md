# LUMA — Independent first-academy institutional approval verification

**Date:** 2026-10-18 · **Branch:** `feat/first-client-institution-approval-20261018` · **Baseline PR #66 SHA:** `286a27426ab87417e3d08ee37da58fda95c5b88f` · **Environment:** independent isolated Cloud Sandbox worktree, Firebase Auth/Firestore `demo-` emulators; Next.js 16.3.8 production build; headless Chromium Playwright. The exact PR SHA for this new work is recorded upon commit and CI is run separately.

## Verdict and boundaries

**Local implementation gates PASS for the scoped institutional review and first draft journey. Product release NO-GO.** All identities, invitation proofs and tenant records used by the tests were synthetic. The application did **not** grant production admin roles, merge, deploy, or enroll real learners. The QA-only email/password Auth overlay and `/qa-emulator-login` route were created in a separate detached worktree and MUST NOT be included in a product commit or PR.

## Reproducible evidence

| Gate | Result | Evidence |
|---|---|---|
| HTTP Auth + Firestore E2E | **20 PASS / 0 fail / 0 skip** | [`api-results.json`](./api-results.json); `scripts/qa/first-client-approval-gate.sh`, actual local Next production build |
| Chromium authenticated journey | **13 PASS / 0 fail / 0 skip** | [`browser/results.json`](./browser/results.json) and [`browser/screenshots/`](./browser/screenshots/); QA-only local Auth overlay, never part of main source |
| Responsive matrix | **36 observations PASS** across 320×568, 360×740, 390×844, 428×926, 768×1024, 1440×900, three themes, owner and operator | Chromium scenario 13: no horizontal overflow; visible interactive targets meet 44×44 px geometry |
| axe automated accessibility | **0 detected violations** across Seres de Excelencia, Light, Dark on operator desktop/mobile and owner first-course mobile | Chromium scenarios 4, 6, 11; WCAG 2.2 A/AA tagged rules |
| Local JS console | **0 page exceptions** detected in Chromium run | Browser `pageErrors` field |
| Full Vitest unit suite | **371 PASS / 81 configured SKIP** | local `npx vitest run`, following functional worktree changes; specific flag tests 17/17 |
| ESLint / TypeScript | **PASS** | `eslint .`, `tsc --noEmit` |
| Next production webpack build | **PASS** | local `next build --webpack` |
| Graph Harness | **VALID** 83 nodes, 700 existing chained events at time of structural validation; new evidence events appended after final review | `graph-harness.project.json`, `graph-harness.events.jsonl` |

## Acceptance traces and security denials

1. Anonymous platform inbox → **401**. Ordinary applicant/platform role → **403**; unverified email applicant → **403**.
2. Verified original applicant may create one immutable request, **without changing roles**; malicious `admin:true` fields rejected, unauthorized reviewer → **403**.
3. Platform first reviewer records organization verification, reserves the tenant slug, and creates reasoned audit. **Same reviewer cannot issue invitation**, server returns **403** and UI no longer offers that button.
4. Another verified platform operator issues high-entropy, one-use, 72h invitation. Database stores SHA-256 digest only; duplicate issue → **409**; revoked/rotated/replayed proof → **403**; expired proof → **410**.
5. Original applicant signs in and accepts; other verified identity and unverified email → **403**; acceptance alone grants **no** admin claims.
6. Explicit human-style operator CLI confirms project, recipient email, exact plan hash after read-only preview; grants only `adminTenantIds` for reviewed tenant; legacy tokens revoked; auditable partial-failure intent.
7. Owner can access matching tenant's programs; foreign tenant → **403**. Only platform superuser bootstraps the first tenant draft, retry idempotent, owner denied platform bootstrap.
8. New owner creates first course offering as `status=draft`, updates tenant brand with versioned receipt; no published `institutionConfigs` record exists.
9. Attempted second applicant reservation of same tenant → **409**. Invitation renewal invalidates former proof, explicit revocation releases slug. Thirteenth invalid invitation acceptance attempt by same actor within 15 minutes → **429**.
10. Retention purge defaults read-only; an expired, unactivated synthetic request is only deleted after explicit confirmation and leaves an audit receipt. Active tenant remains present.
11. **Forged operator UID is rejected:** the operator-admin tools now require a signed, unrevoked Firebase ID token matching the exact declared operator identity, verified email and superuser role. Missing token, foreign signed token and spoofed operator identity fail before any privileged mutation (HTTP emulator E2E scenario 19).
12. **Activation-vs-rejection race guarded:** once a durable activation intent is present, even an authorized reviewer cannot reject or revoke the accepted invitation until the activation is manually reconciled. Both writes return **409** (emulator E2E scenario 20).

## Visual evidence / screenshots

- `01-no-operator-access-mobile.png`: unauthorized applicant denied platform inbox.
- `02-submitted-mobile.png`: academy owner receives server-persisted application receipt.
- `03-reviewed-desktop.png`: independent platform review dashboard.
- `04-invitation-mobile.png`: second operator issues a one-use invite; token not shown in screenshot.
- `05-acceptance-mobile.png`: verified original applicant confirms invite.
- `06-first-course-draft-mobile.png`: owner prepares first cohort; draft status explicit.

Only synthetic `@example.test` identities occur in these screenshots. No real customer learner records, Firebase tokens, plaintext invitation tokens, API keys or operator credentials are included. Automatic axe checks are **not** equivalent to manual VoiceOver/TalkBack/keyboard verification. Browser run uses Playwright emulated mobile device metrics, not real phone hardware; no measured LCP/INP/CLS or field p75 estimates are claimed.

## Adversarial review / release blockers

**Security critic:** IBM Granite 3.3 2B was executed over source excerpts but returned a generic script summary with no reproducible independent security finding; it is NOT counted as an independent acceptance. A manual trust-boundary review instead identified potential operator UID impersonation in privileged CLI tools, now fixed and repro-verified in scenario 19.

**P0 release blockers:** actual educational course authoring and publishing with tenant-scoped lessons, questions, rubrics, versioned preview/approval, coach and enrolled learner access (#57 and #63); globally enforced App Check/edge WAF/traffic quotas and alerts; approved retention/deletion workflow covering accepted/active requests and legal retention policy; durable notification delivery (operator currently copies invite manually); human staging/UAT acceptance; merge/deployment and production feature flags remain explicitly unapproved.

**P1:** independent manual screen-reader and keyboard modality checks, verified policy copy, no-guess UX empty/loading/errors on physical devices, independent production-like performance baseline, operational partial-failure reconciliation runbook, audit archival and old record cleanup.

**P2:** owner-facing localization of technical program/tenant IDs in advanced screens, richer course creation from authored templates, notification delivery metrics, page performance refinements.

**Decision:** approve this code change only as a *draft PR* for further independent review and CI. **NO-GO for deploying or claiming the full first-client learning experience ready.**
