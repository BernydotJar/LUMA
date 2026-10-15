#!/usr/bin/env bash
set -euo pipefail
: "${FIRESTORE_EMULATOR_HOST:?}"
: "${FIREBASE_AUTH_EMULATOR_HOST:?}"
: "${GCLOUD_PROJECT:?}"
case "$GCLOUD_PROJECT" in demo-*) ;; *) echo "REFUSE_NON_DEMO_PROJECT" >&2; exit 2 ;; esac
case "$FIRESTORE_EMULATOR_HOST" in 127.0.0.1:*) ;; *) echo "REFUSE_NONLOCAL_FIRESTORE" >&2; exit 2 ;; esac
case "$FIREBASE_AUTH_EMULATOR_HOST" in 127.0.0.1:*) ;; *) echo "REFUSE_NONLOCAL_AUTH" >&2; exit 2 ;; esac
export GOOGLE_CLOUD_PROJECT="$GCLOUD_PROJECT"
export LUMA_LEARNING_ACCESS_MODE=entitled
export LUMA_LEARNING_TENANT_ID=qa-first-academy
if curl -fsS --max-time 1 -o /dev/null http://127.0.0.1:3185/learn 2>/dev/null; then
  echo "TEST_SERVER_PORT_IN_USE" >&2
  exit 2
fi
setsid npm run start -- --hostname 127.0.0.1 --port 3185 >/tmp/luma-first-client-entitled-next.log 2>&1 &
server_pid=$!
cleanup() {
  kill -- "-$server_pid" >/dev/null 2>&1 || true
  wait "$server_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT
for i in $(seq 1 75); do
  if curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:3185/learn 2>/dev/null; then break; fi
  if ! kill -0 "$server_pid" >/dev/null 2>&1; then tail -n 20 /tmp/luma-first-client-entitled-next.log; exit 2; fi
  sleep 0.4
done
node scripts/qa/first-client-emulator-journey.mjs
