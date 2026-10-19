import { createHash, randomBytes, randomUUID } from "node:crypto";
import { FieldPath, type Firestore } from "firebase-admin/firestore";
import type { AcademyApplicationRecord } from "./application";
import {
  compareInvitationDigest, retentionDate, secureInvitationDigest,
  type OperatorDecision,
} from "./approval-policy";
import { parseDraftTenantId } from "./draft-input";

const ID = /^[a-f0-9]{64}$/;
const UID = /^[A-Za-z0-9_-]{1,128}$/;
const INVITE_DURATION_MS = 72 * 3600_000;
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export type InvitationState = "pending" | "accepted" | "revoked";
export interface StoredInvitation {
  readonly applicationId: string;
  readonly applicantUid: string;
  readonly applicantEmail: string;
  readonly tenantId: string;
  readonly tokenDigest: string;
  readonly status: InvitationState;
  readonly issuedBy: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly acceptedAt?: string;
}
export interface ReviewResult {
  readonly application: AcademyApplicationRecord;
  /** Returned exactly once to the authorized issuing operator; never persisted. */
  readonly oneTimeToken?: string;
  readonly expiresAt?: string;
  readonly auditId: string;
}
export class FirestoreAcademyApprovalStore {
  constructor(private readonly db: Firestore) {}

