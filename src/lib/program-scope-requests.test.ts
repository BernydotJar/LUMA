import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectedProgramStorageKey } from "./program-selection";
import { fetchPersistentLearningPlan } from "./learning-api-client";
import { fetchCoachLearners, fetchCoachInterventions } from "./coach-api-client";

vi.mock("./firebase-client", () => ({
  firebaseAuth: {
    currentUser: { uid: "scope-test-user", getIdToken: async () => "emulator-test-token" },
  },
}));

describe("per-program browser request scope", () => {
  const values = new Map<string, string>();
  const fetchMock = vi.fn(async () => new Response(
    JSON.stringify({ plan: { nextAction: {} }, learners: [], interventions: [] }),
    { status: 200, headers: { "content-type": "application/json" } },
  ));

  beforeEach(() => {
    values.clear();
    fetchMock.mockClear();
    vi.stubGlobal("window", {
      localStorage: { getItem: (key: string) => values.get(key) ?? null },
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("scopes a learner plan request to the selected program", async () => {
    values.set(selectedProgramStorageKey("learner", "scope-test-user"), "qa-mary-live");
    await fetchPersistentLearningPlan();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/learning/plan");
    expect((init.headers as Record<string, string>)["x-luma-program-id"]).toBe("qa-mary-live");
  });

  it("scopes roster and interventions to the coach program, never the learner choice", async () => {
    values.set(selectedProgramStorageKey("learner", "scope-test-user"), "qa-mary-evergreen");
    values.set(selectedProgramStorageKey("coach", "scope-test-user"), "qa-mary-live");
    await fetchCoachLearners();
    await fetchCoachInterventions();
    for (const [, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      expect((init.headers as Record<string, string>)["x-luma-program-id"]).toBe("qa-mary-live");
    }
  });

  it("does not invent a program when no selection exists", async () => {
    await fetchPersistentLearningPlan();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-luma-program-id"]).toBeUndefined();
    // In entitled mode the server returns 409 until the learner chooses.
  });
});
