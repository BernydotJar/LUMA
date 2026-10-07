export type SimulationCriterionResult = {
  id: string;
  label: string;
  passed: boolean;
  attempts: number;
};

export type SimulationEvidenceReceipt = {
  rubricId: string;
  evidenceCategory: "scored";
  twinAuthority: "eligible";
  criteria: SimulationCriterionResult[];
  passedCriteria: number;
  totalCriteria: number;
  passed: boolean;
};

const pasRubric = [
  {
    id: "event-vs-interpretation",
    answerKey: "thought",
    expected: "pas",
    label: "Distingue acontecimiento de interpretación.",
  },
  {
    id: "thought-emotion-link",
    answerKey: "emotion",
    expected: "shame",
    label: "Relaciona pensamiento automático con la emoción.",
  },
  {
    id: "evidence-preserving-reframe",
    answerKey: "reframe",
    expected: "balanced",
    label: "Formula una alternativa que conserva la evidencia disponible.",
  },
] as const;

export function evaluatePasSimulation(
  answers: Record<string, string | undefined>,
  attempts: Record<string, number | undefined>,
): SimulationEvidenceReceipt {
  const criteria = pasRubric.map((criterion) => ({
    id: criterion.id,
    label: criterion.label,
    passed: answers[criterion.answerKey] === criterion.expected,
    attempts: Math.max(0, Math.min(25, Number(attempts[criterion.answerKey] ?? 0))),
  }));
  const passedCriteria = criteria.filter((criterion) => criterion.passed).length;

  return {
    rubricId: "pas-v1",
    evidenceCategory: "scored",
    twinAuthority: "eligible",
    criteria,
    passedCriteria,
    totalCriteria: criteria.length,
    passed: passedCriteria === criteria.length,
  };
}

export function evidenceMayUpdateTwin(
  event: {
    type?: string;
    evidenceCategory?: string;
    twinAuthority?: string;
  },
): boolean {
  if (event.type !== "SIMULATION_COMPLETED") return false;

  // Legacy simulation receipts predate explicit evidence authority. They remain
  // eligible so existing learners do not lose previously supported progress.
  if (!event.evidenceCategory && !event.twinAuthority) return true;

  return event.evidenceCategory === "scored" && event.twinAuthority === "eligible";
}
