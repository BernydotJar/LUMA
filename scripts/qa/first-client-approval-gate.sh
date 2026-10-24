#!/usr/bin/env bash
set -euo pipefail
case "${GCLOUD_PROJECT:-}" in demo-*) ;; *) echo REFUSE_NON_DEMO_PROJECT >&2;exit 2;;esac
case "${FIREBASE_AUTH_EMULATOR_HOST:-}" in 127.0.0.1:*) ;; *) echo REFUSE_NONLOCAL_AUTH >&2;exit 2;;esac
case "${FIRESTORE_EMULATOR_HOST:-}" in 127.0.0.1:*) ;; *) echo REFUSE_NONLOCAL_FIRESTORE >&2;exit 2;;esac
export GOOGLE_CLOUD_PROJECT="$GCLOUD_PROJECT"
export LUMA_INSTITUTION_APPROVAL_ENABLED=true
export LUMA_INSTITUTION_REQUESTS_ENABLED=true
export LUMA_INSTITUTION_DRAFT_ADMIN_ENABLED=true
export NEXT_TELEMETRY_DISABLED=1
if curl -fsS -m 1 -o /dev/null http://127.0.0.1:3195/academia/invitacion 2>/dev/null;then echo QA_PORT_BUSY >&2;exit 2;fi
setsid node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3195 > /tmp/luma-approval-next.log 2>&1 & p=$!
cleanup() { kill -- "-$p" >/dev/null 2>&1||true;wait "$p" >/dev/null 2>&1||true;};trap cleanup EXIT
for i in $(seq 1 120);do
 if curl -fsS -m 3 -o /dev/null http://127.0.0.1:3195/academia/invitacion 2>/dev/null;then break;fi
 if ! kill -0 "$p" 2>/dev/null;then tail -n 35 /tmp/luma-approval-next.log >&2;exit 2;fi
 sleep .5
done
node scripts/qa/first-client-approval-journey.mjs
