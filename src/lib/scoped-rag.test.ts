import { describe, expect, it, vi } from "vitest";
import { searchScopedPnlRag } from "./scoped-rag";

const scope = { tenantId: "tenant-a", programId: "program-a" };
const env = {
  LUMA_SCOPED_RAG_URL: "https://isolated-rag.example.test/api",
  LUMA_SCOPED_RAG_TOKEN: "test-token",
  LUMA_SCOPED_RAG_ISOLATION_ATTESTED: "true",
};
const hit = {
  chunk_id: "chunk-a", source_id: "source-a", drive_file_id: "drive-a",
  module: "Program A", title: "Clase A", start_seconds: 1, end_seconds: 9,
  start_clock: "00:00:01", end_clock: "00:00:09", text: "Content restricted to A",
  drive_url: "https://drive.example.test/a", srt_path: "/a.srt",
  transcript_path: "/a.txt", tenant_id: "tenant-a", program_id: "program-a",
};
const okBody = {
  scope: { tenant_id: "tenant-a", program_id: "program-a" },
  retrieval: "pgvector",
  results: [hit],
};
function mockFetch(responseBody: unknown = okBody) {
  return vi.fn(async () => new Response(JSON.stringify(responseBody), { status: 200 })) as unknown as typeof fetch;
}

describe("tenant/program isolated RAG", () => {
  it("fails closed and does not touch the unscoped RAG bridge without explicit attestation", async () => {
    const transport = vi.fn() as unknown as typeof fetch;
    expect(await searchScopedPnlRag("search", scope, 5, {}, transport))
      .toMatchObject({ configured: false, results: [] });
    expect(await searchScopedPnlRag("search", scope, 5, {
      ...env, LUMA_SCOPED_RAG_ISOLATION_ATTESTED: "false",
    }, transport)).toMatchObject({ configured: false, results: [] });
    expect(transport).not.toHaveBeenCalled();
  });

  it("sends only authorized scope to a dedicated authenticated gateway", async () => {
    const transport = mockFetch();
    const result = await searchScopedPnlRag("pregunta", scope, 5, env, transport);
    expect(result).toMatchObject({ configured: true, strict: true,
      backend: "scoped/pgvector", results: [{ sourceId: "source-a" }] });
    expect(transport).toHaveBeenCalledTimes(1);
    const [url, request] = (transport as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://isolated-rag.example.test/api/v1/search");
    expect(request.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(request.body).scope).toEqual({
      tenant_id: "tenant-a", program_id: "program-a",
    });
  });

  it("rejects any mixed-tenant envelope or hit rather than post-filtering leaks", async () => {
    for (const body of [
      { ...okBody, scope: { tenant_id: "tenant-b", program_id: "program-a" } },
      { ...okBody, results: [{ ...hit, tenant_id: "tenant-b" }] },
      { ...okBody, results: [{ ...hit, program_id: "program-b" }] },
      { ...okBody, results: [{ ...hit, tenant_id: undefined }] },
      { ...okBody, results: [{ ...hit, chunk_id: undefined }] },
    ]) {
      const result = await searchScopedPnlRag("search", scope, 5, env, mockFetch(body));
      expect(result).toMatchObject({ configured: true, strict: true, results: [] });
      expect("error" in result && result.error).toBeTruthy();
    }
  });

  it("rejects non-HTTPS credentials in URL and unexpected provider failures", async () => {
    const transport = vi.fn() as unknown as typeof fetch;
    const invalid = await searchScopedPnlRag("search", scope, 5, {
      ...env, LUMA_SCOPED_RAG_URL: "http://internal.example",
    }, transport);
    expect(invalid).toMatchObject({ configured: true, results: [],
      error: "SCOPED_RAG_CONFIGURATION_INVALID" });
    expect(transport).not.toHaveBeenCalled();
    const failingTransport = vi.fn(async () => { throw new Error("vendor down"); }) as unknown as typeof fetch;
    expect(await searchScopedPnlRag("search", scope, 5, env, failingTransport))
      .toMatchObject({ configured: true, results: [], error: "SCOPED_RAG_UNAVAILABLE" });
  });
});
