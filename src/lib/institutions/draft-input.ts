import type { PublicInstitutionBrand } from "./public-brand";

export type DraftTemplateId = "luma-platform" | "gruv-languages";
export type DraftReasonCode = "institution-onboarding" | "brand-update" | "brand-correction";

export interface DraftCreateInput {
  tenantId: string;
  templateId: DraftTemplateId;
  programIds: readonly string[];
  expectedVersion: 0;
  requestId: string;
  reasonCode: "institution-onboarding";
}

export interface DraftBrandInput {
  tenantId: string;
  brand: Pick<PublicInstitutionBrand, "displayName" | "shortName" | "palette">;
  expectedVersion: number;
  requestId: string;
  reasonCode: "brand-update" | "brand-correction";
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(value).some((key) => !keys.includes(key))) {
    throw new Error("INSTITUTION_DRAFT_UNEXPECTED_FIELD");
  }
}

export function parseDraftTenantId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new Error("INSTITUTION_DRAFT_TENANT_INVALID");
  }
  return value;
}

export function parseDraftRequestId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) {
    throw new Error("INSTITUTION_DRAFT_REQUEST_ID_INVALID");
  }
  return value;
}

function safeName(value: unknown, max: number, label: string): string {
  if (typeof value !== "string" || value !== value.trim() ||
      value.length < 2 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("INSTITUTION_DRAFT_" + label + "_INVALID");
  }
  return value;
}

export function parseDraftBrand(value: unknown): DraftBrandInput["brand"] {
  if (!plainObject(value)) throw new Error("INSTITUTION_DRAFT_BRAND_INVALID");
  exactKeys(value, ["displayName", "shortName", "palette"]);
  if (!Array.isArray(value.palette) || value.palette.length < 2 || value.palette.length > 8 ||
      value.palette.some(color => typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color))) {
    throw new Error("INSTITUTION_DRAFT_PALETTE_INVALID");
  }
  return {
    displayName: safeName(value.displayName, 80, "NAME"),
    shortName: safeName(value.shortName, 20, "SHORT_NAME"),
    palette: [...value.palette] as string[],
  };
}

export function parseDraftCreateInput(tenantId: string, input: unknown): DraftCreateInput {
  parseDraftTenantId(tenantId);
  if (!plainObject(input)) throw new Error("INSTITUTION_DRAFT_PAYLOAD_INVALID");
  exactKeys(input, ["templateId", "programIds", "expectedVersion", "requestId", "reasonCode"]);
  if (input.templateId !== "luma-platform" && input.templateId !== "gruv-languages") {
    throw new Error("INSTITUTION_DRAFT_TEMPLATE_INVALID");
  }
  if (input.expectedVersion !== 0) throw new Error("INSTITUTION_DRAFT_EXPECTED_VERSION_INVALID");
  if (input.reasonCode !== "institution-onboarding") throw new Error("INSTITUTION_DRAFT_REASON_INVALID");
  if (!Array.isArray(input.programIds) || input.programIds.length < 1 || input.programIds.length > 20 ||
      input.programIds.some(id => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) ||
      new Set(input.programIds).size !== input.programIds.length) {
    throw new Error("INSTITUTION_DRAFT_PROGRAMS_INVALID");
  }
  return {
    tenantId,
    templateId: input.templateId,
    programIds: [...input.programIds] as string[],
    expectedVersion: 0,
    requestId: parseDraftRequestId(input.requestId),
    reasonCode: "institution-onboarding",
  };
}

export function parseDraftBrandInput(tenantId: string, input: unknown): DraftBrandInput {
  parseDraftTenantId(tenantId);
  if (!plainObject(input)) throw new Error("INSTITUTION_DRAFT_PAYLOAD_INVALID");
  exactKeys(input, ["brand", "expectedVersion", "requestId", "reasonCode"]);
  if (!Number.isSafeInteger(input.expectedVersion) || (input.expectedVersion as number) < 1) {
    throw new Error("INSTITUTION_DRAFT_EXPECTED_VERSION_INVALID");
  }
  if (input.reasonCode !== "brand-update" && input.reasonCode !== "brand-correction") {
    throw new Error("INSTITUTION_DRAFT_REASON_INVALID");
  }
  return {
    tenantId,
    brand: parseDraftBrand(input.brand),
    expectedVersion: input.expectedVersion as number,
    requestId: parseDraftRequestId(input.requestId),
    reasonCode: input.reasonCode,
  };
}
