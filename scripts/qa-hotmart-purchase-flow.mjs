/**
 * Local integration E2E: approved Hotmart purchase -> commerce webhook ->
 * verified learner access -> practice receipt -> scoped coach -> refund.
 * Never calls Hotmart. All HTTP destinations are loopback and Firebase demo-*.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const project = process.env.GCLOUD_PROJECT;
const firebaseHost = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const base = process.env.LUMA_HOTMART_QA_URL;
const tenant = process.env.LUMA_LEARNING_TENANT_ID;
const program = process.env.LUMA_LEARNING_PROGRAM_ID;
const hotmartHottok = process.env.HOTMART_HOTTOK;

assert.ok(project?.startsWith("demo-"), "SAFETY_BLOCK: demo Firebase project required");
assert.match(firebaseHost ?? "", /^(127\.0\.0\.1|localhost):\d+$/);
assert.match(authHost ?? "", /^(127\.0\.0\.1|localhost):\d+$/);
assert.match(base ?? "", /^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(process.env.LUMA_LEARNING_ACCESS_MODE, "entitled");
assert.ok(tenant?.startsWith("qa-"), "SAFETY_BLOCK: QA tenant required");
assert.equal(program, "pnl-practitioner");
assert.equal(hotmartHottok, "qa-only-hotmart-hottok-not-real");

const app = initializeApp({ projectId: project }, "qa-hotmart-" + randomUUID());
const firestore = getFirestore(app);
const adminAuth = getAuth(app);
const runId = randomUUID().slice(0, 12);
const buyerEmail = "qa-hotmart-" + runId + "@example.test";
const productExternalId = "hotmart-pnl-" + runId;
const transaction = "QA-HP-" + runId;
const beforePurchase = Date.now() - 10000;
const report = {
  kind: "hotmart-approved-purchase-qa-e2e",
  environment: "LOCAL_EMULATOR_ONLY",
  project,
  productionWrites: false,
  simulatedOnly: true,
  events: {},
  learning: {},
  security: {},
  cleanup: "Firebase emulators shut down on command exit",
};
// A direct TS import isn't supported in ordinary Node; mapping can be seeded
// using exactly the Firestore document ID contract from src/lib/commerce/mapping.ts.
// This is deliberate: every behavior after mapping uses real Next HTTP APIs.

const mappingKey = JSON.stringify(["hotmart", productExternalId]);
const mappingDocId = createHash("sha256").update(mappingKey).digest("hex");

function check(condition, label) {
  assert.ok(condition, label);
  console.log("PASS " + label);
}

async function http(path, { method = "GET", token, hottok, body, headers = {} } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...(hottok !== undefined ? { "x-hotmart-hottok": hottok } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(35000),
  });
  const raw = await response.text();
  let result;
  try {
    result = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("Expected JSON from " + path + ": HTTP " + response.status);
  }
  return { status: response.status, body: result };
}

async function signIn(user) {
  const response = await fetch(
    "http://" + authHost + "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-qa-only",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
        returnSecureToken: true,
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  const payload = await response.json();
  assert.equal(response.status, 200, "Firebase Auth emulator signin");
  const decoded = await adminAuth.verifyIdToken(payload.idToken);
  assert.equal(decoded.uid, user.uid);
  assert.equal(decoded.email_verified, true);
  return payload.idToken;
}

async function createQaAccount(label, claims) {
  const email = "qa-hotmart-" + label + "-" + runId + "@example.test";
  const password = "QaOnly123!NotProduction";
  const actor = await adminAuth.createUser({ email, password, emailVerified: true });
  if (claims) await adminAuth.setCustomUserClaims(actor.uid, claims);
  const user = { uid: actor.uid, email, password };
  return { ...user, token: await signIn(user) };
}

function mockHotmartPayload(eventName, externalEventId, occurredAt, email) {
  return {
    id: externalEventId,
    event: eventName,
    version: "2.0.0",
    creation_date: occurredAt,
    data: {
      product: {
        id: 987001,
        ucode: "qa-product-ucode",
        external_id: productExternalId,
        name: "Practitioner PNL (QA simulated)",
      },
      buyer: {
        ucode: "qa-buyer-code-" + runId,
        email,
        name: "QA Learner (not a real customer)",
      },
      purchase: {
        transaction,
        status: eventName === "PURCHASE_REFUNDED" ? "REFUNDED" : "APPROVED",
        recurrence_number: 1,
      },
    },
  };
}

try {
  // Provision QA test identity and mapping in the emulator, NOT Hotmart.
  const buyer = await adminAuth.createUser({
    email: buyerEmail,
    password: "QaOnly123!NotProduction",
    emailVerified: true,
  });
  const learner = {
    uid: buyer.uid,
    email: buyerEmail,
    password: "QaOnly123!NotProduction",
  };
  const token = await signIn(learner);
  const unentitled = await createQaAccount("no-purchase");
  const coach = await createQaAccount("coach", {
    coach: true, coachTenantIds: [tenant],
  });
  const foreignCoach = await createQaAccount("foreign-coach", {
    coach: true, coachTenantIds: ["qa-other-tenant"],
  });
  console.log("QA_FIXTURES_CREATED (emulator only, no user identifiers logged)");

  const noAuth = await http("/api/learning/plan");
  check(noAuth.status === 401, "anonymous learning plan denied");
  const locked = await http("/api/learning/plan", { token });
  check(locked.status === 403 && locked.body.error === "active_enrollment_required",
    "buyer cannot access paid learning before approval");
  report.security.guestDenied = 401;
  report.security.beforePurchaseDenied = 403;

  const mapping = {
    provider: "hotmart",
    externalProductId: productExternalId,
    tenantId: tenant,
    productId: program,
    programId: program,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await firestore.collection("commerceProductMappings").doc(mappingDocId).set(mapping);
  check((await firestore.collection("commerceProductMappings").doc(mappingDocId).get()).exists,
    "Hotmart QA product maps to LUMA course");

  const purchasePayload = mockHotmartPayload(
    "PURCHASE_APPROVED", "qa-approved-" + runId, beforePurchase, buyerEmail,
  );
  const badSignature = await http("/api/commerce/webhooks/hotmart", {
    method: "POST", hottok: "wrong-qa-token", body: purchasePayload,
  });
  check(badSignature.status === 401, "invalid Hotmart Hottok rejected");
  report.security.badHottokDenied = 401;

  const approved = await http("/api/commerce/webhooks/hotmart", {
    method: "POST", hottok: hotmartHottok, body: purchasePayload,
  });
  check(approved.status === 200 && approved.body.accepted === true &&
    approved.body.outcome === "granted" &&
    approved.body.enrollment?.programId === program &&
    approved.body.enrollment?.status === "active",
    "mock PURCHASE_APPROVED creates active entitlement + enrollment");
  report.events.purchaseApproved = approved.status;

  const replay = await http("/api/commerce/webhooks/hotmart", {
    method: "POST", hottok: hotmartHottok, body: purchasePayload,
  });
  check(replay.status === 200 && replay.body.duplicate === true,
    "replaying approved purchase is idempotent");
  report.events.replayDuplicate = replay.body.duplicate;

  const access = await http("/api/commerce/access", { token });
  check(access.status === 200 && access.body.enrollments?.length === 1 &&
    access.body.enrollments[0].tenantId === tenant &&
    access.body.enrollments[0].programId === program &&
    access.body.enrollments[0].status === "active",
    "verified purchaser claims exactly one entitled LUMA course");
  const stored = await firestore.collection("commerceEnrollments").where("email", "==", buyerEmail).get();
  check(stored.size === 1 && stored.docs[0].data().learnerId === buyer.uid,
    "Firestore enrollment has correct buyer identity, not only localStorage");
  report.events.enrollmentCount = stored.size;

  const otherBuyer = await http("/api/learning/plan", { token: unentitled.token });
  check(otherBuyer.status === 403, "unentitled Firebase identity cannot access purchase");
  const wrongProgram = await http("/api/learning/plan", {
    token,
    headers: { "x-luma-program-id": "qa-nonpurchased-course" },
  });
  check(wrongProgram.status === 403, "paid learner cannot access unrelated course");
  report.security.otherBuyerDenied = otherBuyer.status;
  report.security.wrongProgramDenied = wrongProgram.status;

  const unopened = await http("/api/learning/plan", { token });
  check(unopened.status === 404, "newly enrolled learner starts without fabricated progress");

  const onboarding = await http("/api/learning/plan", {
    method: "PUT",
    token,
    body: {
      onboarding: {
        goal: "emotions",
        diagnostic: "b",
        confidence: 2,
        minutes: 12,
        createdAt: new Date().toISOString(),
      },
    },
  });
  check(onboarding.status === 200 &&
    onboarding.body.persistence?.source === "firestore" &&
    onboarding.body.persistence?.version === 1,
    "onboarding stored in Firestore under entitlement scope");
  const previousAction = onboarding.body.plan.nextAction.id;

  const result = await http("/api/learning/events", {
    method: "POST",
    token,
    body: {
      eventId: "qa-practice-" + runId,
      event: {
        type: "SIMULATION_COMPLETED",
        conceptId: "pas",
        correctCount: 0,
        answers: { thought: "pas", emotion: "shame", reframe: "balanced" },
        attempts: { thought: 1, emotion: 1, reframe: 1 },
        completedAt: new Date().toISOString(),
        sourceId: "qa-local-course-module",
      },
    },
  });
  check(result.status === 200 &&
    result.body.persistence?.source === "firestore" &&
    result.body.persistence?.version === 2 &&
    result.body.duplicate === false,
    "practice result persists to authenticated Firestore");
  const nextAction = result.body.plan?.nextAction?.id;
  check(Boolean(nextAction && nextAction !== previousAction),
    "practical evidence updates the recommended learning action");
  report.learning.eventVersion = result.body.persistence.version;
  report.learning.nextStepChanged = true;

  const freshToken = await signIn(learner);
  const restored = await http("/api/learning/plan", { token: freshToken });
  check(restored.status === 200 &&
    restored.body.persistence?.source === "firestore" &&
    restored.body.persistence?.version === 2 &&
    restored.body.plan?.nextAction?.id === nextAction,
    "new login retrieves paid learner evidence from Firestore (no shared browser state)");

  const coachList = await http("/api/coach/learners", { token: coach.token });
  check(coachList.status === 200 &&
    coachList.body.learners?.some((row) => row.learnerId === buyer.uid),
    "tenant-scoped coach can find enrolled learner");
  const coachDetail = await http("/api/coach/learners/" + encodeURIComponent(buyer.uid), {
    token: coach.token,
  });
  check(coachDetail.status === 200 &&
    coachDetail.body.record?.version === 2 &&
    coachDetail.body.events?.length === 1,
    "coach can read authorized rubric-backed practice evidence");
  report.learning.coachSeesEvidence = true;

  const crossTenant = await http("/api/coach/learners/" + encodeURIComponent(buyer.uid), {
    token: foreignCoach.token,
  });
  check(crossTenant.status === 403, "foreign tenant coach cannot read paid learner");
  report.security.crossTenantCoachDenied = crossTenant.status;

  const refundPayload = mockHotmartPayload(
    "PURCHASE_REFUNDED", "qa-refund-" + runId, beforePurchase + 5000, buyerEmail,
  );
  const refunded = await http("/api/commerce/webhooks/hotmart", {
    method: "POST", hottok: hotmartHottok, body: refundPayload,
  });
  check(refunded.status === 200 && refunded.body.outcome === "revoked" &&
    refunded.body.enrollment?.status === "revoked",
    "mock Hotmart refund revokes matching course enrollment");
  const lockedAgain = await http("/api/learning/plan", { token: freshToken });
  check(lockedAgain.status === 403, "refunded learner loses protected course access");
  const coachAfterRefund = await http("/api/coach/learners/" + encodeURIComponent(buyer.uid), {
    token: coach.token,
  });
  check(coachAfterRefund.status === 403,
    "coach can no longer read revoked buyer evidence via entitled scope");
  const refundReplay = await http("/api/commerce/webhooks/hotmart", {
    method: "POST", hottok: hotmartHottok, body: refundPayload,
  });
  check(refundReplay.status === 200 && refundReplay.body.duplicate === true,
    "refund replay is idempotent");
  report.events.refunded = true;
  report.events.refundReplayDuplicate = true;
  report.security.refundRevokesLearner = lockedAgain.status;
  report.security.refundRevokesCoachAccess = coachAfterRefund.status;

  console.log("E2E_REPORT " + JSON.stringify({ verdict: "PASS", ...report }));
} finally {
  await deleteApp(app);
}
