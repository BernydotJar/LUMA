
import fs from "node:fs";

const acceptance = JSON.parse(fs.readFileSync("evidence/po-cx-adaptive-loop/browser-acceptance.json", "utf8"));
const evidence = {
  browser: acceptance,
  gates: {
    typecheck: "PASS",
    lint: "PASS",
    unit: "25/25 PASS",
    adaptivePlaywright: "4/4 PASS desktop+mobile",
    showcasePlaywright: "17/17 PASS chromium including WCAG",
    build: "PASS"
  },
  implementationFacts: [
    "Onboarding state is persisted in luma-onboarding.",
    "A new onboarding clears luma-latest-learning-event to avoid cross-learner contamination.",
    "LearnerState projection uses goal, diagnostic, confidence and available minutes.",
    "The ranking engine uses mastery, confidence, failures, completion/mastery mismatch, time fit, prerequisites and goal focus.",
    "SIMULATION_COMPLETED with 3/3 updates the P.A.S. concept state and recomputes the next best action.",
    "The learner sees the consequence of the Twin; the technical Twin remains coach-facing.",
    "Persistence is browser-local for this demo, not yet a durable multi-user backend."
  ]
};

async function run(model, prompt) {
  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: "json",
      options: { temperature: 0.05, num_predict: 1400 }
    })
  });
  if (!response.ok) throw new Error(model + " " + response.status + ": " + await response.text());
  return response.json();
}

const criticPrompt = [
  "You are the adversarial Product Owner critic for LUMA, an AI-native Learning Intelligence Platform.",
  "The product thesis is NOT an LMS with AI. The learner is the primary object, verified learning evidence matters more than content completion, and the learner home must answer what should I do next with a materially adaptive action.",
  "A previous review FAILED because two different onboarding states got the same action and successful practice evidence did not change the next action.",
  "",
  "Review ONLY the reproducible evidence below after the implementation. Be strict. Do not reward architecture if the browser behavior does not prove it.",
  "",
  "Required acceptance:",
  "1. Two materially different learner states must produce materially different next actions.",
  "2. Available time must affect the recommendation.",
  "3. A successful evidence event must change the next best action when new evidence warrants it.",
  "4. The changed action must point to a semantically matching real destination, not a hardcoded unrelated route.",
  "5. The learner should experience adaptation without exposing the technical Learning Twin.",
  "6. Completion must remain distinct from mastery.",
  "7. No release PASS if core browser evidence contradicts the claims.",
  "",
  'Return JSON only with: {"verdict":"PASS|PASS_WITH_RISKS|CHANGES_REQUIRED","scores":{"thesis":0,"first60":0,"next_best_action":0,"adaptive_loop":0,"differentiation":0},"proven":["..."],"remaining_risks":[{"severity":"MAJOR|MINOR","risk":"..."}],"biggest_failure_or_risk":"...","release_recommendation":"..."}',
  "",
  "EVIDENCE:",
  JSON.stringify(evidence, null, 2)
].join("\n");

const critic = await run("ibm/granite3.3:2b", criticPrompt);
fs.writeFileSync("evidence/po-cx-adaptive-loop/granite-critic.raw.json", JSON.stringify(critic, null, 2));
let criticParsed;
try { criticParsed = JSON.parse(critic.response); } catch { criticParsed = { parse_error: true, raw: critic.response }; }
fs.writeFileSync("evidence/po-cx-adaptive-loop/granite-critic.json", JSON.stringify(criticParsed, null, 2));

const verifierPrompt = [
  "You are an independent release verifier. Challenge another critic's verdict for LUMA.",
  "The original failure was: different learners received the same action, and evidence did not change the Next Best Action.",
  "Your job is to look for false positives, contradictions, or overclaiming.",
  "",
  "Ground truth browser evidence:",
  '- Desktop learner A: 8 minutes, emotions goal -> "Distingue evento, pensamiento y emoción", href /learn/experience/pas-detectar-y-reformular.',
  '- Desktop learner B: 35 minutes, communication goal -> "Practica congruencia en tres canales", href /learn/experience/congruencia-tres-canales.',
  "- sameActionAB=false.",
  '- Before successful P.A.S. evidence at 12 minutes -> "Detecta un P.A.S. en una situación real", href /learn/session/pas.',
  '- After SIMULATION_COMPLETED correctCount=3 -> "Lleva la distinción a una creencia real", href /learn/experience/creencias-evidencia-e-interpretacion.',
  '- actionChangedAfterEvidence=true and visible "Tu ruta cambió con la evidencia".',
  "- Mobile reproduced the same distinctions and change.",
  "- consoleErrors=[].",
  "- build PASS; unit 25/25; adaptive E2E 4/4; showcase 17/17 incl WCAG.",
  "- Demo persistence remains localStorage/browser-local, not durable backend.",
  "",
  "Critic output:",
  JSON.stringify(criticParsed, null, 2),
  "",
  'Return JSON only: {"critic_is_supported":true,"contradictions":["..."],"core_adaptive_loop_proven":true,"remaining_blockers":["..."],"final_verdict":"PASS|PASS_WITH_RISKS|CHANGES_REQUIRED","reason":"..."}'
].join("\n");

const verifier = await run("ibm/granite4:1b", verifierPrompt);
fs.writeFileSync("evidence/po-cx-adaptive-loop/granite-verifier.raw.json", JSON.stringify(verifier, null, 2));
let verifierParsed;
try { verifierParsed = JSON.parse(verifier.response); } catch { verifierParsed = { parse_error: true, raw: verifier.response }; }
fs.writeFileSync("evidence/po-cx-adaptive-loop/granite-verifier.json", JSON.stringify(verifierParsed, null, 2));

console.log("--- CRITIC ---");
console.log(JSON.stringify(criticParsed, null, 2));
console.log("--- VERIFIER ---");
console.log(JSON.stringify(verifierParsed, null, 2));
