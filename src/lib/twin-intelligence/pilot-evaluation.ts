/**
 * LUMA Twin Intelligence: preregistered small-pilot evaluation.
 *
 * Calculator, not an assertion that a real experiment has happened.
 * Synthetic fixtures NEVER promote a release or claim observed benefit.
 */
export type PilotArm = "twin_assisted" | "standard_support";
export type AssessmentPhase = "baseline" | "post" | "retention";
export type EvidenceTier = "synthetic" | "verified_emulator" | "verified_pilot";

export interface PilotProtocol {
  pilotId: string;
  tenantId: string;
  programId: string;
  teacherUid: string;
  rubricId: string;
  rubricVersion: string;
  criterionIds: string[];
  maxCostPerLearnerUsd: number;
  minPerArm: number;
  minPairedRate: number;
  minDifferentialGain: number;
  minFollowupRate: number;
  maxHumanResponseHours: number;
}

export interface AssessmentReceipt {
  tenantId: string;
  programId: string;
  learnerId: string;
  arm: PilotArm;
  phase: AssessmentPhase;
  rubricId: string;
  rubricVersion: string;
  criteria: Record<string, boolean>;
  sourceEventId: string;
  assessorUid: string;
  /** Independent of the intervention, using an educator-approved rubric. */
  blindScored: boolean;
  occurredAt: string;
}

export interface PilotAssignment {
  learnerId: string;
  arm: PilotArm;
  assignmentReceiptId: string;
}

export interface HumanInterventionReceipt {
  tenantId: string;
  programId: string;
  learnerId: string;
  proposedAt: string;
  respondedAt?: string;
  teacherUid?: string;
  outcome?: "completed" | "dismissed";
  followUpEventId?: string;
  reasonEvidenceId: string;
}

export interface UsageReceipt {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  billedUsd?: number;
  billingVerified: boolean;
  receiptId: string;
}

export interface IsolationReceipt {
  evidenceId: string;
  negativeTenantRead: boolean;
  negativeProgramRead: boolean;
  negativeCrossTenantWrite: boolean;
  negativeCrossProgramWrite: boolean;
  scopedRagSourceFiltering: boolean;
}

export interface PilotEvidenceBundle {
  tier: EvidenceTier;
  protocol: PilotProtocol;
  /** Cohort denominator includes learners who never complete the post-test. */
  assignments: PilotAssignment[];
  assessments: AssessmentReceipt[];
  interventions: HumanInterventionReceipt[];
  usage: UsageReceipt[];
  infrastructureCostUsd: number | null;
  teacherMinutes: number | null;
  teacherHourlyCostUsd: number | null;
  activeLearners: number;
  isolation?: IsolationReceipt;
  independentReviewerId?: string;
  independentReviewReceiptId?: string;
}

export type GateStatus = "PASS" | "FAIL" | "PENDING";
export interface PilotGate {
  id: "EDUCATIONAL_GAIN" | "HUMAN_INTERVENTION" |
    "TENANT_ISOLATION" | "EVIDENCE_INTEGRITY" | "UNIT_ECONOMICS";
  status: GateStatus;
  explanation: string;
}
export interface PilotEvaluation {
  tier: EvidenceTier;
  pairedLearners: { twinAssisted: number; standardSupport: number };
  meanGain: { twinAssisted: number | null; standardSupport: number | null };
  differentialGain: number | null;
  followupRate: number | null;
  responseWithinSlaRate: number | null;
  interventionEvidenceImprovementRate: number | null;
  costPerActiveLearnerUsd: number | null;
  costBreakdown: { inferenceUsd: number | null; infrastructureUsd: number | null;
    teacherUsd: number | null; totalUsd: number | null };
  findings: string[];
  gates: PilotGate[];
  releaseDecision: "PENDING_REAL_PILOT" | "NO_GO" | "PILOT_EXIT_CANDIDATE";
}

const round = (n: number, places = 4) => Number(n.toFixed(places));
const mean = (n: number[]): number | null =>
  n.length ? n.reduce((a, b) => a + b, 0) / n.length : null;
const within = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
const date = (value: string) => Number.isFinite(Date.parse(value));
const id = (value: string) => typeof value === "string" && value.length > 0 && value.length <= 256;

