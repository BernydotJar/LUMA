import { describe, expect, it } from "vitest";
import {
  canSurfaceArtifact,
  consolidateApprovedReflections,
  createReflectionDraft,
  rankKnowledgeArtifacts,
  validateArtifactLineage,
} from "./reflection-engine";
import {
  knowledgeArtifacts,
  knownReflectionSourceIds,
  reflectionSources,
} from "./reflection-data";

describe("curriculum reflection policy", () => {
  it("prioritizes raw source for factual retrieval", () => {
    const ranked = rankKnowledgeArtifacts(
      "características pensamientos automáticos saboteadores",
      "factual",
      knowledgeArtifacts,
    );

    expect(ranked[0].kind).toBe("raw-source");
    expect(ranked[0].id).toBe("raw-pas");
  });

  it("can use an approved reflection for conceptual retrieval", () => {
    const ranked = rankKnowledgeArtifacts(
      "cómo se conecta pensamiento emoción y transferencia",
      "conceptual",
      knowledgeArtifacts,
    );

    expect(ranked[0].kind).toMatch(/reflection|summary/);
    expect(ranked[0].sourceRefs.length).toBeGreaterThan(1);
  });

  it("never surfaces drafts, blocked claims, or high-stakes artifacts to a learner", () => {
    const reviewFinding = knowledgeArtifacts.find(
      (artifact) => artifact.id === "finding-health-claims",
    );
    const draft = knowledgeArtifacts.find(
      (artifact) => artifact.id === "reflection-intervention-map",
    );

    expect(reviewFinding && canSurfaceArtifact(reviewFinding, "conceptual")).toBe(false);
    expect(draft && canSurfaceArtifact(draft, "conceptual")).toBe(false);
    expect(reviewFinding && canSurfaceArtifact(reviewFinding, "curriculum-review")).toBe(true);
  });

  it("requires explicit lineage for every derived artifact", () => {
    const draft = createReflectionDraft({
      id: "reflection-test",
      title: "Test",
      body: "Test body",
      novelty: "New relationship",
      connection: "Connects sources",
      gap: "Missing assessment",
      sources: [reflectionSources.pas],
      createdAt: "2026-10-04T06:00:00.000Z",
    });

    expect(validateArtifactLineage(draft, knownReflectionSourceIds)).toEqual([]);
    expect(
      validateArtifactLineage(
        { ...draft, sourceRefs: [{ ...reflectionSources.pas, sourceId: "unknown" }] },
        knownReflectionSourceIds,
      ),
    ).toContain("Unknown source reference: unknown.");
  });

  it("consolidates only approved reflections and preserves source lineage", () => {
    const approved = knowledgeArtifacts.filter(
      (artifact) => artifact.kind === "reflection" && artifact.status === "approved",
    );
    const inReview = knowledgeArtifacts.find(
      (artifact) => artifact.id === "reflection-intervention-map",
    );
    const secondApproved = inReview
      ? { ...inReview, status: "approved" as const }
      : undefined;
    const consolidated = consolidateApprovedReflections(
      "summary-test",
      secondApproved ? [...approved, secondApproved] : approved,
      "2026-10-04T06:00:00.000Z",
    );

    expect(consolidated?.kind).toBe("summary");
    expect(consolidated?.sourceRefs.length).toBeGreaterThanOrEqual(3);
    expect(consolidated?.status).toBe("approved");
  });

  it("keeps reflections outside learner-state authority", () => {
    const reflection = knowledgeArtifacts.find(
      (artifact) => artifact.id === "reflection-pas-loop",
    );

    expect(reflection?.kind).toBe("reflection");
    expect(reflection).not.toHaveProperty("mastery");
    expect(reflection).not.toHaveProperty("proposedLearningEvents");
  });
});
