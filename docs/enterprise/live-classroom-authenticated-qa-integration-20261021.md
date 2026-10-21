# LUMA — live classroom authenticated QA source reconciliation

Date: 2026-10-21. Staging integration only. #81 instructor-ban fix remains intact.

Original #82 verified proof (33 PASS / 1 Cloud BLOCKED) ran on its own source tree, not this combined candidate. The actual synchronized LUMA source must be revalidated separately; the test never demonstrates Cloud GO.

## QA isolation

Legacy Firebase Auth Emulator development fixture remains `NEXT_PUBLIC_LUMA_QA_FIREBASE_PROJECT=demo-*` and `NEXT_PUBLIC_LUMA_QA_AUTH_EMULATOR_URL=http://127.0.0.1:9099`. The classroom three-browser fixture requires NODE_ENV=development, exact `NEXT_PUBLIC_LUMA_QA_PROJECT=demo-luma-live-uat`, exact `NEXT_PUBLIC_LUMA_QA_AUTH_HOST=127.0.0.1:9462`, an actual loopback-hosted web page, and Firebase project equality. This cannot be enabled in a production build. No production Firebase credentials are generated or changed.

`__lumaQaEmailSignIn` is exposed only inside this local isolated fixture; all institutional/live classroom roles still use server-side entitlement authorization. LiveKit OSS is a loopback media engine with synthetic subjects. Tests are not LiveKit Cloud.

## Required release evidence

Run exact-commit CI, signed and independent Graph Harness source review, and authenticated instructor plus 2 learners UAT against an authorized isolated Firebase/LiveKit Cloud staging project. Verify camera/mic, hand raise/moderation, instructor ban remains effective after refunds/re-enrollment, immediate revoke/disconnect, denied JWT replay, expired enrollment recovery, mobile and accessibility, and published revision. Maintain product NO-GO until these are attested.
