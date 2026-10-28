#!/usr/bin/env bash
set -euo pipefail
case "${GCLOUD_PROJECT:-}" in demo-*) ;; *) echo "REFUSE_NON_DEMO_PROJECT" >&2; exit 2 ;; esac
case "${FIREBASE_AUTH_EMULATOR_HOST:-}" in 127.0.0.1:*) ;; *) echo "REFUSE_NONLOCAL_AUTH" >&2;exit 2 ;; esac
case "${FIRESTORE_EMULATOR_HOST:-}" in 127.0.0.1:*) ;; *) echo "REFUSE_NONLOCAL_FIRESTORE" >&2;exit 2 ;; esac
export GOOGLE_CLOUD_PROJECT="$GCLOUD_PROJECT"
export LUMA_INSTITUTION_REQUESTS_ENABLED=true
export NEXT_TELEMETRY_DISABLED=1
port=3192
if curl -fsS -m 1 -o /dev/null "http://127.0.0.1:$port/academia/solicitud" 2>/dev/null;then echo "QA_PORT_BUSY" >&2;exit 2;fi
setsid node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port "$port" > /tmp/luma-fc-institution-server.log 2>&1 &
server_pid=$!
cleanup(){ kill -- "-$server_pid" >/dev/null 2>&1 || true;wait "$server_pid" >/dev/null 2>&1 || true; }
trap cleanup EXIT
for i in $(seq 1 100);do
 if curl -fsS -m 3 -o /dev/null "http://127.0.0.1:$port/academia/solicitud" 2>/dev/null;then break;fi
 if ! kill -0 "$server_pid" 2>/dev/null;then tail -n 35 /tmp/luma-fc-institution-server.log >&2;exit 2;fi
 sleep .5
done
node scripts/qa/first-client-institution-application.mjs
