#!/usr/bin/env bash
# Isolated browser + real local Next HTTP + Firebase Auth/Firestore emulators.
set -euo pipefail
PROJECT="${GCLOUD_PROJECT:-${GOOGLE_CLOUD_PROJECT:-}}"
if [[ "$PROJECT" != demo-* ]]; then echo "SAFETY_BLOCK: demo project only" >&2; exit 2; fi
if [[ "${FIRESTORE_EMULATOR_HOST:-}" != 127.0.0.1:* ||
      "${FIREBASE_AUTH_EMULATOR_HOST:-}" != 127.0.0.1:* ]]; then
  echo "SAFETY_BLOCK: local Auth+Firestore emulators required" >&2; exit 2
fi
for port in 3290; do
  if (echo > /dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1; then
    echo "SAFETY_BLOCK: QA Next port already occupied" >&2; exit 2
  fi
done
export GCLOUD_PROJECT="$PROJECT"
export GOOGLE_CLOUD_PROJECT="$PROJECT"
export HOTMART_HOTTOK="qa-only-hotmart-hottok-not-real"
export LUMA_LEARNING_ACCESS_MODE=entitled
export LUMA_LEARNING_TENANT_ID=qa-course-journey
export LUMA_LEARNING_PROGRAM_ID=pnl-practitioner
export NEXT_PUBLIC_LUMA_QA_FIREBASE_PROJECT="$PROJECT"
export NEXT_PUBLIC_LUMA_QA_AUTH_EMULATOR_URL=http://127.0.0.1:9099
export LUMA_QA_BASE_URL=http://127.0.0.1:3290
unset GOOGLE_APPLICATION_CREDENTIALS
unset LUMA_SCOPED_RAG_URL LUMA_SCOPED_RAG_TOKEN LUMA_SCOPED_RAG_ISOLATION_ATTESTED
LOG=/tmp/luma-course-journey-next-3290.log
NEXT_PID=""
cleanup() {
  if [[ -n "$NEXT_PID" ]]; then
    kill -- "-$NEXT_PID" >/dev/null 2>&1 || true
    wait "$NEXT_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
setsid npm run dev -- --webpack --hostname 127.0.0.1 --port 3290 > "$LOG" 2>&1 &
NEXT_PID=$!
for _ in $(seq 1 105); do
  if curl -fsS --max-time 3 "$LUMA_QA_BASE_URL/api/health" >/dev/null 2>&1; then
    echo "QA_NEXT_READY project=$PROJECT port=3290"
    break
  fi
  if ! kill -0 "$NEXT_PID" >/dev/null 2>&1; then tail -35 "$LOG"; exit 1; fi
  sleep 1
done
if ! curl -fsS --max-time 4 "$LUMA_QA_BASE_URL/api/health" >/dev/null 2>&1; then
  tail -30 "$LOG"; exit 1
fi
case "${LUMA_QA_SCENARIO:-full}" in
  full) RUNNER=scripts/qa-course-journey-runner.mjs ;;
  isolation) RUNNER=scripts/qa-course-isolation-recheck.mjs ;;
  *) echo "SAFETY_BLOCK: unsupported QA scenario" >&2; exit 2 ;;
esac
node "$RUNNER"
