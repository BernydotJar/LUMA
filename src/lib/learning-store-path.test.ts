import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { FirestoreLearningStore } from "./learning-store";

function fakeFirestore() {
  const visited: string[] = [];
  type MockCollection = {
    doc(id: string): { collection(name: string): MockCollection; get(): Promise<{ exists: false }> };
    collection(name: string): MockCollection;
  };
  const makeRef = (path: string): MockCollection => ({
    doc(id: string) {
      const next = path + "/" + id;
      visited.push(next);
      return {
        collection(name: string) { return makeRef(next + "/" + name); },
        async get() { return { exists: false }; },
      };
    },
    collection(name: string) { return makeRef(path + "/" + name); },
  });
  return {
    firestore: { collection: (name: string) => makeRef(name) } as unknown as Firestore,
    visited,
  };
}

const hash = (x: string) => createHash("sha256").update(x).digest("hex");

describe("Learning Twin tenant/program storage address", () => {
  it("uses unique document ancestry for same Firebase UID in different programs", async () => {
    const { firestore, visited } = fakeFirestore();
    const uid = "the-same-firebase-uid";
    const global = new FirestoreLearningStore(firestore);
    const tenantA1 = new FirestoreLearningStore(firestore, {
      tenantId: "tenant-a", programId: "program-one",
    });
    const tenantA2 = new FirestoreLearningStore(firestore, {
      tenantId: "tenant-a", programId: "program-two",
    });
    const tenantB1 = new FirestoreLearningStore(firestore, {
      tenantId: "tenant-b", programId: "program-one",
    });
    await Promise.all([
      global.get(uid), tenantA1.get(uid), tenantA2.get(uid), tenantB1.get(uid),
    ]);
    expect(visited).toContain(`learners/${uid}`);
    for (const [tenant, program] of [
      ["tenant-a", "program-one"], ["tenant-a", "program-two"],
      ["tenant-b", "program-one"],
    ]) {
      expect(visited).toContain(
        `learningTenants/${hash(tenant)}/learningPrograms/${hash(program)}/learners/${uid}`,
      );
    }
    expect(new Set(visited.filter((path) => path.endsWith(`/${uid}`)))).toHaveProperty("size", 4);
  });

  it("rejects unsafe scope IDs and invalid learner paths", async () => {
    const { firestore } = fakeFirestore();
    expect(() => new FirestoreLearningStore(firestore, {
      tenantId: "tenant/a", programId: "program",
    })).toThrow("LEARNING_SCOPE_INVALID");
    const store = new FirestoreLearningStore(firestore);
    await expect(store.get("uid/another")).rejects.toThrow("LEARNING_LEARNER_ID_INVALID");
  });
});