  private applicationRef(applicationId: string) {
    if (!ID.test(applicationId)) throw new Error("REVIEW_ID_INVALID");
    return this.db.collection("institutionApplications").doc(applicationId);
  }
  private invitationRef(applicationId: string) {
    return this.db.collection("institutionOnboardingInvitations").doc(applicationId);
  }
  private reserveRef(tenantId: string) {
    return this.db.collection("institutionOnboardingTenants").doc(parseDraftTenantId(tenantId));
  }
  async list(limit: number, cursor?: string) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 40 ||
        (cursor !== undefined && !ID.test(cursor))) throw new Error("REVIEW_PAGE_INVALID");
    let query = this.db.collection("institutionApplications")
      .orderBy(FieldPath.documentId(), "asc").limit(limit + 1);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    const rows = snapshot.docs.slice(0, limit).map(s => this.checkedApplication(s.data(), s.id));
    return { applications: rows, nextCursor: snapshot.size > limit ? snapshot.docs[limit - 1].id : null };
  }
  private checkedApplication(value: unknown, id: string): AcademyApplicationRecord {
    const o = value as AcademyApplicationRecord | undefined;
    if (!o || o.applicationId !== id || !UID.test(o.applicantUid) ||
        !["received", "in_review", "invitation_pending", "invitation_accepted", "activated", "rejected"].includes(o.status)) {
      throw new Error("REVIEW_RECORD_INVALID");
    }
    return o;
  }
  async getForOperator(applicationId: string): Promise<AcademyApplicationRecord | null> {
    const ref = this.applicationRef(applicationId);
    const doc = await ref.get();
    return doc.exists ? this.checkedApplication(doc.data(), ref.id) : null;
  }

  async review(applicationId: string, actorUid: string, decision: OperatorDecision,
    now = new Date().toISOString()): Promise<ReviewResult> {
    if (!UID.test(actorUid)) throw new Error("REVIEW_ACTOR_INVALID");
    const appRef = this.applicationRef(applicationId);
    const inviteRef = this.invitationRef(applicationId);
    const auditRef = this.db.collection("institutionApplicationAudits").doc(randomUUID());
    const rawToken = decision.action === "invite" || decision.action === "reissue" ? randomBytes(32).toString("base64url") : undefined;
    return this.db.runTransaction(async tx => {
      const appDoc = await tx.get(appRef);
      if (!appDoc.exists) throw new Error("REVIEW_NOT_FOUND");
      const original = this.checkedApplication(appDoc.data(), appDoc.id);
      if (original.status !== decision.expectedStatus) throw new Error("REVIEW_STATE_CONFLICT");
      if (original.applicantUid === actorUid) throw new Error("REVIEW_SELF_ACTION_FORBIDDEN");
      if ((decision.action === "invite" || decision.action === "reissue") &&
          (!original.firstReviewerUid || original.firstReviewerUid === actorUid)) {
        throw new Error("REVIEW_TWO_PERSON_REQUIRED");
      }
      let reservation;
      let existingInvite;
      if (decision.action === "screen") {
        const target = decision.tenantId;
        reservation = this.reserveRef(target);
        const key = sha256(target);
        const [r, d, p] = await Promise.all([
          tx.get(reservation),
          tx.get(this.db.collection("institutionConfigDrafts").doc(key)),
          tx.get(this.db.collection("institutionConfigs").doc(key)),
        ]);
        if (r.exists || d.exists || p.exists) throw new Error("REVIEW_TENANT_TAKEN");
      } else if (decision.action === "invite" || decision.action === "reissue" || decision.action === "revoke_invitation" ||
                 (decision.action === "reject" && original.status !== "received")) {
        existingInvite = await tx.get(inviteRef);
      }
      if (decision.action === "invite" || decision.action === "reissue") {
        if (!original.tenantId) throw new Error("REVIEW_RESERVATION_INVALID");
        const reservation = await tx.get(this.reserveRef(original.tenantId));
        if (!reservation.exists || reservation.data()?.applicationId !== applicationId) {
          throw new Error("REVIEW_RESERVATION_INVALID");
        }
      }
      let next: AcademyApplicationRecord;
      let expiresAt: string | undefined;
      if (decision.action === "screen") {
        next = { ...original, status: "in_review", tenantId: decision.tenantId,
          initialProgramId: decision.initialProgramId,
          firstReviewerUid: actorUid, firstReviewedAt: now, updatedAt: now,
          retentionExpiresAt: retentionDate("in_review", now) };
        tx.create(reservation!, { applicationId, tenantId: decision.tenantId, reservedBy: actorUid, reservedAt: now });
      } else if (decision.action === "invite") {
        if (!original.tenantId || !original.initialProgramId || existingInvite?.exists) {
          throw new Error("REVIEW_INVITATION_CONFLICT");
        }
        expiresAt = new Date(Date.parse(now) + INVITE_DURATION_MS).toISOString();
        next = { ...original, status: "invitation_pending", secondReviewerUid: actorUid,
          invitationIssuedAt: now, updatedAt: now,
          retentionExpiresAt: retentionDate("invitation_pending", now) };
        const invitation: StoredInvitation = {
          applicationId, applicantUid: original.applicantUid, applicantEmail: original.applicantEmail,
          tenantId: original.tenantId, tokenDigest: secureInvitationDigest(rawToken!),
          status: "pending", issuedBy: actorUid, issuedAt: now, expiresAt,
        };
        tx.create(inviteRef, invitation);
      } else if (decision.action === "reissue") {
        if (!original.tenantId || !existingInvite?.exists || existingInvite.data()?.status !== "pending") {
          throw new Error("REVIEW_INVITATION_CONFLICT");
        }
        expiresAt = new Date(Date.parse(now) + INVITE_DURATION_MS).toISOString();
        next = { ...original, invitationIssuedAt: now, secondReviewerUid: actorUid,
          updatedAt: now, retentionExpiresAt: retentionDate("invitation_pending", now) };
        // The former proof is invalidated atomically, even if it has not expired.
        tx.update(inviteRef, { tokenDigest: secureInvitationDigest(rawToken!),
          issuedAt: now, expiresAt, issuedBy: actorUid });
      } else if (decision.action === "reject") {
        next = { ...original, status: "rejected", updatedAt: now,
          retentionExpiresAt: retentionDate("rejected", now) };
        if (original.tenantId) {
          const r = this.reserveRef(original.tenantId);
          const existing = await tx.get(r);
          if (!existing.exists || existing.data()?.applicationId !== applicationId) throw new Error("REVIEW_RESERVATION_INVALID");
          tx.delete(r);
        }
        if (existingInvite?.exists) tx.update(inviteRef, { status: "revoked" });
      } else {
        if (!existingInvite?.exists || existingInvite.data()?.status === "revoked") {
          throw new Error("REVIEW_INVITATION_CONFLICT");
        }
        const ref = original.tenantId ? this.reserveRef(original.tenantId) : null;
        // Firestore requires every transaction read to occur before any write.
        const current = ref ? await tx.get(ref) : null;
        if (ref && (!current?.exists || current.data()?.applicationId !== applicationId)) {
          throw new Error("REVIEW_RESERVATION_INVALID");
        }
        next = { ...original, status: "rejected", updatedAt: now,
          retentionExpiresAt: retentionDate("rejected", now) };
        tx.update(inviteRef, { status: "revoked" });
        if (ref) tx.delete(ref);
      }
      tx.update(appRef, next);
      tx.create(auditRef, { applicationId, actorUid, action: decision.action,
        reason: decision.reason, previousStatus: original.status, nextStatus: next.status,
        tenantId: next.tenantId ?? null, occurredAt: now });
      return { application: next, ...(rawToken ? { oneTimeToken: rawToken, expiresAt } : {}), auditId: auditRef.id };
    });
  }

  async accept(applicationId: string, token: string, identity: { uid: string; email: string },
    now = new Date().toISOString()): Promise<AcademyApplicationRecord> {
    if (!UID.test(identity.uid) || !identity.email.includes("@")) throw new Error("INVITATION_IDENTITY_INVALID");
    const appRef = this.applicationRef(applicationId);
    const inviteRef = this.invitationRef(applicationId);
    const auditRef = this.db.collection("institutionApplicationAudits").doc(randomUUID());
    return this.db.runTransaction(async tx => {
      const [a, i] = await Promise.all([tx.get(appRef), tx.get(inviteRef)]);
      if (!a.exists || !i.exists) throw new Error("INVITATION_INVALID");
      const application = this.checkedApplication(a.data(), applicationId);
      const invitation = i.data() as StoredInvitation;
      if (invitation.status !== "pending" || application.status !== "invitation_pending" ||
          invitation.applicationId !== applicationId || invitation.tenantId !== application.tenantId ||
          invitation.applicantUid !== identity.uid || application.applicantUid !== identity.uid ||
          invitation.applicantEmail !== identity.email.trim().toLowerCase() ||
          application.applicantEmail !== identity.email.trim().toLowerCase() ||
          !compareInvitationDigest(token, invitation.tokenDigest)) {
        throw new Error("INVITATION_INVALID");
      }
      if (Date.parse(invitation.expiresAt) <= Date.parse(now)) throw new Error("INVITATION_EXPIRED");
      const next: AcademyApplicationRecord = { ...application, status: "invitation_accepted",
        invitationAcceptedAt: now, updatedAt: now,
        retentionExpiresAt: retentionDate("invitation_accepted", now) };
      tx.update(inviteRef, { status: "accepted", acceptedAt: now });
      tx.update(appRef, next);
      tx.create(auditRef, { applicationId, actorUid: identity.uid, action: "accept",
        previousStatus: application.status, nextStatus: next.status,
        tenantId: next.tenantId, occurredAt: now });
      return next;
    });
  }
}
