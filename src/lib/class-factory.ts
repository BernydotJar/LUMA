import type { ClassContract } from "./class-contract";
import { validateClassContract } from "./class-contract";
import type { KnowledgeArtifact } from "@/types/reflection";

export type SourcePack = {
  sourceId: string;
  label: string;
  version: string;
  fingerprint: string;
  concepts: string[];
  observedAt: string;
};

export type ClassArtifact = {
  artifactId: string;
  experienceSlug: string;
  sourceIds: string[];
  sourceVersions: Record<string, string>;
  topology: ClassContract["topology"];
  objective: string;
  evidenceLabel: string;
  qualityGate: "PASS" | "FAIL";
  status: "candidate" | "published";
  generatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
};

export type ClassRefreshProposal = {
  proposalId: string;
  currentArtifactId: string;
  candidate: ClassArtifact;
  changedSources: string[];
  impactedSections: string[];
  promotionRequired: true;
  status: "review-required";
};

function stableId(parts: string[]) {
  let hash = 2166136261;
  for (const char of parts.join("|")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function compileClassCandidate(
  contract: ClassContract,
  sources: SourcePack[],
  now = new Date().toISOString(),
): ClassArtifact {
  const quality = validateClassContract(contract);
  const allowedSources = sources.filter((source) => contract.sourceIds.includes(source.sourceId));
  const sourceVersions = Object.fromEntries(
    allowedSources.map((source) => [source.sourceId, source.version]),
  );

  return {
    artifactId: `class-${contract.capabilityId}-${stableId([
      contract.experienceSlug,
      ...allowedSources.map((source) => `${source.sourceId}:${source.version}:${source.fingerprint}`),
    ])}`,
    experienceSlug: contract.experienceSlug,
    sourceIds: contract.sourceIds,
    sourceVersions,
    topology: contract.topology,
    objective: contract.objective,
    evidenceLabel: contract.evidenceContract.label,
    qualityGate:
      quality.pass && allowedSources.length === contract.sourceIds.length ? "PASS" : "FAIL",
    status: "candidate",
    generatedAt: now,
  };
}

export function proposeClassRefresh(
  current: ClassArtifact,
  contract: ClassContract,
  sources: SourcePack[],
  now = new Date().toISOString(),
): ClassRefreshProposal | undefined {
  const changedSources = sources
    .filter((source) => contract.sourceIds.includes(source.sourceId))
    .filter((source) => current.sourceVersions[source.sourceId] !== source.version)
    .map((source) => source.sourceId);

  if (!changedSources.length) return undefined;

  const candidate = compileClassCandidate(contract, sources, now);
  return {
    proposalId: `refresh-${stableId([current.artifactId, candidate.artifactId])}`,
    currentArtifactId: current.artifactId,
    candidate,
    changedSources,
    impactedSections: ["ideas-clave", "práctica", "rúbrica", "remediación"],
    promotionRequired: true,
    status: "review-required",
  };
}

export function promoteClassCandidate(
  candidate: ClassArtifact,
  reviewerId: string,
  now = new Date().toISOString(),
): ClassArtifact {
  if (candidate.qualityGate !== "PASS") {
    throw new Error("CLASS_QUALITY_GATE_FAILED");
  }
  if (!reviewerId.trim()) {
    throw new Error("REVIEWER_REQUIRED");
  }

  return {
    ...candidate,
    status: "published",
    publishedAt: now,
    publishedBy: reviewerId.trim(),
  };
}


export function sourcePacksFromApprovedReflection(
  artifact: KnowledgeArtifact,
): SourcePack[] {
  if (artifact.status !== "approved") return [];

  const seen = new Set<string>();
  return artifact.sourceRefs.flatMap((ref) => {
    if (seen.has(ref.sourceId)) return [];
    seen.add(ref.sourceId);
    return [{
      sourceId: ref.sourceId,
      label: ref.sourceLabel,
      version: `${artifact.id}:${artifact.createdAt}`,
      fingerprint: `${artifact.pipelineVersion}:${artifact.promptVersion ?? "no-prompt"}:${artifact.id}`,
      concepts: artifact.tags,
      observedAt: artifact.createdAt,
    }];
  });
}

export function proposeRefreshFromApprovedReflection(
  current: ClassArtifact,
  contract: ClassContract,
  artifact: KnowledgeArtifact,
): ClassRefreshProposal | undefined {
  const sources = sourcePacksFromApprovedReflection(artifact).filter((source) =>
    contract.sourceIds.includes(source.sourceId),
  );
  if (!sources.length) return undefined;
  return proposeClassRefresh(current, contract, sources, artifact.createdAt);
}
