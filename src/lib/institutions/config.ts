import { validLearningScopeId, type LearningScope } from "../learning-entitlement";
import type { PublicInstitutionBrand } from "./public-brand";

/** Product experience is orthogonal to tenant identity. */
export type ProductShellId = "luma-platform" | "gruv-languages";
export type LearningDomain = "adult-learning" | "professional-languages";

export interface InstitutionFeatures {
  readonly tutor: boolean;
  readonly adaptivePractice: boolean;
  readonly liveClassroom: boolean;
  readonly voicePractice: boolean;
  readonly certificates: boolean;
  readonly commerce: boolean;
}

export interface InstitutionTemplate {
  readonly shellId: ProductShellId;
  readonly domain: LearningDomain;
  readonly locale: string;
  readonly competencyFrameworkId: string;
  readonly brand: PublicInstitutionBrand;
  readonly features: InstitutionFeatures;
}

/** Tenant and program IDs come from the enrollment / IAM layer, never from branding. */
export interface InstitutionConfig extends InstitutionTemplate {
  readonly schemaVersion: 1;
  readonly configVersion: number;
  readonly tenantId: string;
  readonly programIds: readonly string[];
}

export interface InstitutionConfigStore {
  getByTenantId(tenantId: string): Promise<InstitutionConfig | null>;
}

function validId(value: unknown): value is string {
  return validLearningScopeId(value) &&
    value.trim() === value && value.trim().length > 0;
}

function validBrand(brand: PublicInstitutionBrand): boolean {
  return typeof brand?.displayName === "string" &&
    brand.displayName.trim().length > 0 &&
    typeof brand.shortName === "string" &&
    brand.shortName.trim().length > 0 &&
    Array.isArray(brand.palette) && brand.palette.length >= 2 &&
    brand.palette.every((color) => /^#[0-9a-fA-F]{6}$/.test(color)) &&
    (brand.logoPath === undefined || (
      typeof brand.logoPath === "string" &&
      brand.logoPath.length <= 256 && brand.logoPath.startsWith("/brand/") &&
      !brand.logoPath.includes("..") &&
      !/[\\?#]/.test(brand.logoPath)
    )) &&
    (brand.sourceUrl === undefined || (
      typeof brand.sourceUrl === "string" &&
      /^https:\/\/[^\s/]+/.test(brand.sourceUrl)
    ));
}

const featureKeys = [
  "tutor", "adaptivePractice", "liveClassroom", "voicePractice", "certificates", "commerce",
] as const;

export function assertInstitutionConfig(config: InstitutionConfig): void {
  if (config?.schemaVersion !== 1 ||
      !Number.isSafeInteger(config.configVersion) || config.configVersion < 1 ||
      !validId(config.tenantId) ||
      !["luma-platform", "gruv-languages"].includes(config.shellId) ||
      !["adult-learning", "professional-languages"].includes(config.domain) ||
      !/^[a-z]{2}(?:-[A-Za-z0-9]{2,8})?$/.test(config.locale) ||
      !/^[a-z][a-z0-9._-]{0,63}$/.test(config.competencyFrameworkId) ||
      !validBrand(config.brand) ||
      !config.features ||
      featureKeys.some((key) => typeof config.features[key] !== "boolean") ||
      !Array.isArray(config.programIds) || config.programIds.length === 0 ||
      config.programIds.some((id) => !validId(id)) ||
      new Set(config.programIds).size !== config.programIds.length) {
    throw new Error("INSTITUTION_CONFIG_INVALID");
  }
}

/** Authoring helper only. Publication/activation still requires a separate release gate. */
export function composeInstitutionConfig(
  template: InstitutionTemplate,
  tenantId: string,
  programIds: readonly string[],
  configVersion = 1,
): InstitutionConfig {
  const result: InstitutionConfig = {
    ...template,
    brand: Object.freeze({
      ...template.brand,
      palette: Object.freeze([...template.brand.palette]),
    }),
    features: Object.freeze({ ...template.features }),
    schemaVersion: 1,
    configVersion,
    tenantId,
    programIds: Object.freeze([...programIds]),
  };
  assertInstitutionConfig(result);
  return Object.freeze(result);
}

/**
 * Call ONLY after server-side identity + effective entitlement resolve LearningScope.
 * This lookup does NOT authorize a learner and MUST NOT accept a raw tenant header.
 * No global, showcase or Seres fallback on absent/mismatched data or a store error.
 */
export async function resolveInstitutionForAuthorizedScope(
  scope: LearningScope,
  store: InstitutionConfigStore,
): Promise<InstitutionConfig> {
  if (!validId(scope?.tenantId) || !validId(scope?.programId)) {
    throw new Error("INSTITUTION_SCOPE_INVALID");
  }
  const manifest = await store.getByTenantId(scope.tenantId);
  if (!manifest) throw new Error("INSTITUTION_NOT_CONFIGURED");
  assertInstitutionConfig(manifest);
  if (manifest.tenantId !== scope.tenantId) {
    throw new Error("INSTITUTION_TENANT_MISMATCH");
  }
  if (!manifest.programIds.includes(scope.programId)) {
    throw new Error("INSTITUTION_PROGRAM_NOT_CONFIGURED");
  }
  return manifest;
}