function validProtocol(p: PilotProtocol): boolean {
  return id(p.pilotId) && id(p.tenantId) && id(p.programId) &&
    id(p.teacherUid) && id(p.rubricId) && id(p.rubricVersion) &&
    Array.isArray(p.criterionIds) && p.criterionIds.length >= 2 &&
    p.criterionIds.length <= 20 && p.criterionIds.every(id) &&
    new Set(p.criterionIds).size === p.criterionIds.length &&
    Number.isFinite(p.maxCostPerLearnerUsd) && p.maxCostPerLearnerUsd > 0 &&
    Number.isInteger(p.minPerArm) && p.minPerArm >= 5 &&
    within(p.minPairedRate) && within(p.minDifferentialGain) &&
    within(p.minFollowupRate) &&
    Number.isFinite(p.maxHumanResponseHours) && p.maxHumanResponseHours > 0;
}

function score(a: AssessmentReceipt, p: PilotProtocol): number {
  if (a.tenantId !== p.tenantId || a.programId !== p.programId ||
      !id(a.learnerId) || !id(a.sourceEventId) || !id(a.assessorUid) ||
      !date(a.occurredAt) || a.rubricId !== p.rubricId ||
      a.rubricVersion !== p.rubricVersion || !a.blindScored ||
      !["twin_assisted", "standard_support"].includes(a.arm) ||
      !["baseline", "post", "retention"].includes(a.phase) ||
      !a.criteria || Object.keys(a.criteria).length !== p.criterionIds.length ||
      !p.criterionIds.every((criterion) => typeof a.criteria[criterion] === "boolean") ||
      Object.keys(a.criteria).some((criterion) => !p.criterionIds.includes(criterion))) {
    throw new Error("PILOT_ASSESSMENT_INTEGRITY_FAILED");
  }
  return p.criterionIds.filter((c) => a.criteria[c]).length / p.criterionIds.length;
}

