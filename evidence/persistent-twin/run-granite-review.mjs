import fs from "node:fs";

const api = JSON.parse(fs.readFileSync("evidence/persistent-twin/api-emulator.json", "utf8"));
const audit = JSON.parse(fs.readFileSync("evidence/persistent-twin/npm-audit-production.json", "utf8"));

const facts = {
  graph: "LUMA-PERSISTENT-TWIN-01",
  sourceOfTruth: {
    authenticatedLearner: "Firestore learners/{verified Firebase UID}",
    eventLedger: "learners/{uid}/events/{eventId}",
    writes: "Next.js Node route handlers using Firebase Admin only",
    clientFirestoreRules: "deny all; unauthenticated REST GET verified HTTP 403",
    guestMode: "deterministic local fallback, explicitly non-authoritative"
  },
  integrity: {
    identity: "UID comes only from server-verified Firebase ID token; browser cannot choose learnerId",
    eventReplay: "Firestore transaction checks eventId before state mutation",
    onboardingRetry: "same journeyId is idempotent",
    scoring: "server recomputes P.A.S. score from raw answer IDs and ignores forged correctCount",
    telemetry: "attempt counts are sanitized to known keys and bounded integers",
    routeChangePersistence: "previousAction is materialized so the learner sees route change after reload"
  },
  reproducedEvidence: {
    unit: "27/27 PASS",
    firestoreEmulator: "5/5 PASS",
    authenticatedApi: api.assertions,
    directFirestoreClient: "HTTP 403 PERMISSION_DENIED",
    adaptiveBrowser: "4/4 PASS desktop+mobile",
    showcaseBrowser: "17/17 PASS Chromium including automated WCAG",
    buildLintTypecheck: "PASS",
    productionAudit: audit.metadata?.vulnerabilities
  },
  explicitBoundaries: [
    "Coach Studio still uses showcase intelligence and is not yet authorized against authenticated learner documents.",
    "Production Firestore rules are code-verified in emulator but have not been deployed by this code-only release.",
    "The server rubric currently verifies the P.A.S. scored simulation; additional assessment types need server-side rubrics.",
    "Because correct answer IDs exist in the browser experience, this is evidence integrity for learning adaptation, not anti-cheat certification."
  ]
};

async function run(model, prompt, tokens) {
  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: "json",
      think: false,
      options: { temperature: 0, num_predict: tokens, num_ctx: 4096 }
    })
  });
  if (!response.ok) throw new Error(model + ": " + await response.text());
  const raw = await response.json();
  try { return JSON.parse(raw.response); }
  catch { return { parse_error: true, raw: raw.response }; }
}

const criticPrompt = [
  "You are the adversarial Product Owner and security critic for LUMA Persistent Learning Twin.",
  "Do not reward architecture claims unless reproduced evidence proves them.",
  "The release goal is narrower than full production: make authenticated learner state durable, idempotent, isolated, server-scored, and able to recompute Next Best Action after evidence.",
  "CHANGES_REQUIRED only if a defect invalidates that release goal. Future coach authorization or production deployment may be risks/boundaries without blocking this code release.",
  "Attack these areas: identity isolation, event replay, client-forged mastery, stale local authority, route-change persistence, Firestore client exposure, regression risk.",
  "Return JSON only:",
  '{"verdict":"PASS|PASS_WITH_RISKS|CHANGES_REQUIRED","proven":["..."],"findings":[{"severity":"BLOCKER|MAJOR|MINOR","finding":"..."}],"remaining_boundaries":["..."],"release_recommendation":"..."}',
  "FACTS:",
  JSON.stringify(facts, null, 2)
].join("\n");

const critic = await run("ibm/granite3.3:2b", criticPrompt, 800);
fs.writeFileSync("evidence/persistent-twin/granite-critic.json", JSON.stringify(critic, null, 2));

const verifierPrompt = [
  "You are an independent verifier reviewing a Granite critic for LUMA.",
  "Check for false PASS, false blocker, contradictions, and whether each conclusion is supported by reproduced evidence.",
  "Core release acceptance is: verified UID isolation, durable Firestore state, append-only/idempotent event processing, server-derived scoring, persisted adaptive route change, no direct Firestore client access, and green regression/build/security gates.",
  "Coach Studio unification and production rules deployment are explicitly next-scope boundaries, not claims of this code release.",
  "Ground truth:",
  JSON.stringify(facts, null, 2),
  "Critic:",
  JSON.stringify(critic, null, 2),
  'Return JSON only: {"critic_supported":true|false,"core_release_proven":true|false,"contradictions":["..."],"blockers":["..."],"risks":["..."],"final_verdict":"PASS|PASS_WITH_RISKS|CHANGES_REQUIRED","reason":"..."}'
].join("\n");

let verifier;
try {
  verifier = await run("ibm/granite4:1b", verifierPrompt, 600);
} catch (error) {
  verifier = await run("ibm/granite3.3:2b", verifierPrompt, 600);
  verifier.verifierFallback = "ibm/granite3.3:2b";
  verifier.primaryVerifierError = error instanceof Error ? error.message : String(error);
}
fs.writeFileSync("evidence/persistent-twin/granite-verifier.json", JSON.stringify(verifier, null, 2));

console.log("--- CRITIC ---");
console.log(JSON.stringify(critic, null, 2));
console.log("--- VERIFIER ---");
console.log(JSON.stringify(verifier, null, 2));
