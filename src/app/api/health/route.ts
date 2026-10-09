import { NextResponse } from "next/server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();

  try {
    await firebaseAdminFirestore
      .collection("_lumaHealth")
      .limit(1)
      .get();

    return NextResponse.json(
      {
        status: "ok",
        checks: {
          api: "ok",
          firestore: "ok",
        },
        optionalCapabilities: {
          contentIntelligence: Boolean(
            process.env.LUMA_PNL_RAG_URL?.trim(),
          ),
          voice: Boolean(
            process.env.SE_VOICE_API_URL?.trim(),
          ),
          hotmart: Boolean(
            process.env.HOTMART_HOTTOK?.trim(),
          ),
          stripe: Boolean(
            process.env.STRIPE_WEBHOOK_SECRET?.trim(),
          ),
        },
        revision:
          process.env.K_REVISION ??
          process.env.GIT_COMMIT ??
          "unknown",
        latencyMs: Date.now() - startedAt,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        checks: {
          api: "ok",
          firestore: "unavailable",
        },
        latencyMs: Date.now() - startedAt,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
