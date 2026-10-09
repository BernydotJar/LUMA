import { describe, expect, it } from "vitest";
import {
  MAX_INSTITUTIONAL_BATCH, parseInstitutionalBulkInput,
  runInstitutionalBulk, type BulkGrantWriter,
} from "./institutional-bulk";

function future(days = 90) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}
function input(emails: unknown[]) {
  return {
    tenantId: "tenant-a", programId: "course-1", offeringId: "cohort-1",
    reason: "Seats covered by documented employer training agreement.",
    expiresAt: future(), emails,
  };
}

describe("institutional bulk admissions", () => {
  it("rejects missing, empty, oversized and malformed shared batches before any writes", () => {
    for (const value of [
      null, {}, input([]), input(Array(MAX_INSTITUTIONAL_BATCH + 1).fill("a@example.org")),
      { ...input(["ok@example.org"]), tenantId: "../tenant-a" },
      { ...input(["ok@example.org"]), expiresAt: "2022-01-01T00:00:00Z" },
    ]) expect(() => parseInstitutionalBulkInput(value)).toThrow();
  });

  it("normalizes emails, preserves row order, deduplicates within the file, and isolates errors", async () => {
    const calls: string[] = [];
    const writer: BulkGrantWriter = {
      async grant(grant, uid) {
        expect(uid).toBe("admin-a");
        calls.push(grant.email);
        if (grant.email === "blocked@example.org") {
          throw new Error("INSTITUTIONAL_REACTIVATION_CONFIRMATION_REQUIRED");
        }
        if (grant.email === "internal@example.org") {
          throw new Error("PROVIDER_SECRET_NEVER_LEAK");
        }
        return {
          action: grant.email === "extended@example.org" ? "extended" : "granted",
          record: { enrollmentId: "enroll-" + grant.email },
        };
      },
    };
    const grant = parseInstitutionalBulkInput(input([
      "USER@EXAMPLE.ORG", "user@example.org", "not-a-mail",
      "blocked@example.org", "internal@example.org",
      "extended@example.org",
    ]));
    const result = await runInstitutionalBulk(grant, "admin-a", writer);
    expect(calls).toHaveLength(4);
    expect(result.rows.map(row => row.status))
      .toEqual(["granted", "duplicate_input", "invalid", "rejected", "rejected", "extended"]);
    expect(result.rows[0].email).toBe("user@example.org");
    expect(result.rows[1].enrollmentId).toBeUndefined();
    expect(result.rows[3].error).toBe("institutional_reactivation_confirmation_required");
    expect(result.rows[4].error).toBe("grant_unavailable");
    expect(result.summary).toMatchObject({
      requested: 6, granted: 1, duplicate_input: 1,
      invalid: 1, rejected: 2, extended: 1,
    });
  });

  it("bounds concurrent mutations to four independent transactions", async () => {
    let active = 0;
    let peak = 0;
    const writer: BulkGrantWriter = {
      async grant(grant) {
        active++;
        peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 3));
        active--;
        return { action: "granted", record: { enrollmentId: grant.email } };
      },
    };
    const emails = Array.from({ length: 20 }, (_, i) => "student" + i + "@example.org");
    const result = await runInstitutionalBulk(
      parseInstitutionalBulkInput(input(emails)), "admin-b", writer,
    );
    expect(peak).toBe(4);
    expect(result.summary.granted).toBe(20);
    expect(result.rows.map(x => x.email)).toEqual(emails);
  });
});
