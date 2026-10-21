import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProgramEntryQuestions } from "@/lib/program-assessment";
import { getClassContract } from "@/lib/class-contract";
import { applyEventToPersistentLearner, createPersistentLearnerRecord } from "@/lib/persistent-learning";

const mocks = vi.hoisted(() => ({
  requireLearningUser: vi.fn(),
  requireLearningEntitlement: vi.fn(),
  learningStoreForScope: vi.fn(),
  get: vi.fn(),
  appendEvent: vi.fn(),
}));

vi.mock("@/lib/learning-server", () => ({
  requireLearningUser: mocks.requireLearningUser,
  learningStoreForScope: mocks.learningStoreForScope,
}));
vi.mock("@/lib/learning-entitlement-server", () => ({
  requireLearningEntitlement: mocks.requireLearningEntitlement,
}));

import { GET, POST } from "./route";

const answers = Object.fromEntries(getProgramEntryQuestions().map((question) => [
  question.slug,
  getClassContract(question.slug)!.diagnostic.choices.find((item) => item.correct)!.id,
]));

const onboarding = {
  goal: "emotions", diagnostic: "b", confidence: 3, minutes: 12,
  createdAt: "2026-10-20T11:00:00.000Z",
};
const initial = createPersistentLearnerRecord("mariana", onboarding);

function request(method: string, body?: unknown) {
  return new Request("https://example.test/api/learning/entry-assessment", {
    method, headers: { authorization: "Bearer signed-token", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireLearningUser.mockResolvedValue({ uid: "mariana", email: "learner@test.invalid", email_verified: true });
  mocks.requireLearningEntitlement.mockResolvedValue({ tenantId: "tenant-a", programId: "program-a" });
  mocks.learningStoreForScope.mockReturnValue({ get: mocks.get, appendEvent: mocks.appendEvent });
  mocks.get.mockResolvedValue({ record: initial.record, plan: initial.plan });
  mocks.appendEvent.mockImplementation(async (uid, eventId, event) => {
    const applied = applyEventToPersistentLearner(initial.record, eventId, event);
    return { ...applied, duplicate: false };
  });
});

describe("entry assessment authorized API", () => {
  it("returns only public choices to a verified enrolled learner", async () => {
    const response = await GET(request("GET"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.questions).toHaveLength(5);
    expect(JSON.stringify(body.questions)).not.toContain('"correct":');
    expect(mocks.requireLearningEntitlement).toHaveBeenCalled();
  });

  it("refuses unauthenticated and unenrolled traffic without touching the learner ledger", async () => {
    mocks.requireLearningUser.mockRejectedValueOnce(new Error("AUTH_REQUIRED"));
    expect((await GET(request("GET"))).status).toBe(401);
    mocks.requireLearningEntitlement.mockRejectedValueOnce(new Error("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED"));
    expect((await POST(request("POST", { eventId: "entry-100", answers }))).status).toBe(403);
    expect(mocks.appendEvent).not.toHaveBeenCalled();
  });

  it("requires a persisted profile before the program diagnostic", async () => {
    mocks.get.mockResolvedValueOnce(undefined);
    const response = await POST(request("POST", { eventId: "entry-100", answers }));
    expect(response.status).toBe(409);
    expect(mocks.appendEvent).not.toHaveBeenCalled();
  });

  it("rejects malformed answers before any protected writes", async () => {
    const response = await POST(request("POST", { eventId: "entry-100", answers: {} }));
    expect(response.status).toBe(400);
    expect(mocks.appendEvent).not.toHaveBeenCalled();
  });

  it("records source-versioned non-mastering evidence and a usable recommendation", async () => {
    const response = await POST(request("POST", { eventId: "entry-100", answers }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.summary.correct).toBe(5);
    expect(result.plan.nextAction.href).toContain("/learn/experience/");
    expect(result.plan.state.concepts).toEqual(initial.record.state.concepts);
    const passedEvent = mocks.appendEvent.mock.calls[0][2];
    expect(passedEvent.type).toBe("PROGRAM_ENTRY_ASSESSMENT_COMPLETED");
    expect(passedEvent.twinAuthority).toBe("none");
    expect(passedEvent.sourceId).toBe("se-practitioner-entry-v1");
  });

  it("limits excessive resubmission without creating another ledger event", async () => {
    mocks.get.mockResolvedValueOnce({
      record: { ...initial.record, entryAssessment: { completedAt: new Date().toISOString() } },
      plan: initial.plan,
    });
    const response = await POST(request("POST", { eventId: "entry-101", answers }));
    expect(response.status).toBe(429);
    expect(mocks.appendEvent).not.toHaveBeenCalled();
  });
});
