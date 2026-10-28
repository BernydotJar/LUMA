import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import { TeachingTwinStore } from "./teaching-store";
import type { TeachingTwinMethod } from "./contracts";

const method: TeachingTwinMethod = {
  title: "Socratic protocol", objective: "Transfer PAS skills",
  pedagogicalPrinciples: ["Show source before conclusion"],
  strategies: {
    explain: { instruction: "Example", approvedSourceIds: ["src-1"] },
    practice: { instruction: "Practice", approvedSourceIds: ["src-2"] },
    remediate: { instruction: "Contrast", approvedSourceIds: ["src-3"] },
  },
  escalation: { consecutiveFailures: 2, confidenceBelow: 0.4 },
  assessment: { rubricId: "r1", rubricVersion: "1", criterionIds: ["a", "b"] },
};

/** Minimal transactional adapter for contract tests; real emulator remains a release gate. */
function fakeFirestore() {
  const docs = new Map<string, Record<string, unknown>>();
  const doc = (key: string) => ({
    key,
    collection: (name: string) => collection(`${key}/${name}`),
    get: async () => ({
      exists: docs.has(key),
      data: () => docs.get(key),
    }),
  });
  const collection = (prefix: string) => ({
    doc: (id: string) => doc(`${prefix}/${id}`),
  });
  const firestore = {
    collection,
    runTransaction: async (operation: (tx: unknown) => Promise<unknown>) => {
      // Staged writes commit only after callback success.
      const changes = new Map<string, Record<string, unknown>>();
      const tx = {
        get: async (ref: ReturnType<typeof doc>) => ({
          exists: docs.has(ref.key),
          data: () => docs.get(ref.key),
        }),
        create: (ref: ReturnType<typeof doc>, value: Record<string, unknown>) => {
          if (docs.has(ref.key) || changes.has(ref.key)) throw new Error("ALREADY_EXISTS");
          changes.set(ref.key, structuredClone(value));
        },
        set: (ref: ReturnType<typeof doc>, value: Record<string, unknown>) => {
          changes.set(ref.key, structuredClone(value));
        },
      };
      const result = await operation(tx);
      for (const [key, value] of changes) docs.set(key, value);
      return result;
    },
  };
  return { db: firestore as unknown as Firestore, docs };
}

describe("Teaching Twin versioned storage", () => {
  it("requires explicit teacher approval and produces immutable receipts", async () => {
    const { db, docs } = fakeFirestore();
    const store = new TeachingTwinStore(db);
    const scope = { tenantId: "org-a", programId: "pas" };
    const first = await store.saveDraft(scope, "teacher-1", method, 0);
    expect(first.status).toBe("DRAFT");
    expect(await store.readApproved(scope)).toBeUndefined();
    const approved = await store.approve(scope, "teacher-1", 1);
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedByUid).toBe("teacher-1");
    expect((await store.approve(scope, "teacher-1", 1)).revision).toBe(1);
    expect([...docs.keys()].filter((k) => k.includes("history/approval-1"))).toHaveLength(1);
    expect((await store.readApproved(scope))?.revision).toBe(1);
  });
  it("preserves last approved method while a new draft is being edited", async () => {
    const { db } = fakeFirestore();
    const store = new TeachingTwinStore(db);
    const scope = { tenantId: "org-a", programId: "pas" };
    await store.saveDraft(scope, "teacher-1", method, 0);
    await store.approve(scope, "teacher-1", 1);
    const draft = await store.saveDraft(scope, "teacher-1", { ...method, title: "Revision 2" }, 1);
    expect(draft.revision).toBe(2);
    expect((await store.readApproved(scope))?.method.title).toBe(method.title);
    await expect(store.saveDraft(scope, "teacher-1", method, 1)).rejects.toThrow(/CONFLICT/);
    await expect(store.approve(scope, "teacher-2", 2)).rejects.toThrow(/UNTRUSTED/);
    await store.approve(scope, "teacher-1", 2);
    expect((await store.readApproved(scope))?.method.title).toBe("Revision 2");
  });
  it("isolates tenant and program paths even for identical learner or teacher identifiers", async () => {
    const { db } = fakeFirestore();
    const store = new TeachingTwinStore(db);
    const a = { tenantId: "org-a", programId: "pas" };
    await store.saveDraft(a, "teacher-1", method, 0);
    await store.approve(a, "teacher-1", 1);
    expect(await store.readApproved({ tenantId: "org-b", programId: "pas" })).toBeUndefined();
    expect(await store.readApproved({ tenantId: "org-a", programId: "other" })).toBeUndefined();
  });
  it("rejects an approved snapshot with modified source data", async () => {
    const { db, docs } = fakeFirestore();
    const store = new TeachingTwinStore(db);
    const scope = { tenantId: "org-a", programId: "pas" };
    await store.saveDraft(scope, "teacher-1", method, 0);
    await store.approve(scope, "teacher-1", 1);
    const release = [...docs.keys()].find((k) => k.endsWith("releases/approved"))!;
    const original = docs.get(release)!;
    docs.set(release, { ...original, method: { ...method, title: "Tampered" } });
    await expect(store.readApproved(scope)).rejects.toThrow(/UNTRUSTED/);
  });
});
