import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readSelectedProgram, saveSelectedProgram, selectedProgramStorageKey,
} from "./program-selection";

describe("course selection is only a user-scoped preference", () => {
  const memory = new Map<string, string>();
  beforeEach(() => {
    memory.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => { memory.set(key, value); },
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps coach/learner and different actor choices separate", () => {
    saveSelectedProgram("learner", "mary-learner", "premium");
    saveSelectedProgram("coach", "mary-learner", "evergreen");
    saveSelectedProgram("learner", "another-learner", "other");
    expect(readSelectedProgram("learner", "mary-learner")).toBe("premium");
    expect(readSelectedProgram("coach", "mary-learner")).toBe("evergreen");
    expect(readSelectedProgram("learner", "another-learner")).toBe("other");
    expect(selectedProgramStorageKey("learner", "x")).not.toBe(
      selectedProgramStorageKey("coach", "x"),
    );
  });

  it("ignores malformed program values rather than generating headers", () => {
    saveSelectedProgram("learner", "learner", "../foreign");
    expect(readSelectedProgram("learner", "learner")).toBeNull();
    memory.set(selectedProgramStorageKey("learner", "learner"), "bad/tenant");
    expect(readSelectedProgram("learner", "learner")).toBeNull();
    memory.set(selectedProgramStorageKey("learner", "learner"), "valid_program-1");
    expect(readSelectedProgram("learner", "learner")).toBe("valid_program-1");
  });

  it("does not require browser storage for server rendering", () => {
    vi.stubGlobal("window", undefined);
    expect(readSelectedProgram("learner", "someone")).toBeNull();
    expect(() => saveSelectedProgram("learner", "someone", "a")).not.toThrow();
  });
});
