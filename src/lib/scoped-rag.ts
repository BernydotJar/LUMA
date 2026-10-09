import type { LearningScope } from "./learning-entitlement";
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
        limit: Math.max(1, Math.min(limit, 8)),
        scope: { tenant_id: scope.tenantId, program_id: scope.programId },
      }),
    });
    if (!response.ok) {
      return { configured: true, strict: true, results: [],
        error: `SCOPED_RAG_HTTP_${response.status}` };
    }

    const payload = (await response.json()) as ScopedEnvelope;
    if (!payload || typeof payload !== "object" ||
        payload.scope?.tenant_id !== scope.tenantId ||
        payload.scope?.program_id !== scope.programId ||
        !Array.isArray(payload.results)) {
      return { configured: true, strict: true, results: [],
        error: "SCOPED_RAG_SCOPE_MISMATCH" };
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
      if (!hit) {
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
