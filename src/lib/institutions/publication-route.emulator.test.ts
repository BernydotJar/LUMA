import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { afterAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/platform/institutions/[tenantId]/publication-preflight/route";
import { parseDraftCreateInput } from "./draft-input";
import { FirestoreInstitutionDraftStore } from "./draft-store";
import { getFirestore } from "firebase-admin/firestore";

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const enabled = Boolean(authHost && process.env.FIRESTORE_EMULATOR_HOST &&
  process.env.GCLOUD_PROJECT?.startsWith("demo-"));
const app = enabled ? initializeApp({ projectId: process.env.GCLOUD_PROJECT },
  "publication-route-" + randomUUID()) : null;
const auth = app ? getAuth(app) : null;
const originalFlag = process.env.LUMA_INSTITUTION_PREFLIGHT_ENABLED;
const tenant = () => "tenant-" + randomUUID();
const context = (tenantId: string) => ({ params: Promise.resolve({ tenantId }) });
function request(tenantId: string, token?: string) {
  return new Request(`http://localhost/api/platform/institutions/${tenantId}/publication-preflight`, {
    ...(token ? { headers: { authorization: "Bearer " + token } } : {}),
  });
}
async function signIn(email: string, password: string) {
  const r = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!r.ok) throw new Error("TEST_AUTH_FAILED");
  return (await r.json() as { idToken: string }).idToken;
}

describe.runIf(enabled)("Platform-only read-only publication preflight API", () => {
  afterAll(async () => {
    if (originalFlag === undefined) delete process.env.LUMA_INSTITUTION_PREFLIGHT_ENABLED;
    else process.env.LUMA_INSTITUTION_PREFLIGHT_ENABLED = originalFlag;
    if (app) await deleteApp(app);
  });

  it("is disabled by default independently of all other LUMA feature flags", async () => {
    delete process.env.LUMA_INSTITUTION_PREFLIGHT_ENABLED;
    const r = await GET(request("tenant-test"), context("tenant-test"));
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "feature_unavailable" });
    expect(r.headers.get("cache-control")).toContain("no-store");
    process.env.LUMA_INSTITUTION_PREFLIGHT_ENABLED = "True";
    expect((await GET(request("tenant-test"), context("tenant-test"))).status).toBe(503);
  });

  it("denies admin and anonymous access and distinguishes 404 and invalid tenant", async () => {
    process.env.LUMA_INSTITUTION_PREFLIGHT_ENABLED = "true";
    const adminEmail = `preview-admin-${randomUUID()}@example.org`;
    const ownerEmail = `preview-owner-${randomUUID()}@example.org`;
    const pass = `EmulatorOnly-${randomUUID()}`;
    const admin = await auth!.createUser({ email: adminEmail, password: pass, emailVerified: true });
    const owner = await auth!.createUser({ email: ownerEmail, password: pass, emailVerified: true });
    const ids = [admin.uid, owner.uid];
    const a = tenant();
    try {
      await auth!.setCustomUserClaims(admin.uid, { admin: true, adminTenantIds: [a] });
      await auth!.setCustomUserClaims(owner.uid, { superuser: true });
      const adminToken = await signIn(adminEmail, pass);
      const ownerToken = await signIn(ownerEmail, pass);
      expect((await GET(request(a), context(a))).status).toBe(401);
      expect((await GET(request(a, adminToken), context(a))).status).toBe(403);
      expect((await GET(request(a, ownerToken), context(a))).status).toBe(404);
      expect((await GET(request("../bad", ownerToken), context("../bad"))).status).toBe(400);
      const draftStore = new FirestoreInstitutionDraftStore(getFirestore(app!));
      await draftStore.createDraft(parseDraftCreateInput(a, {
        templateId: "gruv-languages", programIds: ["work-english"], expectedVersion: 0,
        requestId: "preflight-route-" + randomUUID(), reasonCode: "institution-onboarding",
      }), owner.uid);
      const result = await GET(request(a, ownerToken), context(a));
      expect(result.status).toBe(200);
      const response = await result.json() as { preflight: {
        localChecksPassed: boolean; activationAllowed: boolean; status: string;
        releaseBlockers: string[]; programs: Array<{ blockers: string[] }>;
      } };
      expect(response.preflight).toMatchObject({
        localChecksPassed: false, activationAllowed: false, status: "blocked",
      });
      expect(response.preflight.programs[0].blockers).toContain("NO_ACTIVE_OFFERING");
      expect(response.preflight.releaseBlockers).toHaveLength(3);
      // A revoked superuser token is denied before any tenant read.
      await new Promise(resolve => setTimeout(resolve, 1200));
      await auth!.revokeRefreshTokens(owner.uid);
      expect((await GET(request(a, ownerToken), context(a))).status).toBe(401);
    } finally {
      await Promise.all(ids.map(uid => auth!.deleteUser(uid)));
    }
  }, 35000);
});
