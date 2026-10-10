import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { authorizedAdminTenants, assertTenantAdmin } from "./tenant-admin-access";
import { learningCoachAccessFromClaims } from "./coach-access";
import { resolveClassroomRole } from "./live-classroom";
import { requireLearningAdmin, requireLearningCoachAccess } from "./learning-server";
import type { ProgramOffering } from "./program-delivery";

const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const execFileAsync = promisify(execFile);
const projectId = process.env.GCLOUD_PROJECT || "demo-luma-role-provisioning";
const app = emulatorHost ? initializeApp(
  { projectId }, "auth-roles-" + randomUUID(),
) : undefined;
const auth = app ? getAuth(app) : undefined;

/** Firebase exposes provider claims as an object; normalize to a map at the test boundary. */
function scopedTenants(decoded: object): string[] {
  return authorizedAdminTenants(Object.fromEntries(Object.entries(decoded)));
}

const offering: ProgramOffering = {
  offeringId: "o".repeat(64), tenantId: "tenant-a",
  programId: "executive", title: "Executive Skills",
  cohortKey: "cohort-2026", deliveryMode: "live",
  timezone: "America/Guatemala", coachIds: [],
  status: "active", createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};

async function signIn(email: string, password: string): Promise<string> {
  if (!emulatorHost) throw new Error("AUTH_EMULATOR_REQUIRED");
  const response = await fetch(
    `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!response.ok) throw new Error("EMULATOR_LOGIN_FAILED:" + response.status);
  const body = await response.json() as { idToken?: string };
  if (!body.idToken) throw new Error("EMULATOR_TOKEN_MISSING");
  return body.idToken;
}

describe.runIf(Boolean(emulatorHost && firestoreHost))("Firebase Auth/Firestore tenant-admin role lifecycle", () => {
  afterAll(async () => { if (app) await deleteApp(app); });

  it("checks tenant authority with an emulated ID token, revokes it and rejects a stale token", async () => {
    const email = "tenant-admin-" + randomUUID() + "@example.org";
    const password = "LumaTestOnly-" + randomUUID();
    const user = await auth!.createUser({ email, password, emailVerified: true });
    try {
      await auth!.setCustomUserClaims(user.uid, {
        admin: true, adminTenantIds: ["tenant-a"],
        // These stale claims must NOT widen tenant administration.
        tenantIds: ["tenant-b"], coachLearnerIds: ["cross-tenant-learner"],
      });
      const token = await signIn(email, password);
      const decoded = await auth!.verifyIdToken(token, true);
      const request = new Request("https://luma.example.org/api/coach/learners", {
        headers: { authorization: "Bearer " + token },
      });
      expect((await requireLearningAdmin(request)).uid).toBe(user.uid);
      expect((await requireLearningCoachAccess(request)).access.tenantIds).toEqual(["tenant-a"]);
      expect(decoded.admin).toBe(true);
      expect(scopedTenants(decoded)).toEqual(["tenant-a"]);
      expect(() => assertTenantAdmin(decoded, "tenant-a")).not.toThrow();
      expect(() => assertTenantAdmin(decoded, "tenant-b")).toThrow("TENANT_ADMIN_FORBIDDEN");
      const coachScope = learningCoachAccessFromClaims(decoded);
      expect(coachScope.unrestricted).toBe(false);
      expect(coachScope.learnerIds).toEqual([]);
      expect(resolveClassroomRole({ ...decoded, uid: user.uid }, offering, [])).toBe("instructor");
      expect(resolveClassroomRole({ ...decoded, uid: user.uid }, {
        ...offering, tenantId: "tenant-b",
      }, [])).toBeNull();

      // Firebase verifies revocations using auth_time; deliberately separate
      // sign-in and revocation timestamps to avoid same-second ambiguity.
      await new Promise(resolve => setTimeout(resolve, 1250));
      await auth!.setCustomUserClaims(user.uid, {
        admin: true, adminTenantIds: [],
        tenantIds: ["tenant-b"], coachLearnerIds: ["cross-tenant-learner"],
      });
      await auth!.revokeRefreshTokens(user.uid);
      await expect(auth!.verifyIdToken(token, true)).rejects.toThrow();
      await expect(requireLearningAdmin(request)).rejects.toThrow();
      await new Promise(resolve => setTimeout(resolve, 1250));
      const tokenAfter = await signIn(email, password);
      const updated = await auth!.verifyIdToken(tokenAfter, true);
      expect(scopedTenants(updated)).toEqual([]);
      expect(learningCoachAccessFromClaims(updated)).toMatchObject({
        unrestricted: false, institutionalAdmin: true,
        tenantIds: [], learnerIds: [],
      });
      expect(() => assertTenantAdmin(updated, "tenant-a")).toThrow("TENANT_ADMIN_FORBIDDEN");
    } finally {
      await auth!.deleteUser(user.uid);
    }
  }, 25_000);

  it("runs the actual operator CLI through dry-run, apply, grant, revoke and audit", async () => {
    if (!emulatorHost || !firestoreHost ||
        !emulatorHost.startsWith("127.0.0.1:") ||
        !firestoreHost.startsWith("127.0.0.1:") ||
        !projectId.startsWith("demo-")) {
      throw new Error("REFUSE_CLI_ROLE_TEST_WITHOUT_LOCAL_DEMO_EMULATORS");
    }
    const email = "operator-target-" + randomUUID() + "@example.org";
    const password = "Luma-Only-Emulator-" + randomUUID();
    const uid = (await auth!.createUser({ email, password, emailVerified: true })).uid;
    const execute = async (action: "grant" | "revoke", apply?: { planHash: string }) => {
      const args = [
        "scripts/provision-tenant-admin.mjs",
        "--project", projectId,
        "--uid", uid,
        "--action", action,
        "--tenant-id", "tenant-a",
        "--operator", "operator@example.org",
        "--reason", "Approved isolated emulator tenant administrator integration test.",
      ];
      if (apply) args.push("--apply", "--confirm-project", projectId,
        "--confirm-email", email, "--plan-sha", apply.planHash);
      const { stdout } = await execFileAsync(process.execPath, args, {
        cwd: process.cwd(), env: process.env, timeout: 20_000,
        maxBuffer: 128 * 1024,
      });
      return JSON.parse(stdout) as {
        mode: string; planHash: string; status?: string;
        state?: string; beforeTenants: string[]; afterTenants: string[];
        auditId?: string;
      };
    };
    try {
      const before = await signIn(email, password);
      const grantDraft = await execute("grant");
      expect(grantDraft.mode).toBe("dry-run");
      expect(grantDraft.afterTenants).toEqual(["tenant-a"]);
      expect((await auth!.getUser(uid)).customClaims).toBeUndefined();
      // A revoked token is timestamped by seconds, not milliseconds.
      await new Promise(resolve => setTimeout(resolve, 1250));
      const appliedGrant = await execute("grant", { planHash: grantDraft.planHash });
      expect(appliedGrant.state).toBe("applied");
      expect((await auth!.getUser(uid)).customClaims).toMatchObject({
        admin: true, adminTenantIds: ["tenant-a"],
      });
      await expect(auth!.verifyIdToken(before, true)).rejects.toThrow();

      const grantAudit = await getFirestore(app!).collection("identityRoleAudits")
        .doc(appliedGrant.auditId!).get();
      expect(grantAudit.data()).toMatchObject({
        state: "applied", action: "grant",
        targetUid: uid, tenantIds: ["tenant-a"],
      });
      const withAdmin = await signIn(email, password);
      const current = await auth!.verifyIdToken(withAdmin, true);
      expect(scopedTenants(current)).toEqual(["tenant-a"]);
      expect(() => assertTenantAdmin(current, "tenant-b")).toThrow("TENANT_ADMIN_FORBIDDEN");

      const revokeDraft = await execute("revoke");
      expect(revokeDraft.afterTenants).toEqual([]);
      await new Promise(resolve => setTimeout(resolve, 1250));
      const appliedRevoke = await execute("revoke", { planHash: revokeDraft.planHash });
      expect(appliedRevoke.state).toBe("applied");
      const reloaded = await auth!.getUser(uid);
      expect(reloaded.customClaims?.admin).toBeUndefined();
      expect(reloaded.customClaims?.adminTenantIds).toEqual([]);
      await expect(auth!.verifyIdToken(withAdmin, true)).rejects.toThrow();

      const revokeAudit = await getFirestore(app!).collection("identityRoleAudits")
        .doc(appliedRevoke.auditId!).get();
      expect(revokeAudit.data()).toMatchObject({
        state: "applied", action: "revoke", targetUid: uid,
        tenantIds: ["tenant-a"], afterTenants: [],
      });
      await new Promise(resolve => setTimeout(resolve, 1250));
      const noLongerAdminToken = await signIn(email, password);
      const request = new Request("https://luma.example.org/api/programs", {
        headers: { authorization: "Bearer " + noLongerAdminToken },
      });
      await expect(requireLearningAdmin(request)).rejects.toThrow("ADMIN_REQUIRED");
    } finally {
      await auth!.deleteUser(uid);
    }
  }, 110_000);

});
