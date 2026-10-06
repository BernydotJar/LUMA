# Production smoke - main 4c4901e

Date: 2026-10-06
Commit: 4c4901eb2cae36d61d7608fd85b2e5ecd5e312c9

- / -> 200
- /learn -> 200
- /studio -> 200
- /api/learning/plan -> 401
  body: {"error":"authentication_required"}
- /api/coach/learners -> 401
  body: {"error":"authentication_required"}
- Direct Firestore learner read -> 403 (PERMISSION_DENIED expected)
- Hosted SE Voice button -> absent by feature gate
- Backend: 2026-10-06T06:15:35.553353Z reconciling=False uri=luma--luma-learning-intelligence.us-central1.hosted.app
