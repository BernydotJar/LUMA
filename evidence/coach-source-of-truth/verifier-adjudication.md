# Independent Verifier Adjudication — Coach Authoritative Learning State

Date: 2026-10-06

## Decision

**PASS_WITH_RISKS for code release.**

The core source-of-truth claim is proven by deterministic integration evidence:

- an ordinary authenticated Firebase user receives **403** from the Coach API;
- a Firebase user with emulator custom claim `coach:true` receives **200**;
- the Coach list exposes the exact `nextActionId` computed from the learner's persisted `learners/{uid}` record;
- the Coach detail exposes the same Next Best Action, learner version **2**, and the same append-only ledger containing the single submitted learning event;
- direct Firestore client access remains **403**;
- the browser route for a persistent learner without coach authorization displays a protected state and does not substitute Mariana/showcase data;
- the curated Mariana route remains explicitly separate from persistent learner routes;
- coach browser regression passes **6/6** across desktop/mobile;
- adaptive learner regression passes **4/4**;
- showcase/WCAG regression passes **17/17**;
- the production dependency audit reports **0 vulnerabilities**.

## Granite critic adjudication

IBM Granite 3.3 returned `PASS_WITH_RISKS` and correctly recognized that learner and coach derive state from the same authoritative learner record.

Several Granite “findings” describe successful security controls as risks, and one sentence incorrectly implies that a valid coach custom claim receives 403. The emulator result is authoritative here: ordinary authenticated user = 403; `coach:true` = 200.

A second local-model verifier attempt was not used as release authority because the Granite 4 local process exceeded the workstation CPU/runtime envelope. The release decision therefore rests on deterministic gates plus this independent adjudication.

## Remaining boundary

No production user was granted a coach/admin/superuser custom claim by this graph. That is intentional: claim provisioning is an operational authorization decision and must not be silently assigned to an account.

The code safely supports production claims once an authorized operator provisions them.
