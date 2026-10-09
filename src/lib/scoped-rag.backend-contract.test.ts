import { describe, expect, it, vi } from "vitest";
import fixture from "../../services/scoped-rag/contracts/search-response.example.json";
import { searchScopedPnlRag } from "./scoped-rag";

const scope = { tenantId: "tenant-synthetic", programId: "program-synthetic" };
const environment = {
  LUMA_SCOPED_RAG_URL: "https://rag.example.test",
  LUMA_SCOPED_RAG_TOKEN: "lrag_synthetic-test-token",
  LUMA_SCOPED_RAG_ISOLATION_ATTESTED: "true",
};

/** Contract fixture is synthetic; no client course data or real media is included. */
describe("Scoped RAG backend to LUMA frontend contract", () => {
  it("round-trips scope, exact pgvector results, timestamps and source URL", async () => {
    const transport = vi.fn(async () => new Response(JSON.stringify(fixture), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
    const result = await searchScopedPnlRag("feedback practice", scope, 5, environment, transport);
    expect(result).toMatchObject({
      configured: true,
      strict: true,
      backend: "scoped/scoped_pgvector_exact",
      results: [{
        sourceId: "video-synthetic-001",
        chunkId: "segment-001",
        startClock: "00:00:15",
        endClock: "00:00:30",
        driveUrl: "https://example.org/synthetic-classroom-001",
      }],
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("rejects the same backend payload for another verified program", async () => {
    const transport = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })) as unknown as typeof fetch;
    const result = await searchScopedPnlRag(
      "feedback practice", { ...scope, programId: "program-other" }, 5, environment, transport,
    );
    expect(result).toMatchObject({
      configured: true,
      strict: true,
      error: "SCOPED_RAG_SCOPE_MISMATCH",
      results: [],
    });
  });
});
