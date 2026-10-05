import { describe, expect, it } from "vitest";
import { firstDisplayName, sanitizePreferredName } from "./profile-name";

describe("participant display name", () => {
  it("normalizes whitespace and strips control characters", () => {
    expect(sanitizePreferredName("  María\n  Fernanda\u0000 ")).toBe("María Fernanda");
  });

  it("caps the preferred name length", () => {
    expect(sanitizePreferredName("A".repeat(80))).toHaveLength(48);
  });

  it("uses the first visible name in compact surfaces", () => {
    expect(firstDisplayName("María Fernanda Cardona")).toBe("María");
    expect(firstDisplayName("", "Participante")).toBe("Participante");
  });
});
