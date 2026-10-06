
const prompt = [
  "Independent LUMA release verifier. Return JSON only.",
  "Ground truth:",
  "- Learner A: emotions, 8 min -> Distingue evento, pensamiento y emoción -> /learn/experience/pas-detectar-y-reformular.",
  "- Learner B: communication, 35 min -> Practica congruencia en tres canales -> /learn/experience/congruencia-tres-canales.",
  "- sameActionAB=false on desktop and mobile.",
  "- Before evidence: Detecta un P.A.S. en una situación real -> /learn/session/pas.",
  "- After SIMULATION_COMPLETED correctCount=3: Lleva la distinción a una creencia real -> /learn/experience/creencias-evidencia-e-interpretacion.",
  "- actionChangedAfterEvidence=true; visible route changed message; no console errors.",
  "- lint/typecheck/build PASS, unit 25/25, adaptive E2E 4/4, showcase 17/17 incl WCAG.",
  "- Remaining architectural limitation: persistence is browser-local localStorage, not durable multi-user backend.",
  "A critic returned PASS but scored every category 1/10 and claimed there are no risks.",
  "Judge only whether the core adaptive CX thesis is now proven and whether the critic is self-consistent.",
  'Schema: {"critic_self_consistent":true|false,"core_adaptive_loop_proven":true|false,"final_verdict":"PASS|PASS_WITH_RISKS|CHANGES_REQUIRED","remaining_risks":[{"severity":"MAJOR|MINOR","risk":"..."}],"reason":"..."}'
].join("\n");

const response = await fetch("http://127.0.0.1:11434/api/generate", {
  method: "POST",
  headers: {"content-type":"application/json"},
  body: JSON.stringify({
    model: "ibm/granite3.3:2b",
    prompt,
    stream: false,
    format: "json",
    think: false,
    options: { temperature: 0, num_predict: 500, num_ctx: 4096 }
  })
});
if (!response.ok) throw new Error(await response.text());
const raw = await response.json();
console.log(raw.response);
