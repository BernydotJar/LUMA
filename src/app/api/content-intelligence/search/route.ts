import { NextResponse } from "next/server";
import { requireLearningUser } from "@/lib/learning-server";
import { requireLearningEntitlement } from "@/lib/learning-entitlement-server";
import { learningAccessFailure } from "@/lib/learning-entitlement";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { searchPnlRag } from "@/lib/pnl-rag";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireLearningUser(request);
    await requireLearningEntitlement(user);
    const body = (await request.json()) as Record<string, unknown>;
    const query =
      typeof body.query === "string" ? body.query.trim() : "";
    const limit =
      typeof body.limit === "number" ? Math.round(body.limit) : 5;

    if (query.length < 2 || query.length > 500) {
      return NextResponse.json(
        { error: "invalid_content_query" },
        { status: 400 },
      );
    }

    const result = await searchPnlRag(
      query,
      Math.max(1, Math.min(limit, 8)),
    );

    if (!result.configured) {
      return NextResponse.json(
        { error: "content_intelligence_not_configured" },
        { status: 503 },
      );
    }

    if (result.error && result.strict) {
      return NextResponse.json(
        { error: "content_intelligence_unavailable" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      query,
      retrieval: result.backend ?? "semantic",
      results: result.results.map((hit) => ({
        chunkId: hit.chunkId,
        sourceId: hit.sourceId,
        module: hit.module,
        title: hit.title,
        startSeconds: hit.startSeconds,
        endSeconds: hit.endSeconds,
        startClock: hit.startClock,
        endClock: hit.endClock,
        text: hit.text,
        citation: `${hit.module} · ${hit.title} · ${hit.startClock} → ${hit.endClock}`,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "UNKNOWN";
    if (message === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
      return NextResponse.json(
        { error: "authentication_required" },
        { status: 401 },
      );
    }
    const failure = learningAccessFailure(error);
    if (failure) return NextResponse.json({ error: failure.error }, { status: failure.status });
    return NextResponse.json(
      { error: "content_intelligence_unavailable" },
      { status: 500 },
    );
  }
}
