#!/usr/bin/env bash
set -euo pipefail

PORT=3111
LOG=/tmp/luma-coach-api-next.log

cleanup() {
  if [[ -n "${NEXT_PID:-}" ]]; then
    kill -- "-$NEXT_PID" >/dev/null 2>&1 || true
    wait "$NEXT_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

setsid npm run dev -- --hostname 127.0.0.1 --port "$PORT" >"$LOG" 2>&1 &
NEXT_PID=$!

for _ in $(seq 1 80); do
  if curl -sS "http://127.0.0.1:$PORT/api/learning/plan" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$NEXT_PID" >/dev/null 2>&1; then
    cat "$LOG"
    exit 1
  fi
  sleep 0.25
done

node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const base = "http://127.0.0.1:3111";
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const projectId = process.env.GCLOUD_PROJECT || "demo-luma-persistent-twin";

const adminApp = getApps()[0] ?? initializeApp({ projectId });
const adminAuth = getAuth(adminApp);

async function json(response) {
  const body = await response.json();
  return { status: response.status, body };
}

async function signUp(label) {
  const email = `${label}-${Date.now()}@example.test`;
  const password = "Passw0rd!Luma";
  const response = await fetch(`${authBase}/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return { uid: body.localId, token: body.idToken, email, password };
}

async function signIn(user) {
  const response = await fetch(`${authBase}/accounts:signInWithPassword?key=fake-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      returnSecureToken: true,
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body.idToken;
}

async function api(path, token, init = {}) {
  return json(await fetch(base + path, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  }));
}

const learner = await signUp("coach-source-learner");
const ordinary = await signUp("ordinary-user");
const coach = await signUp("coach-user");

const bootstrap = await api("/api/learning/plan", learner.token, {
  method: "PUT",
  body: JSON.stringify({
    onboarding: {
      goal: "emotions",
      diagnostic: "b",
      confidence: 2,
      minutes: 12,
      createdAt: "2026-10-06T05:30:00.000Z",
    },
  }),
});
assert.equal(bootstrap.status, 200);
const beforeAction = bootstrap.body.plan.nextAction.id;

const event = await api("/api/learning/events", learner.token, {
  method: "POST",
  body: JSON.stringify({
    eventId: "evt-coach-source-001",
    event: {
      type: "SIMULATION_COMPLETED",
      conceptId: "pas",
      answers: {
        thought: "pas",
        emotion: "shame",
        reframe: "balanced",
      },
      attempts: { thought: 1, emotion: 1, reframe: 1 },
      completedAt: "2026-10-06T05:31:00.000Z",
      sourceId: "coach-source-smoke",
    },
  }),
});
assert.equal(event.status, 200);
assert.notEqual(event.body.plan.nextAction.id, beforeAction);

const ordinaryList = await api("/api/coach/learners", ordinary.token);
assert.equal(ordinaryList.status, 403);

await adminAuth.setCustomUserClaims(coach.uid, { coach: true });
const coachToken = await signIn(coach);

const coachList = await api("/api/coach/learners", coachToken);
assert.equal(coachList.status, 200);
const listed = coachList.body.learners.find((item) => item.learnerId === learner.uid);
assert.ok(listed);
assert.equal(listed.nextActionId, event.body.plan.nextAction.id);

const coachDetail = await api(
  `/api/coach/learners/${encodeURIComponent(learner.uid)}`,
  coachToken,
);
assert.equal(coachDetail.status, 200);
assert.equal(coachDetail.body.record.learnerId, learner.uid);
assert.equal(coachDetail.body.plan.nextAction.id, event.body.plan.nextAction.id);
assert.equal(coachDetail.body.record.version, 2);
assert.equal(coachDetail.body.events.length, 1);
assert.equal(coachDetail.body.events[0].eventId, "evt-coach-source-001");

console.log(JSON.stringify({
  ordinaryUserStatus: ordinaryList.status,
  coachStatus: coachList.status,
  coachClaim: true,
  learnerId: learner.uid,
  beforeAction,
  afterAction: event.body.plan.nextAction.id,
  listMatchesAuthoritativeAction: listed.nextActionId === event.body.plan.nextAction.id,
  detailMatchesAuthoritativeAction:
    coachDetail.body.plan.nextAction.id === event.body.plan.nextAction.id,
  eventLedgerCount: coachDetail.body.events.length,
  version: coachDetail.body.record.version,
}, null, 2));
NODE
