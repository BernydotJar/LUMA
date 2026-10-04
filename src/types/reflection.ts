export type KnowledgeArtifactKind =
  | "raw-source"
  | "reflection"
  | "summary"
  | "quality-finding";

export type ReflectionReviewStatus =
  | "draft"
  | "in-review"
  | "approved"
  | "blocked";

export type RetrievalIntent =
  | "factual"
  | "conceptual"
  | "curriculum-review";

export interface ReflectionSourceRef {
  sourceId: string;
  sourceLabel: string;
  url: string;
  locator: string;
  statement: string;
  rightsStatus: "approved" | "review-required";
}

export interface KnowledgeArtifact {
  id: string;
  corpusId: string;
  kind: KnowledgeArtifactKind;
  title: string;
  body: string;
  novelty?: string;
  connection?: string;
  gap?: string;
  sourceArtifactIds: string[];
  sourceRefs: ReflectionSourceRef[];
  status: ReflectionReviewStatus;
  confidence: number;
  highStakes: boolean;
  learnerVisible: boolean;
  tags: string[];
  pipelineVersion: string;
  promptVersion?: string;
  createdAt: string;
}

export interface RankedKnowledgeArtifact extends KnowledgeArtifact {
  rankScore: number;
  rankReason: string;
}

export interface ReflectionExecutionReceipt {
  receiptId: string;
  artifactId: string;
  sourceIds: string[];
  executionMode: "deterministic-showcase-adapter" | "provider-backed";
  pipelineVersion: string;
  createdAt: string;
  stateAuthority: "none";
}
