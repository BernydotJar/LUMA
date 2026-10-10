/** Presentation-only identity. Branding never grants access to a learning tenant. */
export interface PublicInstitutionBrand {
  readonly displayName: string;
  readonly shortName: string;
  readonly logoPath?: string;
  readonly sourceUrl?: string;
  readonly palette: readonly string[];
}

/** Preserve the existing Seres de Excelencia appearance exactly. */
export const seresDeExcelenciaBrand = {
  displayName: "Seres de Excelencia",
  shortName: "SE",
  logoPath: "/brand/seres-de-excelencia/logo.png",
  sourceUrl: "https://seresdeexcelencia.com/",
  palette: ["#00A2F1", "#FF438C", "#993366", "#FFFFFF", "#333333"],
} as const satisfies PublicInstitutionBrand;

/** GRUV is a planned language-learning product shell, not an active tenant. */
export const gruvBrand = {
  displayName: "GRUV",
  shortName: "GRUV",
  palette: ["#F8F0D8", "#B75230", "#7D6E43", "#542A36", "#242420"],
} as const satisfies PublicInstitutionBrand;

/** Default platform identity for a new organization; contains no client assets. */
export const lumaPlatformBrand = {
  displayName: "LUMA Learning",
  shortName: "LUMA",
  palette: ["#F5F5F7", "#1D1D1F", "#0A84FF", "#2BB3B1"],
} as const satisfies PublicInstitutionBrand;
