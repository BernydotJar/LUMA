import { NextResponse } from "next/server";
import { certificateError } from "@/lib/certificates/http";
import { requireLearningCoachAccess } from "@/lib/learning-server";
import { certificates } from "@/lib/certificates/server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { decoded, access } = await requireLearningCoachAccess(request);
    const body = await request.json();
    const completion = await certificates.approveCompletion(
      { uid: decoded.uid, access }, body,
    );
    return NextResponse.json({ completion }, {
      status: 200, headers: { "cache-control": "no-store" },
    });
  } catch (error) { return certificateError(error); }
}
