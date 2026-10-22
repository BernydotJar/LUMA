import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { GET, POST, PATCH } from "@/app/api/platform/institutions/[tenantId]/programs/[programId]/assessment-publication/route";
import { loadPublishedProgramAssessment } from "./program-assessment-registry";

const enabled = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST &&
  process.env.FIRESTORE_EMULATOR_HOST && process.env.GCLOUD_PROJECT?.startsWith("demo-"));
const app = enabled ? (getApps()[0] ?? initializeApp({ projectId: process.env.GCLOUD_PROJECT })) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const previousFlag = process.env.LUMA_ASSESSMENT_PUBLICATION_ENABLED;
const ctx = (tenantId: string, programId: string) => ({ params: Promise.resolve({ tenantId, programId }) });
const url = (s: {tenantId: string; programId: string}) =>
  `http://127.0.0.1/api/platform/institutions/${s.tenantId}/programs/${s.programId}/assessment-publication`;
function request(s: {tenantId: string; programId: string}, method: "GET"|"POST"|"PATCH", token?: string, body?: unknown) {
  return new Request(url(s), {
    method,
    ...(token || body ? { headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    } } : {}),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function actor(suffix: string, claims: Record<string, unknown>) {
  const password = "QA!_" + randomUUID();
  const email = `assessment-${suffix}-${randomUUID()}@example.test`;
  const user = await auth!.createUser({ email, password, emailVerified: true });
  await auth!.setCustomUserClaims(user.uid, claims);
  const res = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error("QA_AUTH_TOKEN_UNAVAILABLE");
  const { idToken } = await res.json() as { idToken: string };
  return { uid: user.uid, idToken };
}
const rid = () => "publisher-req-" + randomUUID();

describe.runIf(enabled)("P0 #85 authorized assessment publisher HTTP and Firebase roles", () => {
  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.LUMA_ASSESSMENT_PUBLICATION_ENABLED;
    else process.env.LUMA_ASSESSMENT_PUBLICATION_ENABLED = previousFlag;
    // Do not delete the default Firebase Admin app shared with route tests.
  });

  it("is disabled by default for all HTTP verbs, even authenticated callers", async () => {
    delete process.env.LUMA_ASSESSMENT_PUBLICATION_ENABLED;
    const s = { tenantId: "qa-disabled", programId: "pnl" };
    for (const method of ["GET", "POST", "PATCH"] as const) {
      const r = method === "GET" ? await GET(request(s, method), ctx(s.tenantId, s.programId))
        : method === "POST" ? await POST(request(s, method), ctx(s.tenantId, s.programId))
          : await PATCH(request(s, method), ctx(s.tenantId, s.programId));
      expect(r.status).toBe(503);
      expect((await r.json()).error).toBe("feature_unavailable");
      expect(r.headers.get("cache-control")).toContain("no-store");
    }
  });

  it("prepares with scoped admin; different specifically authorized reviewer; publishes with publisher role; revokes tokens", async () => {
    process.env.LUMA_ASSESSMENT_PUBLICATION_ENABLED = "true";
    const s = { tenantId: "qa-tenant-" + randomUUID(), programId: "pnl-practitioner" };
    const scope = { tenantId: s.tenantId, programId: s.programId };
    const authUsers: string[] = [];
    try {
      const author = await actor("author", { admin: true, adminTenantIds: [s.tenantId], assessmentPublisher: true });
      const reviewer = await actor("reviewer", { admin: true, adminTenantIds: [s.tenantId], assessmentReviewer: true });
      const other = await actor("other", { admin: true, adminTenantIds: ["other-tenant"], assessmentReviewer: true });
      const reader = await actor("learner", { learner: true, tenantIds: [s.tenantId], assessmentReviewer: true });
      authUsers.push(author.uid, reviewer.uid, other.uid, reader.uid);
      const offeringId = "qa-offering-" + randomUUID();
      await db!.collection("programOfferings").doc(offeringId).set({ offeringId, ...s, status: "active" });

      const p = {
        requestId: rid(), expectedPlanRevision: 0, offeringId,
        version: "se-practitioner-entry-v1", curriculumRevision: "pnl-revision-v1",
        classSlugs: ["congruencia-tres-canales","calibracion-observar-antes-de-interpretar"],
        recommendedNextSlug: "congruencia-tres-canales",
        reasonCode: "new-curriculum",
      };
      const review = {
        requestId: rid(), expectedPlanRevision: 1, action: "review",
        reasonCode: "reviewed-with-rights-evidence",
        rightsRecordId: "rights-dossier-v1", rightsEvidenceSha256: "c".repeat(64),
      };
      const publication = {
        requestId: rid(), expectedPlanRevision: 2, action: "publish",
        reasonCode: "publish-reviewed-curriculum",
      };

      expect((await GET(request(s,"GET"),ctx(s.tenantId,s.programId))).status).toBe(401);
      expect((await GET(request(s,"GET",reader.idToken),ctx(s.tenantId,s.programId))).status).toBe(403);
      expect((await GET(request(s,"GET",other.idToken),ctx(s.tenantId,s.programId))).status).toBe(403);
      expect((await POST(request(s,"POST",other.idToken,p),ctx(s.tenantId,s.programId))).status).toBe(403);
      expect((await POST(request(s,"POST",author.idToken,{...p, approvedByUid: author.uid}),ctx(s.tenantId,s.programId))).status).toBe(400);

      const created = await POST(request(s,"POST",author.idToken,p),ctx(s.tenantId,s.programId));
      expect(created.status).toBe(201);
      expect(await created.json()).toMatchObject({ receipt: { status: "prepared", appliedRevision: 1 } });
      expect((await POST(request(s,"POST",author.idToken,p),ctx(s.tenantId,s.programId))).status).toBe(200);
      expect(await loadPublishedProgramAssessment(db!,scope)).toBeNull();

      expect((await PATCH(request(s,"PATCH",author.idToken,review),ctx(s.tenantId,s.programId))).status).toBe(403);
      expect((await PATCH(request(s,"PATCH",other.idToken,review),ctx(s.tenantId,s.programId))).status).toBe(403);
      expect((await PATCH(request(s,"PATCH",reviewer.idToken,{...review, rightsEvidenceSha256:"fake"}),ctx(s.tenantId,s.programId))).status).toBe(400);
      const accepted = await PATCH(request(s,"PATCH",reviewer.idToken,review),ctx(s.tenantId,s.programId));
      expect(accepted.status).toBe(200);
      expect(await accepted.json()).toMatchObject({ receipt: { status: "reviewed", appliedRevision: 2 } });
      expect((await PATCH(request(s,"PATCH",reviewer.idToken,publication),ctx(s.tenantId,s.programId))).status).toBe(403);

      const published = await PATCH(request(s,"PATCH",author.idToken,publication),ctx(s.tenantId,s.programId));
      expect(published.status).toBe(200);
      expect(await published.json()).toMatchObject({ receipt: {
        status: "published", activeVersion: "se-practitioner-entry-v1", appliedRevision: 3,
      }});
      const actual = await loadPublishedProgramAssessment(db!,scope);
      expect(actual?.approvedByUid).toBe(reviewer.uid);
      expect(actual?.submittedByUid).toBe(author.uid);
      expect(actual?.classSlugs).toHaveLength(2);

      const withdraw = { requestId: rid(), expectedPlanRevision: 3,
        action: "withdraw", reasonCode: "security-stop" };
      expect((await PATCH(request(s,"PATCH",reviewer.idToken,withdraw),ctx(s.tenantId,s.programId))).status).toBe(403);
      const revoked = await PATCH(request(s,"PATCH",author.idToken,withdraw),ctx(s.tenantId,s.programId));
      expect(revoked.status).toBe(200);
      expect(await loadPublishedProgramAssessment(db!,scope)).toBeNull();

      await new Promise(resolve => setTimeout(resolve, 1250));
      await auth!.revokeRefreshTokens(author.uid);
      expect((await GET(request(s,"GET",author.idToken),ctx(s.tenantId,s.programId))).status).toBe(401);
      expect((await POST(request(s,"POST",author.idToken,p),ctx(s.tenantId,s.programId))).status).toBe(401);
    } finally {
      await Promise.all(authUsers.map(user => auth!.deleteUser(user).catch(() => {})));
    }
  }, 90000);
});
