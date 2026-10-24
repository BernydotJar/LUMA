#!/usr/bin/env bash
# Isolated Firebase Auth + Firestore + LiveKit OSS acceptance, never production.
set -euo pipefail
cd "$(dirname "$0")/../.."
for tool in firebase openssl socat curl chromium; do
  command -v "$tool" >/dev/null || { echo "Missing dependency: $tool" >&2; exit 2; }
done
LIVEKIT_SERVER_BIN="$(command -v livekit-server || true)"
if test -z "$LIVEKIT_SERVER_BIN" && test -x /tmp/luma-livekit-real-provider/livekit-server; then
  LIVEKIT_SERVER_BIN=/tmp/luma-livekit-real-provider/livekit-server
fi
test -x "$LIVEKIT_SERVER_BIN" || { echo "Reviewed LiveKit OSS server binary required" >&2; exit 2; }
JAVA_HOME=/opt/luma-jre21
test -x "$JAVA_HOME/bin/java" || { echo "Java 21 is required" >&2; exit 2; }
export JAVA_HOME PATH="$JAVA_HOME/bin:$PATH"
d=/tmp/luma-two-students-uat-tls
mkdir -p "$d"
chmod 700 "$d"
if test ! -f "$d/cert.pem"; then
  openssl req -x509 -newkey rsa:2048 -sha256 -nodes \
    -keyout "$d/key.pem" -out "$d/cert.pem" -days 1 \
    -subj '/CN=127.0.0.1' \
    -addext 'subjectAltName=IP:127.0.0.1,DNS:localhost' >/dev/null 2>&1
fi
chmod 600 "$d/key.pem"
owned_lk=''
owned_proxy=''
cleanup() {
  if test -n "$owned_proxy"; then kill "$owned_proxy" 2>/dev/null || true; fi
  if test -n "$owned_lk"; then kill "$owned_lk" 2>/dev/null || true; fi
}
trap cleanup EXIT
if ! curl -fsS --max-time 2 http://127.0.0.1:7980 >/dev/null 2>&1; then
  "$LIVEKIT_SERVER_BIN" --dev --bind 127.0.0.1 --node-ip 127.0.0.1 \
    --config-body $'port: 7980\nrtc:\n  tcp_port: 7981\n  udp_port: 7982\n' \
    > "$d/uat-server.log" 2>&1 &
  owned_lk=$!
fi
for i in $(seq 1 25); do
  if curl -fsS --max-time 2 http://127.0.0.1:7980 >/dev/null 2>&1; then break; fi
  sleep .25
done
curl -fsS --max-time 3 http://127.0.0.1:7980 >/dev/null
if ! curl -fsS --cacert "$d/cert.pem" --max-time 2 https://127.0.0.1:7985 >/dev/null 2>&1; then
  socat OPENSSL-LISTEN:7985,reuseaddr,fork,bind=127.0.0.1,cert="$d/cert.pem",key="$d/key.pem",verify=0 \
    TCP:127.0.0.1:7980 > "$d/uat-proxy.log" 2>&1 &
  owned_proxy=$!
fi
for i in $(seq 1 25); do
  if curl -fsS --cacert "$d/cert.pem" --max-time 2 https://127.0.0.1:7985 >/dev/null 2>&1; then break; fi
  sleep .25
done
curl -fsS --cacert "$d/cert.pem" --max-time 4 https://127.0.0.1:7985 >/dev/null
export GOOGLE_CLOUD_PROJECT=demo-luma-live-uat
export LIVEKIT_URL=wss://127.0.0.1:7985
export LIVEKIT_API_KEY=devkey
export LIVEKIT_API_SECRET=secret
export NODE_EXTRA_CA_CERTS="$d/cert.pem"
firebase --config firebase.qa-live-e2e.json emulators:exec \
  --project demo-luma-live-uat --only auth,firestore \
  'node scripts/qa/live-two-students-auth-e2e.mjs'
