import { describe, expect, it } from "vitest";
import {
  conceptVisualProfiles,
  experienceModes,
  productSemanticObjects,
} from "./experience-themes";

describe("premium adult semantic system", () => {
  it("maps source concepts to approved semantic objects", () => {
    expect(conceptVisualProfiles.pas.semanticObject).toBe("prism");
    expect(conceptVisualProfiles["logical-levels"].semanticObject).toBe("strata");
    expect(conceptVisualProfiles.beliefs.semanticObject).toBe("lens");
    expect(conceptVisualProfiles.identity.semanticObject).toBe("mirror");
  });

  it("uses product moments rather than decorative generic icons", () => {
    expect(productSemanticObjects.practice.semanticObject).toBe("prism");
    expect(productSemanticObjects.progress.semanticObject).toBe("orbit");
    expect(productSemanticObjects.coachInsight.semanticObject).toBe("strata");
    expect(productSemanticObjects.humanIntervention.semanticObject).toBe("bridge");
  });

  it("defines experience modes without gender labels", () => {
    const keys = Object.keys(experienceModes);
    expect(keys).toEqual([
      "organic-reflection",
      "editorial-warmth",
      "architectural-focus",
      "technical-precision",
    ]);
    expect(keys.join(" ")).not.toMatch(/female|male|woman|man|feminine|masculine/i);
  });
});
