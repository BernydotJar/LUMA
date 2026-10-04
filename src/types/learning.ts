export type EvidenceCategory = "observed" | "inferred" | "self-reported";
export type MasteryBand = "strong" | "developing" | "needs-attention";
export type LearningActionKind =
  | "continue"
  | "review"
  | "diagnostic"
  | "practice"
  | "simulation"
  | "human-session";

export interface LearningEvidence {
  id: string;
  category: EvidenceCategory;
  statement: string;
  source: string;
  confidence: number;
}

export interface TwinDimension {
  id: string;
  label: string;
  score: number;
  band: MasteryBand;
  delta: number;
  summary: string;
  evidence: LearningEvidence[];
}

export interface LearnerConceptState {
  conceptId: string;
  label: string;
  mastery: number;
  confidence: number;
  attempts: number;
  consecutiveFailures: number;
  completedContent: boolean;
  prerequisiteIds: string[];
}

export interface LearnerState {
  learnerId: string;
  goal: string;
  availableMinutes: number;
  concepts: LearnerConceptState[];
}

export interface LearningAction {
  id: string;
  kind: LearningActionKind;
  conceptId: string;
  title: string;
  description: string;
  minutes: number;
  sourceLabel: string;
  sourceUrl: string;
  targetMastery: number;
  prerequisiteIds: string[];
}

export interface RankedLearningAction extends LearningAction {
  score: number;
  reason: string;
  confidence: number;
}

export interface JourneyStep {
  id: string;
  label: string;
  detail: string;
  status: "complete" | "current" | "upcoming";
  conceptId: string;
}

export interface StudioSignal {
  id: string;
  label: string;
  value: string;
  detail: string;
  trend: "up" | "down" | "steady";
}
