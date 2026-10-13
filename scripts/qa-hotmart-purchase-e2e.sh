#!/usr/bin/env bash
# Local E2E only. Never contacts Hotmart or a production Firebase project.
set -euo pipefail

PROJECT="${GCLOUD_PROJECT:-${GOOGLE_CLOUD_PROJECT:-}}"
if [[ "$PROJECT" != demo-* ]]; then
  echo "SAFETY_BLOCK: Firebase project must start with demo-" >&2
  exit 2
fi
if [[ -z "${FIRESTORE_EMULATOR_HOST:-}" || -z "${FIREBASE_AUTH_EMULATOR_HOST:-}" ]]; then
  echo "SAFETY_BLOCK: Firestore and Auth emulators required" >&2
  exit 2
fi
if [[ "$FIRESTORE_EMULATOR_HOST" != 127.0.0.1:* &&
      "$FIRESTORE_EMULATOR_HOST" != localhost:* ]] ||
   [[ "$FIREBASE_AUTH_EMULATOR_HOST" != 127.0.0.1:* &&
      "$FIREBASE_AUTH_EMULATOR_HOST" != localhost:* ]]; then
  echo "SAFETY_BLOCK: emulator hosts must use loopback" >&2
  exit 2
fi

PORT="${LUMA_HOTMART_QA_PORT:-3285}"
URL="http://127.0.0.1:$PORT"
if (echo > /dev/tcp/127.0.0.1/"$PORT") >/dev/null 2>&1; then
  echo "SAFETY_BLOCK: test port already in use" >&2
  exit 2
fi

export GCLOUD_PROJECT="$PROJECT"
export GOOGLE_CLOUD_PROJECT="$PROJECT"
export HOTMART_HOTTOK="qa-only-hotmart-hottok-not-real"
export LUMA_LEARNING_ACCESS_MODE=entitled
export LUMA_LEARNING_TENANT_ID=qa-hotmart-e2e
export LUMA_LEARNING_PROGRAM_ID=pnl-practitioner
export LUMA_HOTMART_QA_URL="$URL"
unset GOOGLE_APPLICATION_CREDENTIALS

LOG="${LUMA_HOTMART_QA_SERVER_LOG:-/tmp/luma-hotmart-e2e-next.log}"
NEXT_PID=""

cleanup() {
  if [[ -n "$NEXT_PID" ]]; then
    kill -- "-$NEXT_PID" >/dev/null 2>&1 || true
    wait "$NEXT_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# Real local HTTP routes; all Firebase state stays within the isolated emulators.
setsid npm run dev -- --webpack --hostname 127.0.0.1 --port "$PORT" > "$LOG" 2>&1 &
NEXT_PID=$!

for _ in $(seq 1 85); do
  if curl -fsS --max-time 2 "$URL/api/health" >/dev/null 2>&1; then
    echo "LOCAL_NEXT_READY port=$PORT project=$PROJECT"
    break
  fi
  if ! kill -0 "$NEXT_PID" >/dev/null 2>&1; then
    tail -50 "$LOG"
    echo "NEXT_EXITED_BEFORE_READY" >&2
    exit 1
  fi
  sleep 1
done

if ! curl -fsS --max-time 4 "$URL/api/health" >/dev/null 2>&1; then
  tail -35 "$LOG"
  echo "NEXT_READINESS_TIMEOUT" >&2
  exit 1
fi

node scripts/qa-hotmart-purchase-flow.mjs
