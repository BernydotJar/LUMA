import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { CommerceEnrollmentRecord } from "./enrollment";
import type { EntitlementRecord, ProviderEventRecord } from "./domain";

export function parseCommerceAccessTraceQuery(url: string) {
  const params = new URL(url).searchParams;
  const tenantId = params.get("tenantId")?.trim() ?? "";
  const entitlementId = params.get("entitlementId")?.trim() ?? "";
  if (!tenantId || tenantId.length > 128 || /[\/\u0000-\u001f]/.test(tenantId)) {
    throw new Error("INVALID_TRACE_TENANT");
  }
  if (!/^[a-f0-9]{64}$/.test(entitlementId)) {
    throw new Error("INVALID_TRACE_ENTITLEMENT");
  }
  return { tenantId, entitlementId };
}

/** Privileged read-only diagnostic. Avoid returning buyer email or raw provider payloads. */
export async function readCommerceAccessTrace(
  firestore: Firestore,
  tenantId: string,
  entitlementId: string,
) {
  const tenantHash = createHash("sha256").update(tenantId).digest("hex");
  const entitlementRef = firestore.collection("commerceTenants").doc(tenantHash)
    .collection("entitlements").doc(entitlementId);
  const enrollmentRef = firestore.collection("commerceEnrollments").doc(entitlementId);
  const [entitlementDoc, enrollmentDoc, eventDocs] = await Promise.all([
    entitlementRef.get(),
    enrollmentRef.get(),
    firestore.collection("commerceProviderEvents")
      .where("resolution.entitlementId", "==", entitlementId)
      .limit(101).get(),
  ]);
  const rawEntitlement = entitlementDoc.exists
    ? entitlementDoc.data() as EntitlementRecord : undefined;
  const rawEnrollment = enrollmentDoc.exists
    ? enrollmentDoc.data() as CommerceEnrollmentRecord : undefined;

  const entitlement = rawEntitlement?.tenantId === tenantId ? rawEntitlement : undefined;
  const enrollment = rawEnrollment?.tenantId === tenantId ? rawEnrollment : undefined;

  // A globally privileged user must supply the tenant, and a mismatched tenant
  // must never be permitted to look up another tenant's enrollment by its ID.
  if (!entitlement && !enrollment) return null;

  const learnerId = enrollment?.learnerId;
  const twinExists = learnerId
    ? (await firestore.collection("learners").doc(learnerId).get()).exists : false;
  const sortedEvents = eventDocs.docs
    .map((doc) => doc.data() as ProviderEventRecord)
    .filter((record) => record.resolution?.tenantId === tenantId)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) ||
      a.externalEventId.localeCompare(b.externalEventId));

  return {
    tenantId,
    entitlementId,
    entitlement: entitlement ? {
      status: entitlement.status,
      productId: entitlement.productId,
      purchaseKey: entitlement.purchaseKey ?? null,
      grantedAt: entitlement.grantedAt ?? null,
      revokedAt: entitlement.revokedAt ?? null,
      lastSourceEvent: entitlement.lastSourceEvent,
    } : null,
    enrollment: enrollment ? {
      enrollmentId: enrollment.enrollmentId,
      programId: enrollment.programId,
      offeringId: enrollment.offeringId ?? null,
      status: enrollment.status,
      learnerLinked: Boolean(enrollment.learnerId),
      accessEndsAt: enrollment.accessEndsAt ?? null,
    } : null,
    learningTwin: {
      initializedWithOnboarding: twinExists,
      awaitingOnboarding: Boolean(enrollment?.learnerId && !twinExists),
    },
    events: sortedEvents.slice(0, 100).map((record) => ({
      provider: record.provider,
      eventId: record.externalEventId,
      eventType: record.type,
      occurredAt: record.occurredAt,
      correlationId: record.correlationId,
      processingStatus: record.processingStatus,
      outcome: record.outcome ?? null,
      lastErrorCode: record.lastErrorCode ?? null,
    })),
    truncated: eventDocs.size > 100,
  };
}
