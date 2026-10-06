# Persistent Twin — Production Deployment Evidence

Date: 2026-10-06
Project: `luma-learning-intelligence`
Backend: `luma`
Source commit: `e892c42def7dcbdbf6ff9e4219966d885ab44e0c`
Production URL: `https://luma--luma-learning-intelligence.us-central1.hosted.app`

## Firestore rules

`firestore.rules` was compiled and released successfully to Cloud Firestore.

Production direct-client probe:
- Request: unauthenticated document read under `learners/*`
- Result: **HTTP 403 PERMISSION_DENIED**

This matches the product boundary: browsers do not read or write the learner collection directly. Next.js server routes use Firebase Admin after verifying an ID token.

## App Hosting

The backend is deployed from local source because this App Hosting backend is not connected to a GitHub repository.

The source tree used for deployment was verified at exact commit `e892c42def7dcbdbf6ff9e4219966d885ab44e0c` with no tracked modifications.

Firebase App Hosting created:
- build: `build-2026-10-06-002`
- final build state observed: **READY**
- backend update time after rollout: `2026-10-06T05:22:07.589293Z`
- backend reconciling: `false`

The CLI initially reported HTTP 409 while the same build creation operation was still in flight. Debug evidence subsequently showed the operation completing and the build reaching READY. The production endpoint evidence below is the release authority for traffic serving.

## Production smoke

- `GET /` → **200**
- `GET /learn` → **200**
- `GET /login` → **200**
- `GET /api/learning/plan` without ID token → **401** with `authentication_required`
- learner HTML contains the adaptive-home marker: `LUMA ajustó tu sesión con la evidencia más reciente`
- direct Firestore read without credentials → **403 PERMISSION_DENIED**

These endpoints prove the persistent-twin application code is serving in production and the deny-all client Firestore boundary is active.
