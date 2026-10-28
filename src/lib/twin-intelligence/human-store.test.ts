import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import { HumanInterventionStore } from "./human-store";

function fakeDb() {
  const docs = new Map<string, Record<string, unknown>>();
  const doc = (key: string) => ({
    key, id: key.split("/").at(-1)!,
    get: async () => ({ exists: docs.has(key), data: () => docs.get(key) }),
    collection: (name: string) => collection(`${key}/${name}`),
  });
  const collection = (prefix: string) => ({
    doc: (value: string) => doc(`${prefix}/${value}`),
    where: (field: string, op: string, value: string) => ({
      limit: (limit: number) => ({
        get: async () => ({
          docs: [...docs.entries()].filter(([key, data]) =>
            key.startsWith(`${prefix}/`) && key.split("/").length === prefix.split("/").length + 1 &&
            op === "==" && data[field] === value).slice(0, limit)
            .map(([, data]) => ({ data: () => data })),
        }),
      }),
    }),
  });
  const db = {
    collection,
    runTransaction: async (operation: (tx: unknown) => Promise<unknown>) => {
      const pending = new Map<string, Record<string, unknown>>();
      const tx = {
        get: async (ref: ReturnType<typeof doc>) => ({
          exists: docs.has(ref.key),
          data: () => docs.get(ref.key),
        }),
        create: (ref: ReturnType<typeof doc>, value: Record<string, unknown>) => {
          if (docs.has(ref.key) || pending.has(ref.key)) throw new Error("ALREADY_EXISTS");
          pending.set(ref.key, structuredClone(value));
        },
        set: (ref: ReturnType<typeof doc>, value: Record<string, unknown>) => {
          pending.set(ref.key, structuredClone(value));
        },
      };
      const result = await operation(tx);
      for (const [key, data] of pending) docs.set(key, data);
      return result;
    },
  };
  return { db: db as unknown as Firestore, docs };
}

describe("human-led intervention ledger", () => {
  it("opens idempotently from an educator-owned evidence reference", async () => {
    const { db, docs } = fakeDb();
    const store = new HumanInterventionStore(db);
    const scope = { tenantId: "institution-a", programId: "program-pas" };
    const first = await store.open(scope, "teacher-1", "student-1", "verified-event-1", "contact-1");
    const repeated = await store.open(scope, "teacher-1", "student-1", "verified-event-1", "contact-1");
    expect(repeated.interventionId).toBe(first.interventionId);
    expect(first.status).toBe("OPEN");
    expect([...docs.keys()].filter((k) => k.endsWith("/history/event-1"))).toHaveLength(1);
    await expect(store.open(scope, "teacher-2", "student-1",
      "verified-event-1", "contact-1")).rejects.toThrow(/IDEMPOTENCY_CONFLICT/);
  });

  it("closes only with a later verified follow-up and preserves an audit event", async () => {
    const { db, docs } = fakeDb();
    const store = new HumanInterventionStore(db);
    const scope = { tenantId: "institution-a", programId: "program-pas" };
    const opened = await store.open(scope, "teacher-1", "student-1", "verified-event-1", "contact-1");
    await expect(store.close(scope, "teacher-1", "student-1",
      opened.interventionId, 1, "COMPLETED", "verified-event-1",
      new Date(Date.now() + 5_000).toISOString())).rejects.toThrow(/FOLLOWUP_NOT_LATER/);
    const closed = await store.close(scope, "teacher-1", "student-1",
      opened.interventionId, 1, "COMPLETED", "verified-event-2",
      new Date(Date.now() + 5_000).toISOString());
    expect(closed.status).toBe("COMPLETED");
    expect(closed.followUpEventId).toBe("verified-event-2");
    expect([...docs.keys()].filter((k) => k.endsWith("/history/event-2"))).toHaveLength(1);
    await expect(store.close(scope, "teacher-1", "student-1",
      opened.interventionId, 1, "DISMISSED")).rejects.toThrow(/ALREADY_CLOSED/);
  });

  it("does not disclose any record across tenant, program or instructor", async () => {
    const { db } = fakeDb();
    const store = new HumanInterventionStore(db);
    const scope = { tenantId: "institution-a", programId: "program-pas" };
    const opened = await store.open(scope, "teacher-1", "student-1", "verified-event-1", "contact-1");
    expect((await store.listByTeacher(scope, "teacher-1")).length).toBe(1);
    expect(await store.listByTeacher({ tenantId: "institution-b", programId: "program-pas" }, "teacher-1")).toEqual([]);
    expect(await store.listByTeacher({ tenantId: "institution-a", programId: "other-program" }, "teacher-1")).toEqual([]);
    expect(await store.listByTeacher(scope, "teacher-2")).toEqual([]);
    await expect(store.close({ tenantId: "institution-b", programId: "program-pas" },
      "teacher-1", "student-1", opened.interventionId, 1, "DISMISSED"))
      .rejects.toThrow(/NOT_FOUND/);
  });
});
