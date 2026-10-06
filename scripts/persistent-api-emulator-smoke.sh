#!/usr/bin/env bash
set -euo pipefail

PORT=3110
LOG=/tmp/luma-persistent-api-next.log

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

const base = "http://127.0.0.1:3110";
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";

async function json(response) {
  const body = await response.json();
  return { status: response.status, body };
}

async function signUp(label) {
  const response = await fetch(`${authBase}/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `${label}-${Date.now()}@example.test`,
      password: "Passw0rd!Luma",
      returnSecureToken: true,
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return { uid: body.localId, token: body.idToken };
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

const unauth = await api("/api/learning/plan");
assert.equal(unauth.status, 401);

const learnerA = await signUp("learner-a");
const learnerB = await signUp("learner-b");
assert.notEqual(learnerA.uid, learnerB.uid);

const missingB = await api("/api/learning/plan", learnerB.token);
assert.equal(missingB.status, 404);

const bootstrapA = await api("/api/learning/plan", learnerA.token, {
  method: "PUT",
  body: JSON.stringify({
    onboarding: {
      goal: "emotions",
      diagnostic: "b",
      confidence: 2,
      minutes: 12,
      createdAt: "2026-10-05T15:00:00.000Z",
    },
  }),
});
assert.equal(bootstrapA.status, 200);
assert.equal(bootstrapA.body.persistence.version, 1);
const beforeAction = bootstrapA.body.plan.nextAction.id;

const bootstrapB = await api("/api/learning/plan", learnerB.token, {
  method: "PUT",
  body: JSON.stringify({
    onboarding: {
      goal: "communication",
      diagnostic: "a",
      confidence: 4,
      minutes: 35,
      createdAt: "2026-10-05T15:01:00.000Z",
    },
  }),
});
assert.equal(bootstrapB.status, 200);
assert.notEqual(bootstrapB.body.plan.nextAction.id, beforeAction);

const eventId = "evt-api-pas-001";
const eventPayload = {
  eventId,
  event: {
    type: "SIMULATION_COMPLETED",
    conceptId: "pas",
    correctCount: 0,
    answers: {
      thought: "pas",
      emotion: "shame",
      reframe: "balanced",
    },
    attempts: { thought: 1, emotion: 1, reframe: 1 },
    completedAt: "2026-10-05T15:05:00.000Z",
    sourceId: "1OwHgWtDXC_AzkU31f6a7tuoHWHl0gv5V",
  },
};

const firstEvent = await api("/api/learning/events", learnerA.token, {
  method: "POST",
  body: JSON.stringify(eventPayload),
});
assert.equal(firstEvent.status, 200);
assert.equal(firstEvent.body.duplicate, false);
assert.equal(firstEvent.body.persistence.version, 2);
assert.equal(firstEvent.body.plan.routeChanged, true);
assert.notEqual(firstEvent.body.plan.nextAction.id, beforeAction);

const replay = await api("/api/learning/events", learnerA.token, {
  method: "POST",
  body: JSON.stringify(eventPayload),
});
assert.equal(replay.status, 200);
assert.equal(replay.body.duplicate, true);
assert.equal(replay.body.persistence.version, 2);

const afterA = await api("/api/learning/plan", learnerA.token);
const afterB = await api("/api/learning/plan", learnerB.token);
assert.equal(afterA.status, 200);
assert.equal(afterB.status, 200);
assert.equal(afterA.body.persistence.version, 2);
assert.equal(afterB.body.persistence.version, 1);
assert.notEqual(afterA.body.plan.state.learnerId, afterB.body.plan.state.learnerId);
assert.notEqual(afterA.body.plan.nextAction.id, afterB.body.plan.nextAction.id);

console.log(JSON.stringify({
  unauthenticatedStatus: unauth.status,
  learnerA: {
    uid: learnerA.uid,
    beforeAction,
    afterAction: afterA.body.plan.nextAction.id,
    version: afterA.body.persistence.version,
    replayDuplicate: replay.body.duplicate,
  },
  learnerB: {
    uid: learnerB.uid,
    action: afterB.body.plan.nextAction.id,
    version: afterB.body.persistence.version,
  },
  serverVerifiedCorrectAnswersDespiteClientCorrectCountZero:
    firstEvent.body.plan.routeChanged === true,
}, null, 2));
NODE
