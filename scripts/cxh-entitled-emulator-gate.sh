#!/usr/bin/env bash
set -euo pipefail
test -n "$FIRESTORE_EMULATOR_HOST"
test -n "$FIREBASE_AUTH_EMULATOR_HOST"
test -n "$GCLOUD_PROJECT"
case "$GCLOUD_PROJECT" in demo-*) ;; *) echo "Refusing non-demo project" >&2; exit 2;; esac
export LUMA_LEARNING_ACCESS_MODE=entitled
export LUMA_LEARNING_TENANT_ID=qa-tenant-a
export LUMA_LEARNING_PROGRAM_ID=qa-program-a
export GOOGLE_CLOUD_PROJECT="$GCLOUD_PROJECT"
if curl -fsS -o /dev/null http://127.0.0.1:3151/login 2>/dev/null; then
  echo "QA port 3151 already occupied" >&2
  exit 2
fi
setsid npm run start -- --hostname 127.0.0.1 --port 3151 > /tmp/luma-cxh-entitled-server.log 2>&1 &
server_pid=$!
cleanup() {
  kill -- "-$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT
for i in $(seq 1 80); do
  if curl -fsS -o /dev/null http://127.0.0.1:3151/login 2>/dev/null; then break; fi
  if ! kill -0 "$server_pid" 2>/dev/null; then tail -n 15 /tmp/luma-cxh-entitled-server.log; exit 1; fi
  sleep 0.25
done
node scripts/cxh-entitled-emulator-actors.mjs
