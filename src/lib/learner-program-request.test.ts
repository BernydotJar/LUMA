import { beforeEach, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({
  uid: "student-a", token: "jwt-a", selected: "course-b",
  tokenHook: undefined as undefined | (() => void),
}));
vi.mock("./firebase-client", () => ({ firebaseAuth: {
  get currentUser() { return state.uid ? { uid: state.uid, getIdToken: async () => {
    state.tokenHook?.(); return state.token;
  } } : null; },
} }));
vi.mock("./program-selection", () => ({ readSelectedProgram: (_: string, uid: string) =>
  uid === "student-a" || uid === "student-b" ? state.selected : null,
}));
import { captureLearnerRequestScope, learnerProgramHeaders, assertLearnerRequestScope } from "./learner-program-request";
import { loadLearnerReflection, saveLearnerReflection } from "./learning-reflections-client";

beforeEach(() => {
  state.uid = "student-a";
  state.selected = "course-b";
  state.token = "jwt-a";
  state.tokenHook = undefined;
  vi.restoreAllMocks();
});

test("selected program is sent with GET/POST reflection data and server enforces it", async () => {
  const requests: { method: string; headers: Headers; body?: string }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => {
    requests.push({ method: options.method ?? "GET", headers: new Headers(options.headers), body: options.body as string });
    return { ok: true, json: async () => ({ reflection: { experienceId: "sample", response: "valid response" } }) };
  }));
  const expected = { uid: "student-a", programId: "course-b" };
  await loadLearnerReflection("sample", expected);
  await saveLearnerReflection("sample", "long learner reflection for course B", expected);
  expect(requests.map(r => r.headers.get("x-luma-program-id"))).toEqual(["course-b", "course-b"]);
  expect(requests.map(r => r.headers.get("authorization"))).toEqual(["Bearer jwt-a", "Bearer jwt-a"]);
  expect(requests.map(r => r.method)).toEqual(["GET", "POST"]);
  vi.unstubAllGlobals();
});

test("blocks selected course change during Firebase token acquisition", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const scope = captureLearnerRequestScope("student-a", "course-b");
  state.tokenHook = () => { state.selected = "course-a"; };
  await expect(learnerProgramHeaders(scope)).rejects.toThrow("LEARNER_PROGRAM_CHANGED");
  await expect(saveLearnerReflection("sample", "definitely a full response", scope)).rejects.toThrow("LEARNER_PROGRAM_CHANGED");
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test("rejects signed-in account changes before or after course requests", async () => {
  const scope = captureLearnerRequestScope("student-a", "course-b");
  state.tokenHook = () => { state.uid = "student-b"; };
  await expect(learnerProgramHeaders(scope)).rejects.toThrow("LEARNER_IDENTITY_CHANGED");
  state.uid = "student-b";
  expect(() => assertLearnerRequestScope(scope)).toThrow("LEARNER_IDENTITY_CHANGED");
});

test("rejects stale explicit program even when an environment fallback might exist", () => {
  expect(() => captureLearnerRequestScope("student-a", "course-a")).toThrow("LEARNER_PROGRAM_CHANGED");
});

test("a selection switch while the reflection response is in flight is never rendered as current evidence", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => {
    state.selected = "course-c";
    return { ok: true, json: async () => ({ reflection: { experienceId: "sample", response: "not safe for displayed course" } }) };
  }));
  await expect(loadLearnerReflection("sample", { uid: "student-a", programId: "course-b" }))
    .rejects.toThrow("LEARNER_PROGRAM_CHANGED");
  vi.unstubAllGlobals();
});
