#!/usr/bin/env bash
set -euo pipefail
case "${GCLOUD_PROJECT:-}" in demo-*) ;; *) echo REFUSE_NON_DEMO >&2;exit 2;;esac
case "${FIREBASE_AUTH_EMULATOR_HOST:-}" in 127.0.0.1:*) ;; *) echo REFUSE_NONLOCAL_AUTH >&2;exit 2;;esac
case "${FIRESTORE_EMULATOR_HOST:-}" in 127.0.0.1:*) ;; *) echo REFUSE_NONLOCAL_DB >&2;exit 2;;esac
case "$PWD" in */LUMA-firstclient-intake-uiqa-20261014) ;; *) echo REFUSE_NOT_QA_COPY >&2;exit 2;;esac
if ! grep -q 'QA-only Firebase Auth emulator\|INERT LOCAL TEST OVERLAY' src/lib/firebase-client.ts;then echo REFUSE_UNPATCHED_AUTH >&2;exit 2;fi
export GOOGLE_CLOUD_PROJECT="$GCLOUD_PROJECT"
export LUMA_INSTITUTION_REQUESTS_ENABLED=true
export NEXT_PUBLIC_LUMA_QA_EMULATOR=true
export NODE_ENV=development
export NEXT_TELEMETRY_DISABLED=1
if curl -fsS -m 1 -o /dev/null http://127.0.0.1:3194/academia/solicitud 2>/dev/null;then echo QA_PORT_IN_USE >&2;exit 2;fi
setsid node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3194 > /tmp/luma-fc-academy-ui-dev.log 2>&1 & p=$!
cleanup(){ kill -- "-$p" >/dev/null 2>&1 || true;wait "$p" >/dev/null 2>&1 || true;};trap cleanup EXIT
for i in $(seq 1 100);do
 if curl -fsS -m 2 -o /dev/null http://127.0.0.1:3194/academia/solicitud 2>/dev/null;then break;fi
 if ! kill -0 "$p" 2>/dev/null;then tail -n 30 /tmp/luma-fc-academy-ui-dev.log >&2;exit 2;fi
 sleep .5
done
node scripts/qa/first-client-institution-browser.mjs
