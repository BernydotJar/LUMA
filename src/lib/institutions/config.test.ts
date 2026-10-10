import { describe, expect, it } from "vitest";
import {
  assertInstitutionConfig,
  composeInstitutionConfig,
  resolveInstitutionForAuthorizedScope,
  type InstitutionConfig,
  type InstitutionConfigStore,
} from "./config";
import { gruvBrand, seresDeExcelenciaBrand } from "./public-brand";
import { gruvLanguagesTemplate, seresDeExcelenciaTemplate } from "./templates";

const seres = composeInstitutionConfig(
  seresDeExcelenciaTemplate, "tenant-seres-test", ["practitioner-test"],
);
const gruv = composeInstitutionConfig(
  gruvLanguagesTemplate, "tenant-gruv-test", ["english-work-test"],
);

const scopedStore: InstitutionConfigStore = {
  async getByTenantId(id) {
    return [seres, gruv].find((item) => item.tenantId === id) ?? null;
  },
};

describe("LUMA product shells and institution configuration", () => {
  it("retains the currently deployed Seres visual identity", () => {
    expect(seres.brand).toEqual(seresDeExcelenciaBrand);
    expect(seres.brand.logoPath).toBe("/brand/seres-de-excelencia/logo.png");
    expect(seres.brand.palette).toEqual([
      "#00A2F1", "#FF438C", "#993366", "#FFFFFF", "#333333",
    ]);
    expect(seres.shellId).toBe("luma-platform");
  });

  it("defines GRUV as a separate, not-yet-activated language product shell", () => {
    expect(gruv.brand).toEqual(gruvBrand);
    expect(gruv.brand.displayName).toBe("GRUV");
    expect(gruv.shellId).toBe("gruv-languages");
    expect(gruv.domain).toBe("professional-languages");
    expect(gruv.competencyFrameworkId).toBe("cefr-aligned-experimental-v1");
    expect(gruv.features.voicePractice).toBe(false);
    expect(gruv.features.commerce).toBe(false);
    expect(gruv.tenantId).not.toBe(seres.tenantId);
  });

  it("chooses an institution only within an already-authorized tenant and program", async () => {
    await expect(resolveInstitutionForAuthorizedScope(
      { tenantId: seres.tenantId, programId: seres.programIds[0] }, scopedStore,
    )).resolves.toEqual(seres);
    await expect(resolveInstitutionForAuthorizedScope(
      { tenantId: gruv.tenantId, programId: gruv.programIds[0] }, scopedStore,
    )).resolves.toEqual(gruv);
  });

  it("does not leak another institution or silently fall back to Seres", async () => {
    await expect(resolveInstitutionForAuthorizedScope(
      { tenantId: "tenant-missing", programId: "practitioner-test" }, scopedStore,
    )).rejects.toThrow("INSTITUTION_NOT_CONFIGURED");
    await expect(resolveInstitutionForAuthorizedScope(
      { tenantId: gruv.tenantId, programId: seres.programIds[0] }, scopedStore,
    )).rejects.toThrow("INSTITUTION_PROGRAM_NOT_CONFIGURED");
    await expect(resolveInstitutionForAuthorizedScope(
      { tenantId: seres.tenantId, programId: gruv.programIds[0] }, scopedStore,
    )).rejects.toThrow("INSTITUTION_PROGRAM_NOT_CONFIGURED");
  });

  it("fails closed when the store returns a config from a different tenant", async () => {
    await expect(resolveInstitutionForAuthorizedScope(
      { tenantId: seres.tenantId, programId: seres.programIds[0] },
      { getByTenantId: async () => gruv },
    )).rejects.toThrow("INSTITUTION_TENANT_MISMATCH");
  });

  it("fails closed on config-store failures instead of treating them as empty", async () => {
    await expect(resolveInstitutionForAuthorizedScope(
      { tenantId: seres.tenantId, programId: seres.programIds[0] },
      { getByTenantId: async () => { throw new Error("STORE_UNAVAILABLE"); } },
    )).rejects.toThrow("STORE_UNAVAILABLE");
  });

  it("rejects invalid tenant/program identifiers, including whitespace-only values", async () => {
    await expect(resolveInstitutionForAuthorizedScope(
      { tenantId: " ", programId: "practitioner-test" }, scopedStore,
    )).rejects.toThrow("INSTITUTION_SCOPE_INVALID");
    await expect(resolveInstitutionForAuthorizedScope(
      { tenantId: "tenant-seres-test", programId: "../other" }, scopedStore,
    )).rejects.toThrow("INSTITUTION_SCOPE_INVALID");
    expect(() => composeInstitutionConfig(seresDeExcelenciaTemplate, "tenant/other", ["x"]))
      .toThrow("INSTITUTION_CONFIG_INVALID");
  });

  it("rejects duplicates, empty programs, invalid versions and externally loaded brand images", () => {
    expect(() => composeInstitutionConfig(seresDeExcelenciaTemplate, "tenant-a", []))
      .toThrow("INSTITUTION_CONFIG_INVALID");
    expect(() => composeInstitutionConfig(seresDeExcelenciaTemplate, "tenant-a", ["x", "x"]))
      .toThrow("INSTITUTION_CONFIG_INVALID");
    expect(() => composeInstitutionConfig(seresDeExcelenciaTemplate, "tenant-a", ["x"], 0))
      .toThrow("INSTITUTION_CONFIG_INVALID");
    const poisoned = { ...seres, brand: { ...seres.brand, logoPath: "https://attacker.example/a.png" } };
    expect(() => assertInstitutionConfig(poisoned as InstitutionConfig))
      .toThrow("INSTITUTION_CONFIG_INVALID");
    const malformed = { ...seres, brand: { ...seres.brand, logoPath: 99 } };
    expect(() => assertInstitutionConfig(malformed as unknown as InstitutionConfig))
      .toThrow("INSTITUTION_CONFIG_INVALID");
    const unsafeUrl = { ...seres, brand: { ...seres.brand, sourceUrl: "javascript:alert(1)" } };
    expect(() => assertInstitutionConfig(unsafeUrl as InstitutionConfig))
      .toThrow("INSTITUTION_CONFIG_INVALID");
  });

  it("does not infer authentication, production activation or skill mastery from a template", () => {
    expect(Object.keys(gruv)).not.toContain("learners");
    expect(Object.keys(gruv)).not.toContain("enrollments");
    expect(Object.keys(gruv)).not.toContain("twin");
    expect(Object.isFrozen(gruv)).toBe(true);
    expect(Object.isFrozen(gruv.programIds)).toBe(true);
    expect(Object.isFrozen(gruv.brand.palette)).toBe(true);
    expect(Object.isFrozen(gruv.features)).toBe(true);
  });
});
