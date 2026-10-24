#!/usr/bin/env node
/**
 * LUMA-070/071 browser + HTTP UAT against disposable Firebase emulators.
 * Demo identities ONLY. Reject remote hosts, real projects and any production
 * calls. No fake production release attestation is emitted.
 */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { chromium } from "playwright";

const project = process.env.GCLOUD_PROJECT;
const base = process.env.LUMA_QA_BASE_URL;
const tenantId = process.env.LUMA_LEARNING_TENANT_ID;
assert.match(project ?? "", /^demo-luma-learning-[a-z0-9-]+$/);
assert.equal(base, "http://127.0.0.1:3298");
assert.equal(tenantId, "qa-learning-uat");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8085");
assert.equal(process.env.LUMA_LEARNING_ACCESS_MODE, "entitled");
assert.equal(process.env.NEXT_PUBLIC_LUMA_QA_FIREBASE_PROJECT, project);
assert.equal(process.env.NEXT_PUBLIC_LUMA_QA_AUTH_EMULATOR_URL, "http://127.0.0.1:9099");
assert.equal(process.env.LUMA_SCOPED_RAG_ISOLATION_ATTESTED, undefined);

const programA = "pnl-practitioner";
const programB = "pnl-advanced";
const reportPath = "evidence/learning-ui/qa-authorized-learning-uat.json";
const shotsPath = "/tmp/luma-learning-qa-20261020";
const runId = randomUUID().slice(0, 10);
mkdirSync("evidence/learning-ui", { recursive: true });
mkdirSync(shotsPath, { recursive: true });
const report = {
  suite: "LUMA-070/LUMA-071 authenticated program experience UAT",
  sourceSha: process.env.LUMA_QA_SOURCE_SHA || "UNVERIFIED",
  timestamp: new Date().toISOString(),
  environment: "demo Firebase Auth and Firestore Emulators + isolated local Next + headless Chromium",
  neverProduction: true,
  realRagBackendValidated: false,
  signedIndependentReviewer: false,
  checks: [],
  defects: [],
};
let browser;
const app = initializeApp({ projectId: project }, "luma-learning-uat-" + runId);
const admin = getAuth(app), db = getFirestore(app);

