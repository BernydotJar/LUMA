import { FieldPath } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { firebaseAdminAuth, firebaseAdminFirestore } from "@/lib/firebase-admin";
import { requireLearningCoachAccess } from "@/lib/learning-server";
import { certificates } from "@/lib/certificates/server";
import { certificateError } from "@/lib/certificates/http";
import { completionId, canManageCertificates, documentId, type CompletionAttestation } from "@/lib/certificates/domain";
import { isActiveCommerceEnrollment, type CommerceEnrollmentRecord } from "@/lib/commerce/enrollment";
import type { ProgramOffering } from "@/lib/program-delivery";

export const runtime = "nodejs";
const PAGE_SIZE = 70;

export async function GET(request: Request) {
  try {
    const { decoded, access } = await requireLearningCoachAccess(request);
    const url = new URL(request.url);
    const selectedId = url.searchParams.get("offeringId");
    if (!selectedId) {
      const snapshot = access.unrestricted
        ? await firebaseAdminFirestore.collection("programOfferings").limit(100).get()
        : await firebaseAdminFirestore.collection("programOfferings")
            .where("coachIds", "array-contains", decoded.uid).limit(100).get();
      const offerings = snapshot.docs
        .map(s => s.data() as ProgramOffering)
        .filter(o => canManageCertificates(access, decoded.uid, o) &&
          ["active", "completed"].includes(o.status))
        .map(({ offeringId, tenantId, title, cohortKey }) =>
          ({ offeringId, tenantId, title, cohortKey }));
      return NextResponse.json({ offerings }, { headers: { "cache-control": "no-store" } });
    }
    const offering = await certificates.authorizedOffering(
      { uid: decoded.uid, access }, documentId(selectedId, "offering_id"));
    const rawCursor = url.searchParams.get("cursor");
    if (rawCursor && !/^[a-f0-9]{64}$/.test(rawCursor)) {
      return NextResponse.json({ error: "invalid_cursor" }, { status: 400 });
    }
    let query = firebaseAdminFirestore.collection("commerceEnrollments")
      .where("offeringId", "==", offering.offeringId)
      .orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (rawCursor) query = query.startAfter(rawCursor);
    const snapshot = await query.get();
    const rows = snapshot.docs.map(doc => doc.data() as CommerceEnrollmentRecord)
      .filter(enrollment =>
        enrollment.tenantId === offering.tenantId &&
        enrollment.programId === offering.programId &&
        isActiveCommerceEnrollment(enrollment) && Boolean(enrollment.learnerId));
    const learnerIds = [...new Set(rows.map(row => row.learnerId!))];
    if (!learnerIds.length) return NextResponse.json({ learners: [],
      nextCursor: snapshot.size === PAGE_SIZE ? snapshot.docs.at(-1)?.id : null },
      { headers: { "cache-control": "no-store" } });
    const [users, completions] = await Promise.all([
      firebaseAdminAuth.getUsers(learnerIds.map(uid => ({ uid }))),
      firebaseAdminFirestore.getAll(...learnerIds.map(learnerId =>
        firebaseAdminFirestore.collection("academicCompletions")
          .doc(completionId(offering.tenantId, offering.offeringId, learnerId)))),
    ]);
    const byUid = new Map(users.users.map(user => [user.uid, user]));
    const learners = learnerIds.map((learnerId, index) => {
      const user = byUid.get(learnerId);
      const approved = completions[index].exists
        ? completions[index].data() as CompletionAttestation : null;
      return {
        learnerId, name: user?.displayName ?? "Participante sin nombre de perfil",
        identityReady: Boolean(user?.emailVerified),
        approvedAt: approved?.approvedAt ?? null,
        certificateId: approved?.certificateId ?? null,
      };
    });
    return NextResponse.json({
      offering: { offeringId: offering.offeringId, title: offering.title, tenantId: offering.tenantId },
      learners, nextCursor: snapshot.size === PAGE_SIZE ? snapshot.docs.at(-1)?.id : null,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return certificateError(error); }
}
