import { NextResponse } from "next/server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { TeachingTwinStore } from "@/lib/twin-intelligence/teaching-store";
import { validTeachingTwinMethod } from "@/lib/twin-intelligence/contracts";
import { pilotTeacherContext, pilotError, readPilotJson } from "@/lib/twin-intelligence/server";

export const runtime = "nodejs";
const store = new TeachingTwinStore(firebaseAdminFirestore);

export async function GET(request: Request) {
  try {
    const { scope } = await pilotTeacherContext(request);
    const [draft, approved] = await Promise.all([
      store.readDraft(scope), store.readApproved(scope),
    ]);
    return NextResponse.json({ draft: draft ?? null, approved: approved ?? null });
  } catch (error) { return pilotError(error); }
}

export async function PUT(request: Request) {
  try {
    const { scope, teacherUid } = await pilotTeacherContext(request);
    const value = await readPilotJson(request) as {
      method?: unknown; expectedRevision?: unknown;
    };
    if (!value || !validTeachingTwinMethod(value.method) ||
        !Number.isInteger(value.expectedRevision) ||
        Number(value.expectedRevision) < 0) {
      return NextResponse.json({ error: "invalid_method_or_revision" }, { status: 400 });
    }
    const draft = await store.saveDraft(scope, teacherUid, value.method, Number(value.expectedRevision));
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) { return pilotError(error); }
}

export async function POST(request: Request) {
  try {
    const { scope, teacherUid } = await pilotTeacherContext(request);
    const value = await readPilotJson(request) as {
      action?: unknown; expectedRevision?: unknown;
    };
    if (!value || value.action !== "approve" ||
        !Number.isInteger(value.expectedRevision) ||
        Number(value.expectedRevision) < 1) {
      return NextResponse.json({ error: "invalid_approval" }, { status: 400 });
    }
    const approved = await store.approve(scope, teacherUid, Number(value.expectedRevision));
    return NextResponse.json({ approved });
  } catch (error) { return pilotError(error); }
}
