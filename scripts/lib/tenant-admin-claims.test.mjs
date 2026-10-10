import { describe, expect, it } from "vitest";
import {
  computeTenantAdminPlanHash,
  parseTenantAdminCli,
  planTenantAdminClaims,
} from "./tenant-admin-claims.mjs";

describe("tenant administrator role provisioning", () => {
  it("is a dry-run by default; applying requires independent project/email/plan confirmations", () => {
    const opts = [
      "--project", "luma-learning-intelligence",
      "--uid", "test-user-42", "--action", "grant",
      "--tenant-id", "seres", "--operator", "operator@example.org",
      "--reason", "Approved by tenant owner for institutional operations.",
    ];
    const draft = parseTenantAdminCli(opts);
    expect(draft.apply).toBe(false);
    expect(draft.tenantIds).toEqual(["seres"]);
    expect(() => parseTenantAdminCli([...opts, "--apply"])).toThrow("ADMIN_APPLY_CONFIRMATION_REQUIRED");
    expect(parseTenantAdminCli([...opts, "--apply",
      "--confirm-project", "luma-learning-intelligence",
      "--confirm-email", "verified@example.org",
      "--plan-sha", "a".repeat(64),
    ]).apply).toBe(true);
    expect(() => parseTenantAdminCli([...opts, "--project", "another-project"]))
      .toThrow("ADMIN_DUPLICATE_FLAG");
  });

  it("grants specific tenants without turning a coach into a superuser or altering unrelated claims", () => {
    const prior = { coach: true, role: "coach", tenantIds: ["training-other"],
      coachLearnerIds: ["learner-1"], customMetadata: "owned" };
    const grant = planTenantAdminClaims(prior, "grant", ["seres"]);
    expect(grant.beforeTenants).toEqual([]);
    expect(grant.next).toMatchObject({
      coach: true, role: "coach", admin: true, tenantIds: ["training-other"],
      coachLearnerIds: ["learner-1"], adminTenantIds: ["seres"],
      customMetadata: "owned",
    });
    expect(grant.next.superuser).toBeUndefined();
    expect(planTenantAdminClaims(grant.next, "grant", ["seres"]).changed).toBe(false);
    const revoked = planTenantAdminClaims(grant.next, "revoke", ["seres"]);
    expect(revoked.afterTenants).toEqual([]);
    expect(revoked.next.admin).toBeUndefined();
    expect(revoked.next.adminTenantIds).toEqual([]);
    expect(revoked.next.role).toBe("coach");
    expect(revoked.next.coachLearnerIds).toEqual(["learner-1"]);
  });

  it("migrates legacy admin scope into explicit role scopes before removal", () => {
    const previous = { role: "admin", tenantId: "legacy", tenantIds: ["another"] };
    const plan = planTenantAdminClaims(previous, "revoke", ["another"]);
    expect(plan.beforeTenants).toEqual(["another", "legacy"]);
    expect(plan.next.adminTenantIds).toEqual(["legacy"]);
    expect(plan.next.admin).toBe(true);
    const last = planTenantAdminClaims(plan.next, "revoke", ["legacy"]);
    expect(last.afterTenants).toEqual([]);
    expect(last.next.admin).toBeUndefined();
    expect(last.next.role).toBeUndefined();
    expect(last.next.tenantId).toBe("legacy");
    expect(last.next.adminTenantIds).toEqual([]);
  });

  it("rejects escalation, incorrect tenant and unsafe claim payloads", () => {
    expect(() => planTenantAdminClaims({ superuser: true }, "grant", ["seres"]))
      .toThrow("SUPERUSER_CLAIMS_NOT_MANAGED_BY_THIS_TOOL");
    expect(() => planTenantAdminClaims({}, "grant", ["../../other"]))
      .toThrow("TENANT_SCOPE_INVALID");
    expect(() => planTenantAdminClaims({}, "revoke", ["seres"]))
      .toThrow("TENANT_SCOPE_NOT_ASSIGNED");
    expect(() => planTenantAdminClaims({ custom: "x".repeat(999) }, "grant", ["seres"]))
      .toThrow("FIREBASE_CUSTOM_CLAIMS_LIMIT_EXCEEDED");
  });

  it("hashes plans reproducibly, including the previous claims for drift detection", () => {
    const one = computeTenantAdminPlanHash({ uid: "a", previous: { role: "coach", coach: true } });
    const two = computeTenantAdminPlanHash({ previous: { coach: true, role: "coach" }, uid: "a" });
    const changed = computeTenantAdminPlanHash({ previous: { role: "admin", coach: true }, uid: "a" });
    expect(one).toMatch(/^[a-f0-9]{64}$/);
    expect(one).toBe(two);
    expect(one).not.toBe(changed);
  });
});
