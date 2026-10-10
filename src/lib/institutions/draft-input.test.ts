import { describe, expect, it } from "vitest";
import { parseDraftBrand, parseDraftBrandInput, parseDraftCreateInput } from "./draft-input";

const requestId = "request-unique-000000000001";
const create = {
  templateId: "luma-platform",
  programIds: ["leadership"],
  expectedVersion: 0,
  reasonCode: "institution-onboarding",
  requestId,
};
const brand = { displayName: "LUMA Academy", shortName: "LUMA", palette: ["#ABCDEF", "#112233"] };
const patch = { expectedVersion: 1, reasonCode: "brand-update", requestId, brand };

describe("Institution draft request schemas", () => {
  it("accepts neutral creation and exact brand replacement", () => {
    expect(parseDraftCreateInput("academy-A", create)).toMatchObject({
      tenantId: "academy-A", templateId: "luma-platform", expectedVersion: 0,
    });
    expect(parseDraftBrandInput("academy-A", patch)).toMatchObject({
      tenantId: "academy-A", expectedVersion: 1, brand,
    });
    expect(parseDraftBrand(brand)).toEqual(brand);
  });

  it("rejects Seres de Excelencia source assets as a tenant bootstrap template", () => {
    expect(() => parseDraftCreateInput("academy-A", { ...create, templateId: "seres-de-excelencia" }))
      .toThrow("INSTITUTION_DRAFT_TEMPLATE_INVALID");
  });

  it("rejects role, shell, payment, tenant and feature injection via unknown fields", () => {
    for (const extra of [
      { tenantId: "other" }, { features: { commerce: true } },
      { shellId: "gruv-languages" }, { admin: true }, { status: "published" },
    ]) {
      expect(() => parseDraftCreateInput("academy-A", { ...create, ...extra }))
        .toThrow("INSTITUTION_DRAFT_UNEXPECTED_FIELD");
      expect(() => parseDraftBrandInput("academy-A", { ...patch, ...extra }))
        .toThrow("INSTITUTION_DRAFT_UNEXPECTED_FIELD");
    }
  });

  it("rejects unsafe tenant, request, version, reason and programs", () => {
    expect(() => parseDraftCreateInput("../other", create)).toThrow();
    expect(() => parseDraftCreateInput("academy A", create)).toThrow();
    expect(() => parseDraftCreateInput("academy-A", { ...create, requestId: "short" })).toThrow();
    expect(() => parseDraftCreateInput("academy-A", { ...create, expectedVersion: 4 })).toThrow();
    expect(() => parseDraftCreateInput("academy-A", { ...create, reasonCode: "let me in" })).toThrow();
    expect(() => parseDraftCreateInput("academy-A", { ...create, programIds: [] })).toThrow();
    expect(() => parseDraftCreateInput("academy-A", { ...create, programIds: ["a", "a"] })).toThrow();
    expect(() => parseDraftCreateInput("academy-A", { ...create, programIds: ["../x"] })).toThrow();
    expect(() => parseDraftBrandInput("academy-A", { ...patch, expectedVersion: -1 })).toThrow();
    expect(() => parseDraftBrandInput("academy-A", { ...patch, reasonCode: "institution-onboarding" })).toThrow();
  });

  it("rejects unsafe palette, embedded markup controls and logo injection", () => {
    expect(() => parseDraftBrand({ ...brand, logoPath: "https://untrusted.example/logo.png" })).toThrow();
    expect(() => parseDraftBrand({ ...brand, sourceUrl: "javascript:alert(1)" })).toThrow();
    expect(() => parseDraftBrand({ ...brand, displayName: " A " })).toThrow();
    expect(() => parseDraftBrand({ ...brand, displayName: "A\u0001B" })).toThrow();
    expect(() => parseDraftBrand({ ...brand, palette: ["red", "blue"] })).toThrow();
    expect(() => parseDraftBrand({ ...brand, palette: ["#000000"] })).toThrow();
  });
});
