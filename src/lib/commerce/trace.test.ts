import { describe, expect, it } from "vitest";
import { parseCommerceAccessTraceQuery } from "./trace";

describe("privileged commerce trace query", () => {
  const id = "a".repeat(64);
  it("accepts explicit tenant and a stable entitlement ID", () => {
    expect(parseCommerceAccessTraceQuery(
      `https://luma.example/api/commerce/admin/access-trace?tenantId=tenant-a&entitlementId=${id}`,
    )).toEqual({ tenantId: "tenant-a", entitlementId: id });
  });
  it("rejects traversal, missing tenant, malformed identity and extra-long tenant", () => {
    const base = "https://luma.example/api/commerce/admin/access-trace";
    expect(() => parseCommerceAccessTraceQuery(`${base}?entitlementId=${id}`))
      .toThrow("INVALID_TRACE_TENANT");
    expect(() => parseCommerceAccessTraceQuery(`${base}?tenantId=tenant/a&entitlementId=${id}`))
      .toThrow("INVALID_TRACE_TENANT");
    expect(() => parseCommerceAccessTraceQuery(`${base}?tenantId=tenant-a&entitlementId=unknown`))
      .toThrow("INVALID_TRACE_ENTITLEMENT");
  });
});

import type { Firestore } from "firebase-admin/firestore";
import { readCommerceAccessTrace } from "./trace";

function fakeTraceDb(enrollmentTenant: string, entitlementTenant?: string) {
  let learnerLookupCount = 0;
  const notFound = { exists: false };
  const db = {
    collection(name: string) {
      if (name === "commerceTenants") return {
        doc() { return {
          collection() { return {
            doc() { return {
              async get() {
                return entitlementTenant
                  ? { exists: true, data: () => ({
                    tenantId: entitlementTenant, productId: "course-one",
                    purchaseKey: "stripe:purchase-one", status: "active",
                    lastSourceEvent: { provider: "stripe", externalEventId: "evt-one",
                      type: "commerce.payment.confirmed", occurredAt: "2026-10-08T12:00:00Z" },
                  }) }
                  : notFound;
              },
            }; },
          }; },
        }; },
      };
      if (name === "commerceEnrollments") return {
        doc() { return {
          async get() { return { exists: true, data: () => ({
            tenantId: enrollmentTenant, enrollmentId: "ent-one",
            programId: "program-one", learnerId: "learner-one", status: "active",
          }) }; },
        }; },
      };
      if (name === "commerceProviderEvents") return {
        where() { return { limit() { return {
          async get() { return { size: 1, docs: [{ data: () => ({
            provider: "stripe", externalEventId: "evt-one",
            type: "commerce.payment.confirmed", occurredAt: "2026-10-08T12:00:00Z",
            resolution: { tenantId: "tenant-a" }, processingStatus: "processed",
            correlationId: "correlation-one", buyerEmail: "secret@example.com",
          }) }] }; },
        }; } }; },
      };
      if (name === "learners") {
        learnerLookupCount++;
        return { doc() { return { async get() { return { exists: true }; } }; } };
      }
      throw new Error("UNEXPECTED_COLLECTION");
    },
  } as unknown as Firestore;
  return { db, learnerLookups: () => learnerLookupCount };
}

describe("admin access trace tenant privacy", () => {
  const id = "a".repeat(64);
  it("fails closed for an enrollment stored under another tenant", async () => {
    const { db, learnerLookups } = fakeTraceDb("tenant-b");
    expect(await readCommerceAccessTrace(db, "tenant-a", id)).toBeNull();
    expect(learnerLookups()).toBe(0);
  });
  it("excludes mismatched tenant enrollment even when entitlement is valid", async () => {
    const { db, learnerLookups } = fakeTraceDb("tenant-b", "tenant-a");
    const result = await readCommerceAccessTrace(db, "tenant-a", id);
    expect(result?.enrollment).toBeNull();
    expect(result?.learningTwin.initializedWithOnboarding).toBe(false);
    expect(learnerLookups()).toBe(0);
  });
  it("returns a sanitized audit chain for the matching tenant", async () => {
    const { db } = fakeTraceDb("tenant-a", "tenant-a");
    const result = await readCommerceAccessTrace(db, "tenant-a", id);
    expect(result?.entitlement).toMatchObject({ status: "active", productId: "course-one" });
    expect(result?.enrollment).toMatchObject({ status: "active", programId: "program-one" });
    expect(result?.learningTwin.initializedWithOnboarding).toBe(true);
    expect(result?.events[0]).toMatchObject({ correlationId: "correlation-one", eventId: "evt-one" });
    expect(JSON.stringify(result)).not.toContain("secret@example.com");
  });
});
