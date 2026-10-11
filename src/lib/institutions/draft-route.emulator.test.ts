import { randomUUID, createHash } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { GET, PATCH, POST } from "@/app/api/platform/institutions/[tenantId]/draft/route";

const emulatorAuth = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const enabled = Boolean(emulatorAuth && process.env.FIRESTORE_EMULATOR_HOST &&
  process.env.GCLOUD_PROJECT?.startsWith("demo-"));
const app = enabled ? initializeApp({ projectId: process.env.GCLOUD_PROJECT },
  "gruv-route-auth-" + randomUUID()) : null;
const auth = app ? getAuth(app) : null;
const originalFeatureFlag = process.env.LUMA_INSTITUTION_DRAFT_ADMIN_ENABLED;

function context(tenantId: string) { return { params: Promise.resolve({ tenantId }) }; }
function request(method: "GET" | "POST" | "PATCH", tenant: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = "Bearer " + token;
  if (body) headers["content-type"] = "application/json";
  return new Request("http://127.0.0.1/api/platform/institutions/" + tenant + "/draft", {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function signIn(email: string, password: string): Promise<string> {
  const result = await fetch(`http://${emulatorAuth}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!result.ok) throw new Error("TEST_AUTH_EMULATOR_SIGNIN_FAILED");
  const body = await result.json() as { idToken?: string };
  if (!body.idToken) throw new Error("TEST_AUTH_EMULATOR_MISSING_TOKEN");
  return body.idToken;
}

const reqId = () => "gruv-request-" + randomUUID();

describe.runIf(enabled)("Institution draft route with real emulator identity and Firestore", () => {
  afterAll(async () => {
    if (originalFeatureFlag === undefined) delete process.env.LUMA_INSTITUTION_DRAFT_ADMIN_ENABLED;
    else process.env.LUMA_INSTITUTION_DRAFT_ADMIN_ENABLED = originalFeatureFlag;
    if (app) await deleteApp(app);
  });

  it("defaults to disabled without touching auth, tenant data or a billable provider", async () => {
    delete process.env.LUMA_INSTITUTION_DRAFT_ADMIN_ENABLED;
    const res = await GET(request("GET", "any-tenant"), context("any-tenant"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "feature_unavailable" });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("permits only platform creation, tenant-scoped brand edits and rejects revoked/cross-tenant tokens", async () => {
    process.env.LUMA_INSTITUTION_DRAFT_ADMIN_ENABLED = "true";
    const tenantA = "tenant-a-" + randomUUID();
    const tenantB = "tenant-b-" + randomUUID();
    const programA = "english-" + randomUUID();
    const ownerEmail = "gruv-owner-" + randomUUID() + "@example.org";
    const adminAEmail = "gruv-a-" + randomUUID() + "@example.org";
    const adminBEmail = "gruv-b-" + randomUUID() + "@example.org";
    const legacyEmail = "gruv-legacy-" + randomUUID() + "@example.org";
    const pass = "EmulatorOnly-" + randomUUID();
    const users = [] as string[];
    try {
      const owner = await auth!.createUser({ email: ownerEmail, password: pass, emailVerified: true }); users.push(owner.uid);
      const adminA = await auth!.createUser({ email: adminAEmail, password: pass, emailVerified: true }); users.push(adminA.uid);
      const adminB = await auth!.createUser({ email: adminBEmail, password: pass, emailVerified: true }); users.push(adminB.uid);
      const legacy = await auth!.createUser({ email: legacyEmail, password: pass, emailVerified: true }); users.push(legacy.uid);
      await auth!.setCustomUserClaims(owner.uid, { superuser: true });
      await auth!.setCustomUserClaims(legacy.uid, { admin: true, tenantIds: [tenantA] });
      await auth!.setCustomUserClaims(adminA.uid, {
        admin: true, adminTenantIds: [tenantA], tenantIds: [tenantB],
      });
      await auth!.setCustomUserClaims(adminB.uid, {
        admin: true, adminTenantIds: [tenantB], tenantIds: [tenantA],
      });
      const ownerToken = await signIn(ownerEmail, pass);
      const aToken = await signIn(adminAEmail, pass);
      const bToken = await signIn(adminBEmail, pass);
      const legacyToken = await signIn(legacyEmail, pass);
      const create = {
        templateId: "gruv-languages", programIds: [programA], expectedVersion: 0,
        requestId: reqId(), reasonCode: "institution-onboarding",
      };
      expect((await GET(request("GET", tenantA), context(tenantA))).status).toBe(401);
      expect((await GET(request("GET", tenantA, bToken), context(tenantA))).status).toBe(403);
      expect((await GET(request("GET", tenantA, legacyToken), context(tenantA))).status).toBe(403);
      expect((await GET(request("GET", tenantA, aToken), context(tenantA))).status).toBe(404);
      expect((await POST(request("POST", tenantA, aToken, create), context(tenantA))).status).toBe(403);
      expect((await POST(request("POST", tenantA, ownerToken, { ...create, templateId: "seres-de-excelencia" }), context(tenantA))).status).toBe(400);
      const badMedia = await POST(new Request("http://127.0.0.1/api/platform/institutions/" + tenantA + "/draft", {
        method: "POST", headers: { authorization: "Bearer " + ownerToken, "content-type": "text/plain" },
        body: JSON.stringify(create),
      }), context(tenantA));
      expect(badMedia.status).toBe(415);
      const oversized = await POST(new Request("http://127.0.0.1/api/platform/institutions/" + tenantA + "/draft", {
        method: "POST", headers: { authorization: "Bearer " + ownerToken, "content-type": "application/json" },
        body: JSON.stringify({ ...create, extraneous: "x".repeat(9_000) }),
      }), context(tenantA));
      expect(oversized.status).toBe(413);
      const created = await POST(request("POST", tenantA, ownerToken, create), context(tenantA));
      expect(created.status).toBe(201);
      expect(await created.json()).toMatchObject({ appliedVersion: 1, duplicate: false });
      const retry = await POST(request("POST", tenantA, ownerToken, create), context(tenantA));
      expect(retry.status).toBe(200);
      expect(await retry.json()).toMatchObject({ appliedVersion: 1, duplicate: true });
      const firstRead = await GET(request("GET", tenantA, aToken), context(tenantA));
      expect(firstRead.status).toBe(200);
      expect(await firstRead.json()).toMatchObject({ draft: { config: {
        tenantId: tenantA, programIds: [programA], shellId: "gruv-languages",
        brand: { displayName: "GRUV" },
      } } });
      const brand = { displayName: "GRUV Professional English", shortName: "GRUV", palette: ["#CCAA88", "#222222"] };
      const patch = { requestId: reqId(), expectedVersion: 1, reasonCode: "brand-update", brand };
      expect((await PATCH(request("PATCH", tenantA, bToken, patch), context(tenantA))).status).toBe(403);
      expect((await PATCH(request("PATCH", tenantA, aToken, { ...patch, features: { commerce: true } }), context(tenantA))).status).toBe(400);
      const updated = await PATCH(request("PATCH", tenantA, aToken, patch), context(tenantA));
      expect(updated.status).toBe(200);
      expect(await updated.json()).toMatchObject({ appliedVersion: 2, duplicate: false });
      const repeat = await PATCH(request("PATCH", tenantA, aToken, patch), context(tenantA));
      expect(await repeat.json()).toMatchObject({ appliedVersion: 2, duplicate: true });
      const changedReplay = await PATCH(request("PATCH", tenantA, aToken, {
        ...patch, brand: { ...brand, displayName: "Changed GRUV" },
      }), context(tenantA));
      expect(changedReplay.status).toBe(409);
      expect((await PATCH(request("PATCH", tenantA, aToken, { ...patch, requestId: reqId() }), context(tenantA))).status).toBe(409);
      const after = await GET(request("GET", tenantA, aToken), context(tenantA));
      const body = await after.json() as { draft: { config: { features: { commerce: boolean }; brand: { displayName: string }; configVersion: number } } };
      expect(body.draft.config.brand.displayName).toBe("GRUV Professional English");
      expect(body.draft.config.features.commerce).toBe(false);
      expect(body.draft.config.configVersion).toBe(2);
      // An unexpectedly corrupted/foreign stored identity must never fall back to a real institution.
      await getFirestore(app!).collection("institutionConfigDrafts")
        .doc(createHash("sha256").update(tenantA).digest("hex"))
        .update({ "config.tenantId": tenantB });
      const corrupt = await GET(request("GET", tenantA, aToken), context(tenantA));
      expect(corrupt.status).toBe(503);
      expect(await corrupt.json()).toEqual({ error: "draft_service_unavailable" });
      // Wait for second-resolution Firebase revocation boundary, as in the existing LUMA auth harness.
      await new Promise(resolve => setTimeout(resolve, 1250));
      await auth!.setCustomUserClaims(adminA.uid, { admin: true, adminTenantIds: [] });
      await auth!.revokeRefreshTokens(adminA.uid);
      expect((await GET(request("GET", tenantA, aToken), context(tenantA))).status).toBe(401);
      expect((await PATCH(request("PATCH", tenantA, aToken, { ...patch, requestId: reqId() }), context(tenantA))).status).toBe(401);
    } finally {
      await Promise.all(users.map(uid => auth!.deleteUser(uid)));
    }
  }, 50_000);
});
