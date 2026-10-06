import { describe, expect, it } from "vitest";
import { getClassContract } from "./class-contract";
import {
  compileClassCandidate,
  promoteClassCandidate,
  proposeClassRefresh,
  proposeRefreshFromApprovedReflection,
  type SourcePack,
} from "./class-factory";

const contract = getClassContract("pas-detectar-y-reformular")!;
const source = (version: string): SourcePack => ({
  sourceId: contract.sourceIds[0],
  label: "Practitioner · Redescubriendo y transformando tu poder",
  version,
  fingerprint: `sha-${version}`,
  concepts: ["P.A.S.", "reformulación"],
  observedAt: "2026-10-05T00:00:00.000Z",
});

describe("class factory", () => {
  it("compiles a source-bounded class candidate behind a quality gate", () => {
    const artifact = compileClassCandidate(contract, [source("v1")], "2026-10-05T01:00:00.000Z");
    expect(artifact.qualityGate).toBe("PASS");
    expect(artifact.status).toBe("candidate");
    expect(artifact.sourceVersions[contract.sourceIds[0]]).toBe("v1");
  });

  it("creates a review-required refresh instead of mutating a published class", () => {
    const current = promoteClassCandidate(
      compileClassCandidate(contract, [source("v1")], "2026-10-05T01:00:00.000Z"),
      "coach-1",
      "2026-10-05T02:00:00.000Z",
    );
    const proposal = proposeClassRefresh(
      current,
      contract,
      [source("v2")],
      "2026-10-05T03:00:00.000Z",
    );

    expect(current.sourceVersions[contract.sourceIds[0]]).toBe("v1");
    expect(proposal).toMatchObject({
      promotionRequired: true,
      status: "review-required",
      changedSources: [contract.sourceIds[0]],
    });
    expect(proposal?.candidate.status).toBe("candidate");
  });

  it("requires a named human reviewer to publish", () => {
    const candidate = compileClassCandidate(contract, [source("v1")]);
    expect(() => promoteClassCandidate(candidate, "")).toThrow("REVIEWER_REQUIRED");
  });

  it("turns an approved reflection into a review-required class delta", () => {
    const current = promoteClassCandidate(
      compileClassCandidate(contract, [source("v1")]),
      "coach-1",
    );
    const proposal = proposeRefreshFromApprovedReflection(current, contract, {
      id: "reflection-pas-002",
      corpusId: "practitioner-module-3",
      kind: "reflection",
      title: "Nueva conexión de transferencia",
      body: "La nueva reflexión agrega una oportunidad de transferencia.",
      sourceArtifactIds: [contract.sourceIds[0]],
      sourceRefs: [{
        sourceId: contract.sourceIds[0],
        sourceLabel: "Practitioner · Redescubriendo y transformando tu poder",
        url: "https://example.invalid/source",
        locator: "P.A.S.",
        statement: "Reflexión derivada de una fuente autorizada.",
        rightsStatus: "approved",
      }],
      status: "approved",
      confidence: 0.86,
      highStakes: false,
      learnerVisible: false,
      tags: ["pas", "transferencia"],
      pipelineVersion: "curriculum-reflection-v1",
      promptVersion: "reflection-v2",
      createdAt: "2026-10-06T03:00:00.000Z",
    });

    expect(proposal?.promotionRequired).toBe(true);
    expect(proposal?.candidate.status).toBe("candidate");
    expect(current.status).toBe("published");
  });

});
