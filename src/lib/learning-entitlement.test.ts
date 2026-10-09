import { describe, expect, it } from "vitest";
import {
  assertLearningEntitlement,
  learningAccessFailure,
  resolveLearningAccessPolicy,
  type LearningEntitlementStore,
} from "./learning-entitlement";
import type { CommerceEnrollmentRecord } from "./commerce/enrollment";

const uid = "firebase-learner";
const email = "learner@example.com";
const tenantId = "tenant-a";
const identity = { uid, email, email_verified: true };

function enrollment(overrides: Partial<CommerceEnrollmentRecord> = {}): CommerceEnrollmentRecord {
  return {
    enrollmentId: "a".repeat(64),
    entitlementId: "a".repeat(64),
    tenantId,
    programId: "program-a",
    productId: "product-a",
    customerId: "buyer-a",
    learnerId: uid,
    status: "active",
    createdAt: "2026-10-09T00:00:00Z",
    updatedAt: "2026-10-09T00:00:00Z",
    lastProvider: "hotmart",
    lastProviderEventId: "evt-1",
    lastEventAt: "2026-10-09T00:00:00Z",
    ...overrides,
  };
}

function store(initial: CommerceEnrollmentRecord[], claimed: CommerceEnrollmentRecord[] = []) {
  let records = [...initial];
  let calls = 0;
  let claimedTenant: string | undefined;
  const adapter: LearningEntitlementStore = {
    async listByLearner() { return records; },
    async claimByEmail(_learner, _email, tenant) { calls++; claimedTenant = tenant; records = [...records, ...claimed]; return claimed; },
  };
  return { adapter, claimCalls: () => calls, claimedTenant: () => claimedTenant };
}

const strict = { mode: "entitled", tenantId } as const;
const now = "2026-10-09T12:00:00Z";

describe("entitlement access boundary", () => {
  it("preserves the existing showcase by default", async () => {
    expect(resolveLearningAccessPolicy({})).toEqual({ mode: "showcase" });
    const adapter: LearningEntitlementStore = {
      listByLearner: async () => { throw new Error("SHOULD_NOT_QUERY"); },
      claimByEmail: async () => { throw new Error("SHOULD_NOT_CLAIM"); },
    };
    await expect(assertLearningEntitlement({ uid }, adapter, { mode: "showcase" }, now))
      .resolves.toBeUndefined();
  });

  it("rejects typo or missing tenant in a strict deployment", () => {
    expect(() => resolveLearningAccessPolicy({ LUMA_LEARNING_ACCESS_MODE: "" }))
      .toThrow("LEARNING_ACCESS_MODE_INVALID");
    expect(() => resolveLearningAccessPolicy({ LUMA_LEARNING_ACCESS_MODE: "entiteld" }))
      .toThrow("LEARNING_ACCESS_MODE_INVALID");
    expect(() => resolveLearningAccessPolicy({ LUMA_LEARNING_ACCESS_MODE: "entitled" }))
      .toThrow("LEARNING_ACCESS_TENANT_REQUIRED");
    expect(resolveLearningAccessPolicy({
      LUMA_LEARNING_ACCESS_MODE: "entitled", LUMA_LEARNING_TENANT_ID: tenantId,
    })).toEqual(strict);
  });

  it("allows one verified identity with effective purchased enrollment without a write", async () => {
    const s = store([enrollment()]);
    await expect(assertLearningEntitlement(identity, s.adapter, strict, now))
      .resolves.toBeUndefined();
    expect(s.claimCalls()).toBe(0);
  });

  it("claims the signed payment enrollment on first access and then allows it", async () => {
    const s = store([], [enrollment()]);
    await expect(assertLearningEntitlement(identity, s.adapter, strict, now))
      .resolves.toBeUndefined();
    expect(s.claimCalls()).toBe(1);
    expect(s.claimedTenant()).toBe(tenantId);
  });

  it("rejects non-verified identities without reading or claiming provider data", async () => {
    const s = store([enrollment()]);
    await expect(assertLearningEntitlement({ uid, email, email_verified: false }, s.adapter, strict, now))
      .rejects.toThrow("LEARNING_VERIFIED_EMAIL_REQUIRED");
    expect(s.claimCalls()).toBe(0);
  });

  it.each([
    ["revoked", enrollment({ status: "revoked" })],
    ["expired", enrollment({ accessEndsAt: "2026-10-08T12:00:00Z" })],
    ["wrong tenant", enrollment({ tenantId: "tenant-b" })],
    ["wrong learner", enrollment({ learnerId: "different-uid" })],
  ])("rejects %s even if a commerce document exists", async (_case, record) => {
    const s = store([record]);
    await expect(assertLearningEntitlement(identity, s.adapter, strict, now))
      .rejects.toThrow("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED");
  });

  it("never treats Firestore availability failure as an absent entitlement", async () => {
    const adapter: LearningEntitlementStore = {
      listByLearner: async () => { throw new Error("FIRESTORE_DOWN"); },
      claimByEmail: async () => [],
    };
    await expect(assertLearningEntitlement(identity, adapter, strict, now))
      .rejects.toThrow("FIRESTORE_DOWN");
    expect(learningAccessFailure(new Error("FIRESTORE_DOWN"))).toBeUndefined();
  });

  it("maps denial and bad configuration to safe HTTP statuses", () => {
    expect(learningAccessFailure(new Error("LEARNING_VERIFIED_EMAIL_REQUIRED")))
      .toEqual({ status: 403, error: "verified_email_required" });
    expect(learningAccessFailure(new Error("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED")))
      .toEqual({ status: 403, error: "active_enrollment_required" });
    expect(learningAccessFailure(new Error("LEARNING_ACCESS_TENANT_REQUIRED")))
      .toEqual({ status: 503, error: "learning_access_not_configured" });
  });
});
