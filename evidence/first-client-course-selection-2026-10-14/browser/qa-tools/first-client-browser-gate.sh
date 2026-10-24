#!/usr/bin/env bash
set -euo pipefail
case "${GCLOUD_PROJECT:-}" in demo-*) ;; *) echo REFUSE_NON_DEMO_PROJECT >&2; exit 2 ;; esac
case "${FIRESTORE_EMULATOR_HOST:-}" in 127.0.0.1:*) ;; *) echo REFUSE_NONLOCAL_FIRESTORE >&2; exit 2 ;; esac
case "${FIREBASE_AUTH_EMULATOR_HOST:-}" in 127.0.0.1:*) ;; *) echo REFUSE_NONLOCAL_AUTH >&2; exit 2 ;; esac
case "$PWD" in */LUMA-firstclient-browser-qa-20261014) ;; *) echo REFUSE_NON_QA_WORKTREE >&2; exit 2 ;; esac
if ! grep -q useLocalDemoAuth src/lib/firebase-client.ts;then echo REFUSE_UNPATCHED_AUTH_CLIENT >&2;exit 2;fi
export GOOGLE_CLOUD_PROJECT="$GCLOUD_PROJECT"
export LUMA_LEARNING_ACCESS_MODE=entitled
export LUMA_LEARNING_TENANT_ID=qa-first-academy
export NEXT_PUBLIC_LUMA_QA_EMULATOR=true
export NODE_ENV=development
if curl -fsS -m 1 -o /dev/null http://127.0.0.1:3191/qa-emulator-login 2>/dev/null; then echo QA_BROWSER_PORT_ALREADY_OCCUPIED >&2;exit 2;fi
setsid node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3191 >/tmp/luma-fc-browser-dev.log 2>&1 &
server_pid=$!
cleanup(){ kill -- "-$server_pid" >/dev/null 2>&1 || true; wait "$server_pid" >/dev/null 2>&1 || true; }
trap cleanup EXIT
for i in $(seq 1 150);do
  if curl -fsS -m 3 -o /dev/null http://127.0.0.1:3191/qa-emulator-login 2>/dev/null;then break;fi
  if ! kill -0 "$server_pid" 2>/dev/null;then tail -n 25 /tmp/luma-fc-browser-dev.log >&2;exit 2;fi
  sleep 0.6
done
printf 'QA_DEV_SERVER_READY\n'
node scripts/qa/first-client-auth-browser.mjs
