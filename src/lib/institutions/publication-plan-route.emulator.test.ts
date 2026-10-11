import { createHash, randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { GET, POST, PATCH } from "@/app/api/platform/institutions/[tenantId]/publication-plan/route";
import { FirestoreInstitutionDraftStore } from "./draft-store";
import { parseDraftCreateInput } from "./draft-input";
import { FirestoreScopedOfferingReader } from "./offering-reader";
import { FirestoreInstitutionPublicationInspector } from "./publication-preflight";

const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const enabled = Boolean(host && process.env.FIRESTORE_EMULATOR_HOST &&
  process.env.GCLOUD_PROJECT?.startsWith("demo-"));
const app = enabled ? initializeApp({ projectId: process.env.GCLOUD_PROJECT },
  "publication-plan-route-" + randomUUID()) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const drafts = db ? new FirestoreInstitutionDraftStore(db) : null;
const inspector = db && drafts ? new FirestoreInstitutionPublicationInspector(drafts,
  new FirestoreScopedOfferingReader(db)) : null;
const flag = process.env.LUMA_INSTITUTION_PLAN_ADMIN_ENABLED;
const planUrl = (tenant: string) => `http://localhost/api/platform/institutions/${tenant}/publication-plan`;
const context = (tenantId: string) => ({ params: Promise.resolve({ tenantId }) });
const requestId = () => "plan-api-" + randomUUID();
function request(tenantId: string, method: "GET" | "POST" | "PATCH", token?: string, body?: unknown) {
  return new Request(planUrl(tenantId), {
    method,
    ...(token || body ? { headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    } } : {}),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function signIn(email: string, password: string): Promise<string> {
  const resp = await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!resp.ok) throw new Error("FIREBASE_TEST_TOKEN_UNAVAILABLE");
  return (await resp.json() as { idToken: string }).idToken;
}

describe.runIf(enabled)("Firebase platform-only publication plan endpoint", () => {
  afterAll(async () => {
    if (flag === undefined) delete process.env.LUMA_INSTITUTION_PLAN_ADMIN_ENABLED;
    else process.env.LUMA_INSTITUTION_PLAN_ADMIN_ENABLED = flag;
    if (app) await deleteApp(app);
  });

  it("is disabled by default for reads and mutations", async () => {
    delete process.env.LUMA_INSTITUTION_PLAN_ADMIN_ENABLED;
    const tenantId = "tenant-" + randomUUID();
    for (const method of ["GET", "POST", "PATCH"] as const) {
      const reply = method === "GET" ? await GET(request(tenantId, method), context(tenantId)) :
        method === "POST" ? await POST(request(tenantId, method), context(tenantId)) :
          await PATCH(request(tenantId, method), context(tenantId));
      expect(reply.status).toBe(503);
      expect(await reply.json()).toEqual({ error: "feature_unavailable" });
      expect(reply.headers.get("cache-control")).toContain("no-store");
    }
    process.env.LUMA_INSTITUTION_PLAN_ADMIN_ENABLED = "TRUE";
    expect((await GET(request(tenantId, "GET"), context(tenantId))).status).toBe(503);
  });

  it("enforces dual authority, clean input, withdrawal, and token revocation", async () => {
    process.env.LUMA_INSTITUTION_PLAN_ADMIN_ENABLED = "true";
    const tenantId = "tenant-" + randomUUID();
    const pass = "EmulatorOnly-" + randomUUID();
    const emailA = `plan-a-${randomUUID()}@example.org`;
    const emailB = `plan-b-${randomUUID()}@example.org`;
    const emailAdmin = `plan-admin-${randomUUID()}@example.org`;
    const users: string[] = [];
    try {
      const a = await auth!.createUser({ email: emailA, password: pass, emailVerified: true }); users.push(a.uid);
      const b = await auth!.createUser({ email: emailB, password: pass, emailVerified: true }); users.push(b.uid);
      const admin = await auth!.createUser({ email: emailAdmin, password: pass, emailVerified: true }); users.push(admin.uid);
      await auth!.setCustomUserClaims(a.uid, { superuser: true });
      await auth!.setCustomUserClaims(b.uid, { role: "superuser" });
      await auth!.setCustomUserClaims(admin.uid, { admin: true, adminTenantIds: [tenantId] });
      const tokenA = await signIn(emailA, pass);
      const tokenB = await signIn(emailB, pass);
      const adminToken = await signIn(emailAdmin, pass);
      await drafts!.createDraft(parseDraftCreateInput(tenantId, {
        templateId: "gruv-languages", programIds: ["english"], expectedVersion: 0,
        requestId: requestId(), reasonCode: "institution-onboarding",
      }), a.uid);
      const id = createHash("sha256").update(`${tenantId}/english`).digest("hex");
      const offering = db!.collection("programOfferings").doc(id);
      await offering.set({ offeringId: id, tenantId, programId: "english", status: "active" });
      const snapshot = await inspector!.inspect(tenantId);
      const prepare = {
        requestId: requestId(), expectedPlanRevision: 0, expectedDraftVersion: 1,
        expectedReadinessDigest: snapshot.inspectionDigest,
      };
      expect((await GET(request(tenantId, "GET"), context(tenantId))).status).toBe(401);
      expect((await GET(request(tenantId, "GET", adminToken), context(tenantId))).status).toBe(403);
      expect((await POST(request(tenantId, "POST", adminToken, prepare), context(tenantId))).status).toBe(403);
      const forged = await POST(request(tenantId, "POST", tokenA, { ...prepare, activationAllowed: true }), context(tenantId));
      expect(forged.status).toBe(400);
      const wrongDigest = await POST(request(tenantId, "POST", tokenA, {
        ...prepare, expectedReadinessDigest: "b".repeat(64),
      }), context(tenantId));
      expect(wrongDigest.status).toBe(409);
      const creation = await POST(request(tenantId, "POST", tokenA, prepare), context(tenantId));
      expect(creation.status).toBe(201);
      expect(await creation.json()).toMatchObject({ receipt: {
        status: "prepared", appliedPlanRevision: 1, activationAllowed: false, duplicate: false,
      } });
      expect((await POST(request(tenantId, "POST", tokenA, prepare), context(tenantId))).status).toBe(200);
      const review = {
        requestId: requestId(), expectedPlanRevision: 1,
        action: "review", reasonCode: "reviewed-for-next-gate",
      };
      expect((await PATCH(request(tenantId, "PATCH", tokenA, review), context(tenantId))).status).toBe(403);
      const approved = await PATCH(request(tenantId, "PATCH", tokenB, review), context(tenantId));
      expect(approved.status).toBe(200);
      expect(await approved.json()).toMatchObject({ receipt: {
        status: "reviewed", appliedPlanRevision: 2, activationAllowed: false,
      } });
      const second = await PATCH(request(tenantId, "PATCH", tokenB, review), context(tenantId));
      expect(await second.json()).toMatchObject({ receipt: { appliedPlanRevision: 2, duplicate: true } });
      const status = await GET(request(tenantId, "GET", tokenB), context(tenantId));
      expect(status.status).toBe(200);
      expect(await status.json()).toMatchObject({ plan: {
        tenantId, status: "reviewed", planRevision: 2, activationAllowed: false,
      } });
      // Emergency withdrawal MUST work even if preflight is now locally blocked.
      await offering.update({ status: "archived" });
      const withdraw = {
        requestId: requestId(), expectedPlanRevision: 2,
        action: "withdraw", reasonCode: "evidence-stale",
      };
      const revoked = await PATCH(request(tenantId, "PATCH", tokenA, withdraw), context(tenantId));
      expect(revoked.status).toBe(200);
      expect(await revoked.json()).toMatchObject({ receipt: { status: "withdrawn", appliedPlanRevision: 3, activationAllowed: false } });
      expect((await db!.collection("institutionConfigs").doc(createHash("sha256").update(tenantId).digest("hex")).get()).exists).toBe(false);
      await new Promise(resolve => setTimeout(resolve, 1250));
      await auth!.revokeRefreshTokens(a.uid);
      expect((await GET(request(tenantId, "GET", tokenA), context(tenantId))).status).toBe(401);
      expect((await PATCH(request(tenantId, "PATCH", tokenA, withdraw), context(tenantId))).status).toBe(401);
    } finally {
      await Promise.all(users.map(user => auth!.deleteUser(user)));
    }
  }, 60000);
});