export function evaluateTwinPilot(bundle: PilotEvidenceBundle): PilotEvaluation {
  const p = bundle.protocol;
  if (!validProtocol(p) || !["synthetic", "verified_emulator", "verified_pilot"].includes(bundle.tier) ||
      !Number.isInteger(bundle.activeLearners) || bundle.activeLearners < 0 ||
      bundle.assignments.length > 1000 || bundle.assessments.length > 1000 || bundle.interventions.length > 1000 ||
      bundle.usage.length > 500) {
    throw new Error("PILOT_PROTOCOL_INVALID");
  }
  const findings: string[] = [];
  const assigned = new Map<string, PilotArm>();
  const assignmentReceipts = new Set<string>();
  for (const item of bundle.assignments) {
    if (!id(item.learnerId) || !id(item.assignmentReceiptId) ||
        !["twin_assisted", "standard_support"].includes(item.arm) ||
        assigned.has(item.learnerId) ||
        assignmentReceipts.has(item.assignmentReceiptId)) {
      throw new Error("PILOT_ASSIGNMENT_INTEGRITY_FAILED");
    }
    assigned.set(item.learnerId, item.arm);
    assignmentReceipts.add(item.assignmentReceiptId);
  }
  const learnerArm = new Map<string, PilotArm>();
  const receipts = new Map<string, AssessmentReceipt>();
  const scores = new Map<string, number>();
  const uniqueEvents = new Set<string>();
  const armTotal = { twin_assisted: new Set<string>(), standard_support: new Set<string>() };
  for (const a of bundle.assessments) {
    const value = score(a, p);
    if (assigned.get(a.learnerId) !== a.arm) {
      throw new Error("PILOT_ASSESSMENT_UNASSIGNED_OR_ARM_CHANGED");
    }
    const key = `${a.learnerId}:${a.phase}`;
    if (receipts.has(key) || uniqueEvents.has(a.sourceEventId) ||
        (learnerArm.has(a.learnerId) && learnerArm.get(a.learnerId) !== a.arm)) {
      throw new Error("PILOT_ASSESSMENT_DUPLICATE_OR_ARM_CHANGED");
    }
    learnerArm.set(a.learnerId, a.arm);
    armTotal[a.arm].add(a.learnerId);
    receipts.set(key, a);
    scores.set(key, value);
    uniqueEvents.add(a.sourceEventId);
  }

  const gains: Record<PilotArm, number[]> = {
    twin_assisted: [], standard_support: [],
  };
  const postResults = new Map<string, number>();
  for (const [learnerId, arm] of learnerArm) {
    const pre = scores.get(`${learnerId}:baseline`);
    const post = scores.get(`${learnerId}:post`);
    if (pre === undefined || post === undefined) continue;
    const preAt = receipts.get(`${learnerId}:baseline`)!;
    const postAt = receipts.get(`${learnerId}:post`)!;
    if (Date.parse(postAt.occurredAt) <= Date.parse(preAt.occurredAt)) {
      throw new Error("PILOT_ASSESSMENT_PHASE_ORDER_INVALID");
    }
    gains[arm].push(post - pre);
    postResults.set(learnerId, post);
    const retention = receipts.get(`${learnerId}:retention`);
    if (retention && Date.parse(retention.occurredAt) <= Date.parse(postAt.occurredAt)) {
      throw new Error("PILOT_ASSESSMENT_PHASE_ORDER_INVALID");
    }
  }
  const assisted = mean(gains.twin_assisted);
  const standard = mean(gains.standard_support);
  const difference = assisted !== null && standard !== null ?
    round(assisted - standard) : null;
  const pairedCount = gains.twin_assisted.length + gains.standard_support.length;
  const participants = bundle.assignments.length;
  const pairingRate = participants > 0 ? pairedCount / participants : 0;
  if (participants !== bundle.activeLearners ||
      [...assigned].some(([learnerId, arm]) =>
        !armTotal[arm].has(learnerId))) {
    findings.push("Número de participantes y activos inconsistente o incompleto.");
  }
  if (pairedCount < participants) findings.push("Existen evaluaciones sin pareja baseline/post.");
  const sufficient = gains.twin_assisted.length >= p.minPerArm &&
    gains.standard_support.length >= p.minPerArm &&
    pairingRate >= p.minPairedRate && participants === bundle.activeLearners;
  const learningStatus: GateStatus = !sufficient ? "PENDING" :
    difference !== null && difference >= p.minDifferentialGain ? "PASS" : "FAIL";

  const interventions = bundle.interventions;
  const interventionLearners = new Set<string>();
  let onTime = 0;
  let completedFollowups = 0;
  let improvedFollowups = 0;
  for (const item of interventions) {
    if (item.tenantId !== p.tenantId || item.programId !== p.programId ||
        !id(item.learnerId) || !id(item.reasonEvidenceId) ||
        !date(item.proposedAt) || !learnerArm.has(item.learnerId) ||
        learnerArm.get(item.learnerId) !== "twin_assisted" ||
        interventionLearners.has(item.learnerId)) {
      throw new Error("PILOT_INTERVENTION_INTEGRITY_FAILED");
    }
    interventionLearners.add(item.learnerId);
    if (item.respondedAt && date(item.respondedAt) &&
        Date.parse(item.respondedAt) >= Date.parse(item.proposedAt) &&
        (Date.parse(item.respondedAt) - Date.parse(item.proposedAt)) / 3_600_000 <=
        p.maxHumanResponseHours) onTime += 1;
    if (item.outcome === "completed" && item.teacherUid === p.teacherUid &&
        item.followUpEventId) {
      const receipt = receipts.get(`${item.learnerId}:retention`);
      const after = scores.get(`${item.learnerId}:retention`);
      const before = postResults.get(item.learnerId);
      if (receipt && receipt.sourceEventId === item.followUpEventId &&
          item.respondedAt && date(item.respondedAt) &&
          Date.parse(receipt.occurredAt) > Date.parse(item.respondedAt) &&
          after !== undefined && before !== undefined) {
        completedFollowups += 1;
        if (after >= before) improvedFollowups += 1;
      }
    }
  }
  const followupRate = interventions.length ?
    completedFollowups / interventions.length : null;
  const onTimeRate = interventions.length ? onTime / interventions.length : null;
  const improvementRate = completedFollowups ?
    improvedFollowups / completedFollowups : null;
  const humanStatus: GateStatus = interventions.length === 0 ? "PENDING" :
    followupRate !== null && followupRate >= p.minFollowupRate &&
    onTimeRate !== null && onTimeRate >= p.minFollowupRate &&
    improvementRate !== null && improvementRate >= p.minFollowupRate ?
      "PASS" : "FAIL";

  const isolation = bundle.isolation;
  const isolated = Boolean(isolation?.evidenceId && isolation.negativeTenantRead &&
    isolation.negativeProgramRead && isolation.negativeCrossTenantWrite &&
    isolation.negativeCrossProgramWrite && isolation.scopedRagSourceFiltering);

  let inferenceUsd: number | null = 0;
  for (const u of bundle.usage) {
    if (!id(u.receiptId) || !id(u.provider) || !id(u.model) ||
        !Number.isInteger(u.inputTokens) || u.inputTokens < 0 ||
        !Number.isInteger(u.outputTokens) || u.outputTokens < 0 ||
        !Number.isFinite(u.inputUsdPerMillion) || u.inputUsdPerMillion < 0 ||
        !Number.isFinite(u.outputUsdPerMillion) || u.outputUsdPerMillion < 0 ||
        (u.billedUsd !== undefined && (!Number.isFinite(u.billedUsd) || u.billedUsd < 0))) {
      throw new Error("PILOT_USAGE_INVALID");
    }
    if (!u.billingVerified || u.billedUsd === undefined) inferenceUsd = null;
    else if (inferenceUsd !== null) inferenceUsd += u.billedUsd;
  }
  if (!bundle.usage.length) inferenceUsd = null;
  const infra = bundle.infrastructureCostUsd;
  const teacherUsd = bundle.teacherMinutes !== null &&
    bundle.teacherHourlyCostUsd !== null &&
    Number.isFinite(bundle.teacherMinutes) && bundle.teacherMinutes >= 0 &&
    Number.isFinite(bundle.teacherHourlyCostUsd) && bundle.teacherHourlyCostUsd >= 0 ?
    bundle.teacherMinutes * bundle.teacherHourlyCostUsd / 60 : null;
  if (infra !== null && (!Number.isFinite(infra) || infra < 0)) {
    throw new Error("PILOT_COST_INVALID");
  }
  const total = inferenceUsd !== null && infra !== null && teacherUsd !== null ?
    inferenceUsd + infra + teacherUsd : null;
  const perLearner = total !== null && bundle.activeLearners > 0 ?
    round(total / bundle.activeLearners, 2) : null;
  const costStatus: GateStatus = perLearner === null ? "PENDING" :
    perLearner <= p.maxCostPerLearnerUsd ? "PASS" : "FAIL";

  const reviewerPresent = Boolean(id(bundle.independentReviewerId ?? "") &&
    id(bundle.independentReviewReceiptId ?? "") &&
    bundle.independentReviewerId !== p.teacherUid);
  const integrityComplete = sufficient && reviewerPresent;
  const gates: PilotGate[] = [
    { id: "EDUCATIONAL_GAIN", status: learningStatus,
      explanation: "Ganancia diferencial descriptiva en pares baseline/post con rúbrica común; no prueba causal." },
    { id: "HUMAN_INTERVENTION", status: humanStatus,
      explanation: "Respuesta docente, seguimiento con recibo y mantenimiento/mejora de evidencia; no causalidad." },
    { id: "TENANT_ISOLATION", status: isolated ? "PASS" : "PENDING",
      explanation: "Requiere pruebas negativas de lectura, escritura, programa y RAG entre instituciones." },
    { id: "EVIDENCE_INTEGRITY", status: integrityComplete ? "PASS" : "PENDING",
      explanation: "Rúbrica coincidente, recibos no duplicados, orden temporal y verificador independiente." },
    { id: "UNIT_ECONOMICS", status: costStatus,
      explanation: "Coste facturado, infraestructura y minutos humanos por alumno activo." },
  ];
  // A synthetic/emulator run can verify mechanics, never educational impact
  // or authorization for a real learner deployment.
  if (bundle.tier !== "verified_pilot") {
    for (const gate of gates) gate.status = "PENDING";
    findings.push("Sin evidencias reales verificadas: la simulación no autoriza GO.");
  }
  const releaseDecision: PilotEvaluation["releaseDecision"] =
    bundle.tier !== "verified_pilot" ? "PENDING_REAL_PILOT" :
    gates.some((g) => g.status === "FAIL") ? "NO_GO" :
    gates.every((g) => g.status === "PASS") ?
      "PILOT_EXIT_CANDIDATE" : "PENDING_REAL_PILOT";
  if (releaseDecision === "PILOT_EXIT_CANDIDATE") {
    findings.push("Candidato a cierre de piloto; NO constituye autorización de producción.");
  }
  return {
    tier: bundle.tier,
    pairedLearners: { twinAssisted: gains.twin_assisted.length,
      standardSupport: gains.standard_support.length },
    meanGain: { twinAssisted: assisted === null ? null : round(assisted),
      standardSupport: standard === null ? null : round(standard) },
    differentialGain: difference,
    followupRate: followupRate === null ? null : round(followupRate),
    responseWithinSlaRate: onTimeRate === null ? null : round(onTimeRate),
    interventionEvidenceImprovementRate: improvementRate === null ? null : round(improvementRate),
    costPerActiveLearnerUsd: perLearner,
    costBreakdown: { inferenceUsd: inferenceUsd === null ? null : round(inferenceUsd, 2),
      infrastructureUsd: infra, teacherUsd: teacherUsd === null ? null : round(teacherUsd, 2),
      totalUsd: total === null ? null : round(total, 2) },
    findings, gates, releaseDecision,
  };
}
