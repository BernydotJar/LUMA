import { validLearningScopeId, type LearningScope } from "./learning-entitlement";
import {
  normalizePnlRagHit,
  type PnlRagHit,
  type PnlRagSearchOutcome,
} from "./pnl-rag";

type ScopedHit = Record<string, unknown> & {
  tenant_id?: unknown;
  program_id?: unknown;
};
type ScopedEnvelope = {
  scope?: { tenant_id?: unknown; program_id?: unknown };
  retrieval?: unknown;
  results?: unknown;
};

/**
 * The external RAG response is untrusted. Bound it before JSON parsing so a
 * malicious or faulty provider cannot force an unbounded heap allocation.
 */
const MAX_SCOPED_RESPONSE_BYTES = 256 * 1024;

async function readBoundedScopedPayload(response: Response): Promise<ScopedEnvelope> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_SCOPED_RESPONSE_BYTES) {
    throw new Error("SCOPED_RAG_RESPONSE_TOO_LARGE");
  }
  if (!response.body) throw new Error("SCOPED_RAG_EMPTY_RESPONSE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SCOPED_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("SCOPED_RAG_RESPONSE_TOO_LARGE");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let cursor = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, cursor);
      cursor += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as ScopedEnvelope;
  } finally {
    reader.releaseLock();
  }
}

function isTrustedScopedHit(hit: PnlRagHit): boolean {
  if (hit.text.length < 1 || hit.text.length > 4096 ||
      hit.title.length < 1 || hit.title.length > 256 ||
      hit.module.length > 256 || hit.sourceId.length < 1 ||
      hit.sourceId.length > 256 || hit.chunkId.length < 1 ||
      hit.chunkId.length > 256 || hit.driveFileId.length > 256 ||
      hit.startSeconds < 0 || hit.endSeconds <= hit.startSeconds ||
      hit.endSeconds > 86_400 || hit.driveUrl.length > 2048 ||
      hit.srtPath.length > 2048 || hit.transcriptPath.length > 2048 ||
      !/^\d{2}:\d{2}:\d{2}$/.test(hit.startClock) ||
      !/^\d{2}:\d{2}:\d{2}$/.test(hit.endClock)) return false;
  try {
    const url = new URL(hit.driveUrl);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * Mandatory strict-mode retrieval boundary. The configured index must be
 * authenticated and must enforce tenant/program filtering BEFORE retrieval.
 * Never reuse the unpartitioned LUMA_PNL_RAG_URL fallback for paid programs.
 */
export async function searchScopedPnlRag(
  query: string,
  scope: LearningScope,
  limit = 5,
  env: Record<string, string | undefined> = process.env,
  transport: typeof fetch = fetch,
): Promise<PnlRagSearchOutcome> {
  if (!validLearningScopeId(scope.tenantId) ||
      !validLearningScopeId(scope.programId)) {
    return { configured: true, strict: true, results: [],
      error: "SCOPED_RAG_SCOPE_INVALID" };
  }
  const boundedLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(Math.trunc(limit), 8)) : 5;
  const endpoint = env.LUMA_SCOPED_RAG_URL?.trim() ?? "";
  const token = env.LUMA_SCOPED_RAG_TOKEN?.trim() ?? "";
  const attested = env.LUMA_SCOPED_RAG_ISOLATION_ATTESTED === "true";
  if (!endpoint || !token || !attested) {
    return { configured: false, strict: false, results: [] };
  }
  let url: URL;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password ||
        url.search || url.hash || !url.hostname) {
      throw new Error("invalid scoped RAG endpoint");
    }
  } catch {
    return { configured: true, strict: true, results: [],
      error: "SCOPED_RAG_CONFIGURATION_INVALID" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await transport(new URL(
      url.pathname.replace(/\/$/, "") + "/v1/search", url,
    ).toString(), {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query,
        limit: boundedLimit,
        scope: { tenant_id: scope.tenantId, program_id: scope.programId },
      }),
    });
    if (!response.ok) {
      return { configured: true, strict: true, results: [],
        error: `SCOPED_RAG_HTTP_${response.status}` };
    }

    const payload = await readBoundedScopedPayload(response);
    if (!payload || typeof payload !== "object" ||
        payload.scope?.tenant_id !== scope.tenantId ||
        payload.scope?.program_id !== scope.programId ||
        !Array.isArray(payload.results)) {
      return { configured: true, strict: true, results: [],
        error: "SCOPED_RAG_SCOPE_MISMATCH" };
    }

    if (payload.results.length > boundedLimit) {
      return { configured: true, strict: true, results: [],
        error: "SCOPED_RAG_TOO_MANY_HITS" };
    }
    const results: PnlRagHit[] = [];
    for (const value of payload.results) {
      const row = value as ScopedHit | null;
      if (!row || typeof row !== "object" ||
          row.tenant_id !== scope.tenantId ||
          row.program_id !== scope.programId) {
        return { configured: true, strict: true, results: [],
          error: "SCOPED_RAG_HIT_SCOPE_MISMATCH" };
      }
      const hit = normalizePnlRagHit(row);
      if (!hit || !isTrustedScopedHit(hit)) {
        return { configured: true, strict: true, results: [],
          error: "SCOPED_RAG_HIT_INVALID" };
      }
      results.push(hit);
    }
    return { configured: true, strict: true, results,
      backend: typeof payload.retrieval === "string"
        ? `scoped/${payload.retrieval}` : "scoped" };
  } catch {
    return { configured: true, strict: true, results: [],
      error: "SCOPED_RAG_UNAVAILABLE" };
  } finally {
    clearTimeout(timer);
  }
}
