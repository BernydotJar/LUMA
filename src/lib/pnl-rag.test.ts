import { afterEach, describe, expect, it, vi } from "vitest";
import { extractivePnlAnswer, searchPnlRag } from "./pnl-rag";

afterEach(() => {
  delete process.env.LUMA_PNL_RAG_URL;
  delete process.env.LUMA_PNL_RAG_TOKEN;
  delete process.env.LUMA_PNL_RAG_STRICT;
  vi.unstubAllGlobals();
});

describe("PNL RAG adapter", () => {
  it("is disabled when no bridge URL is configured", async () => {
    await expect(searchPnlRag("rapport")).resolves.toEqual({
      configured: false,
      strict: false,
      results: [],
    });
  });

  it("normalizes citable bridge results and sends bearer auth", async () => {
    process.env.LUMA_PNL_RAG_URL = "https://rag.example.test/";
    process.env.LUMA_PNL_RAG_TOKEN = "secret";

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer secret",
      });
      return new Response(
        JSON.stringify({
          retrieval: "postgres-fts-pgvector",
          results: [
            {
              chunk_id: "chunk-1",
              source_id: "gdrive_abc",
              drive_file_id: "abc",
              module: "Modulo 2",
              title: "clase.mp4",
              start_seconds: 293,
              end_seconds: 385,
              start_clock: "00:04:53",
              end_clock: "00:06:25",
              text: "Contenido recuperado del corpus.",
              drive_url: "https://drive.google.com/file/d/abc/view",
              srt_path: "/outputs/clase.srt",
              transcript_path: "/outputs/clase.txt",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchPnlRag("cordon umbilical");
    expect(result.configured).toBe(true);
    if (!result.configured) throw new Error("expected configured result");
    expect(result.strict).toBe(true);
    expect(result.backend).toBe("postgres-fts-pgvector");
    expect(result.results[0]).toMatchObject({
      sourceId: "gdrive_abc",
      startClock: "00:04:53",
      chunkId: "chunk-1",
    });
  });

  it("builds an extractive answer without adding outside claims", () => {
    const answer = extractivePnlAnswer({
      chunkId: "chunk-1",
      sourceId: "gdrive_abc",
      driveFileId: "abc",
      module: "Modulo 2",
      title: "clase.mp4",
      startSeconds: 293,
      endSeconds: 385,
      startClock: "00:04:53",
      endClock: "00:06:25",
      text: "La evidencia recuperada.",
      driveUrl: "https://drive.google.com/file/d/abc/view",
      srtPath: "/outputs/clase.srt",
      transcriptPath: "/outputs/clase.txt",
    });

    expect(answer).toContain("La evidencia recuperada.");
    expect(answer).toContain("00:04:53 → 00:06:25");
  });
});
