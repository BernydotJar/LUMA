export type PnlRagHit = {
  chunkId: string;
  sourceId: string;
  driveFileId: string;
  module: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  startClock: string;
  endClock: string;
  text: string;
  driveUrl: string;
  srtPath: string;
  transcriptPath: string;
};

export type PnlRagSearchOutcome =
  | {
      configured: false;
      strict: false;
      results: [];
    }
  | {
      configured: true;
      strict: boolean;
      results: PnlRagHit[];
      backend?: string;
      error?: string;
    };

type RawHit = {
  chunk_id?: unknown;
  source_id?: unknown;
  drive_file_id?: unknown;
  module?: unknown;
  title?: unknown;
  start_seconds?: unknown;
  end_seconds?: unknown;
  start_clock?: unknown;
  end_clock?: unknown;
  text?: unknown;
  drive_url?: unknown;
  srt_path?: unknown;
  transcript_path?: unknown;
};

function envBool(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeHit(value: unknown): PnlRagHit | null {
  if (!value || typeof value !== "object") return null;
  const row = value as RawHit;

  if (
    !isString(row.chunk_id) ||
    !isString(row.source_id) ||
    !isString(row.drive_file_id) ||
    !isString(row.module) ||
    !isString(row.title) ||
    !isNumber(row.start_seconds) ||
    !isNumber(row.end_seconds) ||
    !isString(row.start_clock) ||
    !isString(row.end_clock) ||
    !isString(row.text) ||
    !isString(row.drive_url) ||
    !isString(row.srt_path) ||
    !isString(row.transcript_path)
  ) {
    return null;
  }

  return {
    chunkId: row.chunk_id,
    sourceId: row.source_id,
    driveFileId: row.drive_file_id,
    module: row.module,
    title: row.title,
    startSeconds: row.start_seconds,
    endSeconds: row.end_seconds,
    startClock: row.start_clock,
    endClock: row.end_clock,
    text: row.text,
    driveUrl: row.drive_url,
    srtPath: row.srt_path,
    transcriptPath: row.transcript_path,
  };
}

export async function searchPnlRag(
  query: string,
  limit = 5,
): Promise<PnlRagSearchOutcome> {
  const baseUrl = process.env.LUMA_PNL_RAG_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) {
    return { configured: false, strict: false, results: [] };
  }

  const strict = envBool(process.env.LUMA_PNL_RAG_STRICT, true);
  const token = process.env.LUMA_PNL_RAG_TOKEN?.trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);

  try {
    const response = await fetch(`${baseUrl}/v1/search`, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        query,
        limit: Math.max(1, Math.min(limit, 10)),
      }),
    });

    if (!response.ok) {
      return {
        configured: true,
        strict,
        results: [],
        error: `pnl-rag returned HTTP ${response.status}`,
      };
    }

    const payload = (await response.json()) as { results?: unknown; retrieval?: unknown };
    if (!Array.isArray(payload.results)) {
      return {
        configured: true,
        strict,
        results: [],
        error: "pnl-rag returned an invalid response",
      };
    }

    const results = payload.results
      .map(normalizeHit)
      .filter((hit): hit is PnlRagHit => hit !== null);

    return {
      configured: true,
      strict,
      results,
      backend: isString(payload.retrieval) ? payload.retrieval : undefined,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown retrieval error";
    return {
      configured: true,
      strict,
      results: [],
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function extractivePnlAnswer(hit: PnlRagHit) {
  const normalized = hit.text.replace(/\s+/g, " ").trim();
  const excerpt =
    normalized.length > 650 ? `${normalized.slice(0, 647)}…` : normalized;

  return [
    "Según el corpus audiovisual procesado, el pasaje más relevante recuperado es:",
    `“${excerpt}”`,
    `Fuente: ${hit.module} · ${hit.title} · ${hit.startClock} → ${hit.endClock}.`,
  ].join(" ");
}