function reason(error) {
  return String(error?.message ?? error)
    .replace(/Bearer\s+[^\s"]+/gi, "Bearer <REDACTED>")
    .replace(/[a-z0-9+._-]+@example\.test/gi, "<SYNTHETIC>")
    .slice(0, 500);
}
async function check(title, action, severity = "P1") {
  try {
    const evidence = await action();
    console.log("PASS " + title);
    report.checks.push({ title, status: "PASS", ...(evidence ? { evidence } : {}) });
  } catch (error) {
    const message = reason(error);
    console.error("FAIL " + title + " " + message);
    report.checks.push({ title, status: "FAIL", severity, message });
    report.defects.push({ title, severity, message });
  }
}
function assertSuccess(res, allowed = [200]) {
  assert.ok(allowed.includes(res.status), "HTTP " + res.status + " " + JSON.stringify(res.body).slice(0, 300));
  return res.body;
}
async function rest(path, { method = "GET", token, program, body } = {}) {
  const response = await fetch(base + path, {
    method,
    cache: "no-store",
    headers: {
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...(program ? { "x-luma-program-id": program } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text.slice(0, 120) }; }
  return { status: response.status, body: parsed };
}
async function makeActor(prefix) {
  const email = "qa-" + prefix + "-" + runId + "@example.test";
  const password = "QaUat123!NotARealPassword";
  const user = await admin.createUser({
    email, password, emailVerified: true, displayName: "QA " + prefix,
  });
  return { uid: user.uid, email, password };
}
async function tokenFor(actor) {
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-qa-only", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: actor.email, password: actor.password, returnSecureToken: true }),
      signal: AbortSignal.timeout(9000),
    },
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.ok(body.idToken);
  assert.equal((await admin.verifyIdToken(body.idToken)).uid, actor.uid);
  return body.idToken;
}
async function enroll(actor, program) {
  const enrollmentId = createHash("sha256").update(actor.uid + ":" + program).digest("hex");
  const date = new Date().toISOString();
  await db.collection("commerceEnrollments").doc(enrollmentId).set({
    enrollmentId, entitlementId: enrollmentId, learnerId: actor.uid,
    tenantId, programId: program, productId: "synthetic-" + program,
    customerId: "synthetic-buyer-" + actor.uid, email: actor.email,
    status: "active", lastProvider: "hotmart",
    createdAt: date, updatedAt: date, lastEventAt: date, lastProviderEventId: "qa-transaction-" + runId,
  });
  return enrollmentId;
}
async function bootstrap(token, program, goal = "communication") {
  const response = await rest("/api/learning/plan", {
    method: "PUT", token, program, body: {
      onboarding: { goal, diagnostic: "b", confidence: 2, minutes: 12, createdAt: new Date().toISOString() },
    },
  });
  return assertSuccess(response);
}
async function openBrowser(actor, viewport = { width: 1365, height: 820 }) {
  const context = await browser.newContext({
    viewport, locale: "es-GT", reducedMotion: "reduce",
    isMobile: viewport.width < 500, hasTouch: viewport.width < 500,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(reason(error)));
  await page.goto(base + "/learn", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => Boolean(window.__lumaQaAuth), null, { timeout: 20000 });
  assert.equal(await page.evaluate(({ email, password }) => window.__lumaQaAuth.signIn(email, password), actor), actor.uid);
  // Two-program learners intentionally land on the mandatory picker, not the hero.
  await page.waitForFunction(() => Boolean(
    document.querySelector("#luma-program-learner") ||
    document.querySelector("#learner-home-title")
  ), null, { timeout: 25000 });
  return { context, page, errors };
}
async function run() {
  const actorA = await makeActor("learner-a");
  const actorB = await makeActor("learner-b");
  const actorC = await makeActor("learner-without-purchase");
  const [aEnrollment] = await Promise.all([
    enroll(actorA, programA), enroll(actorA, programB), enroll(actorB, programA),
  ]);
  const [aToken, bToken, cToken] = await Promise.all([tokenFor(actorA), tokenFor(actorB), tokenFor(actorC)]);
  await bootstrap(aToken, programA);
  await bootstrap(aToken, programB, "beliefs");
  await bootstrap(bToken, programA, "emotions");

  const chromiumBinary = process.env.LUMA_QA_BROWSER_BIN ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  browser = await chromium.launch({
    ...(chromiumBinary ? { executablePath: chromiumBinary } : {}),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const browserA = await openBrowser(actorA);
  const pageA = browserA.page;
  try {
    await check("Multi-program account must select an entitled program, not infer it", async () => {
      const picker = pageA.locator("select#luma-program-learner");
      await picker.waitFor();
      assert.equal(await picker.inputValue(), "");
      const choices = await picker.locator("option").allTextContents();
      assert.equal(choices.length, 3); // placeholder + two paid enrollments
      await picker.selectOption(programA);
      await pageA.getByTestId("program-entry-assessment").getByRole("button", { name: /Descubrir dónde empezar/i }).waitFor();
      return { courseCount: choices.length - 1, selectedProgram: programA };
    }, "P0");

    const before = assertSuccess(await rest("/api/learning/plan", { token: aToken, program: programA }));
    await check("Browser completes all five real entry-assessment steps and shows recommendation", async () => {
      const assessment = pageA.getByTestId("program-entry-assessment");
      await assessment.getByRole("button", { name: /Descubrir dónde empezar/i }).click();
      const quiz = assessment.getByTestId("entry-assessment-quiz");
      await quiz.waitFor();
      for (let i = 0; i < 5; i++) {
        await quiz.getByText(new RegExp("Situación " + (i + 1) + " de 5")).waitFor();
        await quiz.getByRole("radio").first().check();
        if (i < 4) await quiz.getByRole("button", { name: /Continuar/i }).click();
        else await quiz.getByRole("button", { name: /Ver mi ruta/i }).click();
      }
      await assessment.getByTestId("entry-assessment-result").waitFor({ timeout: 30000 });
      await pageA.screenshot({ path: shotsPath + "/learner-a-assessment-complete.png" });
      const result = await rest("/api/learning/entry-assessment", { token: aToken, program: programA });
      const body = assertSuccess(result);
      assert.equal(body.summary.total, 5);
      assert.equal(body.summary.twinAuthority, "none");
      assert.equal(body.recommendationActive, true);
      const after = assertSuccess(await rest("/api/learning/plan", { token: aToken, program: programA }));
      assert.deepEqual(after.plan.state.concepts, before.plan.state.concepts, "diagnostic may not inflate assessed mastery");
      assert.equal(after.scoredEvidence, null, "diagnostic cannot masquerade as scored evidence");
      assert.ok(after.plan.nextAction.href?.startsWith("/learn/experience/"));
      return { completed: 5, authority: body.summary.twinAuthority, scoredEvidence: false };
    }, "P0");

    await check("Reload preserves scoped recommendation without redoing the assessment", async () => {
      await pageA.reload({ waitUntil: "domcontentloaded" });
      await pageA.getByTestId("entry-assessment-result").waitFor({ timeout: 25000 });
      assert.ok((await pageA.getByTestId("entry-assessment-result").innerText()).includes("Tu punto de partida"));
      return { persistence: "server reload" };
    }, "P0");

    await check("Program switch does not expose assessment or mastery from other program", async () => {
      await pageA.locator("select#luma-program-learner").selectOption(programB);
      const r = await rest("/api/learning/entry-assessment", { token: aToken, program: programB });
      const body = assertSuccess(r);
      assert.equal(body.summary, null);
      const plan = assertSuccess(await rest("/api/learning/plan", { token: aToken, program: programB }));
      assert.notEqual(plan.plan.state.goal, before.plan.state.goal);
      await pageA.getByTestId("program-entry-assessment").getByRole("button", { name: /Descubrir dónde empezar/i }).waitFor({ timeout: 14000 });
      assert.equal(await pageA.getByTestId("entry-assessment-result").count(), 0);
      return { programA: "has assessment", programB: "empty assessment" };
    }, "P0");

    await check("Second learner cannot read first learner assessment", async () => {
      const body = assertSuccess(await rest("/api/learning/entry-assessment", { token: bToken, program: programA }));
      assert.equal(body.summary, null);
      assert.equal((await rest("/api/learning/plan", { token: bToken, program: programB })).status, 403);
      return { crossLearnerRead: "blank", crossProgramRead: 403 };
    }, "P0");

    await check("Browser class question uses authenticated context and visible recovery, not a fabricated source", async () => {
      await pageA.locator("select#luma-program-learner").selectOption(programA);
      await pageA.goto(base + "/learn/experience/calibracion-observar-antes-de-interpretar", { waitUntil: "domcontentloaded" });
      const tutor = pageA.locator("#luma");
      const input = tutor.getByRole("textbox", { name: /Pregunta a LUMA/i });
      // React 19 may paint SSR input before hydration; wait for live onChange
      // before interacting with the real controlled form.
      await pageA.waitForFunction(() => {
        const field = document.querySelector("#tutor-message");
        return Boolean(field && Object.keys(field).some((key) => key.startsWith("__reactProps$")));
      }, null, { timeout: 16000 });
      await input.fill("¿Cómo distinguir observación de interpretación?");
      await pageA.waitForFunction(() => {
        const button = document.querySelector('button[aria-label="Enviar pregunta"]');
        return Boolean(button && !button.disabled);
      }, null, { timeout: 15000 });
      await tutor.getByRole("button", { name: /Enviar pregunta/i }).click();
      await tutor.getByRole("status").filter({ hasText: /Necesitas otra vía para resolver tu pregunta/i }).waitFor({ timeout: 19000 });
      assert.equal(await tutor.locator('a[title*="chunk"]').count(), 0, "No fabricated cited source on RAG outage");
      await pageA.screenshot({ path: shotsPath + "/learner-a-tutor-unavailable.png" });
      return { questionSubmitted: true, safeFallbackVisible: true };
    }, "P0");

    await check("Unenrolled user cannot request another student's program", async () => {
      assert.equal((await rest("/api/learning/entry-assessment", { token: cToken, program: programA })).status, 403);
      assert.equal((await rest("/api/learning/plan", { token: cToken, program: programA })).status, 403);
      return { assessmentDenied: 403, planDenied: 403 };
    }, "P0");

    await check("Concurrent program-B assessments serialize to one record even with different event IDs", async () => {
      const questions = assertSuccess(await rest("/api/learning/entry-assessment", { token: aToken, program: programB })).questions;
      const answers = Object.fromEntries(questions.map((q) => [q.slug, q.choices[0].id]));
      const [first, second] = await Promise.all([
        rest("/api/learning/entry-assessment", {
          token: aToken, program: programB, method: "POST",
          body: { eventId: "qa-parallel-" + randomUUID(), answers },
        }),
        rest("/api/learning/entry-assessment", {
          token: aToken, program: programB, method: "POST",
          body: { eventId: "qa-parallel-" + randomUUID(), answers },
        }),
      ]);
      assert.deepEqual([first.status, second.status].sort(), [200, 429]);
      const stored = assertSuccess(await rest("/api/learning/plan", { token: aToken, program: programB }));
      assert.equal(stored.persistence.version, 2);
      assert.equal(stored.scoredEvidence, null);
      return { race: "one commit", records: 1, statuses: [first.status, second.status].sort() };
    }, "P0");

    await check("Class tutor fails closed without real scoped RAG, never invents evidence", async () => {
      const response = await rest("/api/tutor", {
        method: "POST", token: aToken, program: programA,
        body: { message: "¿Cómo separar observación e interpretación en esta práctica?",
          learningContext: { classSlug: "calibracion-observar-antes-de-interpretar", step: "practice" } },
      });
      assert.equal(response.status, 503);
      assert.equal(response.body.trust?.status, "RETRIEVAL_UNAVAILABLE");
      assert.equal(response.body.evidence, undefined);
      return { status: 503, trust: response.body.trust.status };
    }, "P0");

    await check("Invalid/missing auth cannot access learner assessment", async () => {
      assert.equal((await rest("/api/learning/entry-assessment", { program: programA })).status, 401);
      assert.equal((await rest("/api/learning/entry-assessment", { token: "qa-fake", program: programA })).status, 401);
      return { anonymous: 401, forgedToken: 401 };
    }, "P0");

    await check("Revocation rejects even a previously valid token and current assessment", async () => {
      await db.collection("commerceEnrollments").doc(aEnrollment).update({ status: "revoked" });
      assert.equal((await rest("/api/learning/entry-assessment", { token: aToken, program: programA })).status, 403);
      const questions = assertSuccess(await rest("/api/learning/entry-assessment", {
        token: aToken, program: programB,
      })).questions;
      const validAnswers = Object.fromEntries(questions.map((q) => [q.slug, q.choices[0].id]));
      const reply = await rest("/api/learning/entry-assessment", {
        method: "POST", token: aToken, program: programA,
        body: { eventId: "blocked-" + randomUUID(), answers: validAnswers },
      });
      assert.equal(reply.status, 403, "revoked token must not write a valid assessment event");
      assert.equal((await rest("/api/learning/plan", { token: aToken, program: programA })).status, 403);
      return { revokedGet: 403, revokedWrite: 403, revokedPlan: 403 };
    }, "P0");

    await check("Authenticated browser has no runtime exceptions", async () => {
      assert.deepEqual(browserA.errors, []);
      return { pageErrors: 0 };
    }, "P1");

    const mobile = await openBrowser(actorB, { width: 390, height: 844 });
    try {
      await check("Mobile entitled learner can access protected assessment CTA without overflow", async () => {
        const cta = mobile.page.getByTestId("program-entry-assessment").getByRole("button", { name: /Descubrir dónde empezar/i });
        await cta.waitFor({ timeout: 20000 });
        const geometry = await mobile.page.evaluate(() => ({
          viewport: window.innerWidth,
          doc: document.documentElement.scrollWidth,
        }));
        assert.ok(geometry.doc - geometry.viewport <= 3, JSON.stringify(geometry));
        await cta.click();
        await mobile.page.getByTestId("entry-assessment-quiz").waitFor();
        await mobile.page.screenshot({ path: shotsPath + "/learner-b-mobile-assessment.png" });
        return { viewport: geometry.viewport, overflow: geometry.doc - geometry.viewport };
      }, "P1");
    } finally { await mobile.context.close(); }
  } finally { await browserA.context.close(); }
}
try {
  await run();
} catch (error) {
  const message = reason(error);
  console.error("UNHANDLED_UAT_FAILURE " + message);
  report.defects.push({ title: "runner/bootstrap", severity: "P0", message });
} finally {
  await browser?.close();
  await deleteApp(app);
  report.passed = report.checks.filter((c) => c.status === "PASS").length;
  report.failed = report.checks.filter((c) => c.status === "FAIL").length;
  report.decision = report.defects.length ? "QA_NO_GO" : "TECHNICAL_QA_PASS_RELEASE_NO_GO";
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log("UAT_RESULT " + report.decision + " " + report.passed + " passed, " + report.defects.length + " defects");
}
if (report.defects.length) process.exitCode = 1;
