import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultLumaTheme,
  getLumaTheme,
  isLumaTheme,
  lumaThemes,
} from "./themes";

describe("LUMA theme system", () => {
  it("defines exactly the institutional, light and dark themes", () => {
    expect(lumaThemes.map((theme) => theme.id)).toEqual(["se", "light", "dark"]);
    expect(defaultLumaTheme).toBe("se");
    expect(getLumaTheme("se").palette).toContain("#00A2F1");
  });

  it("rejects unknown or gender-derived theme identifiers", () => {
    expect(isLumaTheme("se")).toBe(true);
    expect(isLumaTheme("light")).toBe(true);
    expect(isLumaTheme("dark")).toBe(true);
    expect(isLumaTheme("female")).toBe(false);
    expect(isLumaTheme("male")).toBe(false);
  });

  it("ships the complete deterministic iconography baseline", () => {
    const manifestPath = join(process.cwd(), "public/iconography/manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      themes: Record<string, { files: string[] }>;
      icons: Record<string, unknown>;
    };
    expect(Object.keys(manifest.icons)).toHaveLength(6);
    expect(Object.keys(manifest.themes)).toEqual(["se", "light", "dark"]);
    for (const theme of Object.values(manifest.themes)) {
      expect(theme.files).toHaveLength(6);
      for (const file of theme.files) {
        expect(existsSync(join(process.cwd(), "public", file.replace(/^\//, "")))).toBe(true);
      }
    }
  });
});
