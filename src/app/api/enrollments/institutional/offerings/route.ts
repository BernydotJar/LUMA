import { FieldPath } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { requireLearningAdmin } from "@/lib/learning-server";
import { authorizeInstitutionalAdmin } from "@/lib/commerce/institutional-grants";
import { institutionalGrantError } from "@/lib/commerce/institutional-grant-http";
import type { ProgramOffering } from "@/lib/program-delivery";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const admin = await requireLearningAdmin(request);
    const query = new URL(request.url).searchParams;
    const tenantId = query.get("tenantId")?.trim() ?? "";
    authorizeInstitutionalAdmin(admin as Record<string, unknown>, tenantId);
    const cursor = query.get("cursor") || undefined;
    if (cursor && !/^[A-Za-z0-9_-]{1,128}$/.test(cursor)) {
      return NextResponse.json({ error: "invalid_cursor" }, { status: 400 });
    }
    let snapshotQuery = firebaseAdminFirestore.collection("programOfferings")
      .where("tenantId", "==", tenantId)
      .orderBy(FieldPath.documentId(), "asc").limit(100);
    if (cursor) snapshotQuery = snapshotQuery.startAfter(cursor);
    const snapshot = await snapshotQuery.get();
    return NextResponse.json({
      offerings: snapshot.docs
        .map(doc => doc.data() as ProgramOffering)
        .filter(item => item.status === "active")
        .map(item => ({
          offeringId: item.offeringId,
          programId: item.programId,
          title: item.title,
          cohortKey: item.cohortKey,
        })),
      nextCursor: snapshot.size === 100 ? snapshot.docs.at(-1)?.id ?? null : null,
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return institutionalGrantError(error); }
}
