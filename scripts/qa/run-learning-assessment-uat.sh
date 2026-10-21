#!/usr/bin/env bash
# No production data. This is a local emulator-only authenticated UAT runner.
set -euo pipefail
PROJECT="${GCLOUD_PROJECT:-${GOOGLE_CLOUD_PROJECT:-}}"
if [[ "$PROJECT" != demo-luma-learning-* ]]; then
  echo "SAFETY_BLOCK: only demo-luma-learning-* projects" >&2; exit 2
fi
if [[ "${FIREBASE_AUTH_EMULATOR_HOST:-}" != "127.0.0.1:9099" ||
      "${FIRESTORE_EMULATOR_HOST:-}" != "127.0.0.1:8085" ]]; then
  echo "SAFETY_BLOCK: real local Firebase Auth+Firestore emulators required" >&2; exit 2
fi
if (echo >/dev/tcp/127.0.0.1/3298) >/dev/null 2>&1; then
  echo "SAFETY_BLOCK: QA-only web port is occupied" >&2; exit 2
fi
export GCLOUD_PROJECT="$PROJECT" GOOGLE_CLOUD_PROJECT="$PROJECT"
export LUMA_QA_SOURCE_SHA="$(git rev-parse HEAD)"
export LUMA_QA_BASE_URL="http://127.0.0.1:3298"
export LUMA_LEARNING_ACCESS_MODE="entitled"
export LUMA_LEARNING_TENANT_ID="qa-learning-uat"
export NEXT_PUBLIC_LUMA_QA_FIREBASE_PROJECT="$PROJECT"
export NEXT_PUBLIC_LUMA_QA_AUTH_EMULATOR_URL="http://127.0.0.1:9099"
unset GOOGLE_APPLICATION_CREDENTIALS LUMA_LEARNING_PROGRAM_ID
unset LUMA_SCOPED_RAG_URL LUMA_SCOPED_RAG_TOKEN LUMA_SCOPED_RAG_ISOLATION_ATTESTED
LOG="/tmp/luma-learning-auth-uat-3298.log"
NEXT_PID=""
cleanup() {
  if [[ -n "$NEXT_PID" ]]; then
    kill -- "-$NEXT_PID" >/dev/null 2>&1 || true
    wait "$NEXT_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
setsid npm run dev -- --webpack --hostname 127.0.0.1 --port 3298 > "$LOG" 2>&1 &
NEXT_PID=$!
for attempt in $(seq 1 90); do
  if curl -fsS --max-time 3 "$LUMA_QA_BASE_URL/api/health" >/dev/null 2>&1; then
    echo "LOCAL_QA_READY demo-only web+emulators"
    break
  fi
  if ! kill -0 "$NEXT_PID" >/dev/null 2>&1; then tail -30 "$LOG"; exit 1; fi
  sleep 1
done
if ! curl -fsS --max-time 4 "$LUMA_QA_BASE_URL/api/health" >/dev/null 2>&1; then
  tail -40 "$LOG"; exit 1
fi
node scripts/qa/learning-assessment-authenticated-uat.mjs
