export const LUMA_THEME_STORAGE_KEY = "luma-theme-v1";

export type LumaThemeId = "se" | "light" | "dark";

export type LumaTheme = {
  id: LumaThemeId;
  label: string;
  shortLabel: string;
  description: string;
  source: string;
  palette: readonly string[];
  iconographyPath: string;
};

export const lumaThemes: readonly LumaTheme[] = [
  {
    id: "se",
    label: "Seres de Excelencia",
    shortLabel: "SE",
    description:
      "Una interpretación premium de la identidad institucional: azul luminoso, rosa transformación y ciruela profunda.",
    source: "https://seresdeexcelencia.com/",
    palette: ["#00A2F1", "#FF438C", "#993366", "#FFFFFF", "#333333"],
    iconographyPath: "/iconography/se",
  },
  {
    id: "light",
    label: "Luz Líquida",
    shortLabel: "Claro",
    description:
      "Materiales claros, jerarquía editorial y respuesta física inspirada en interfaces Apple, sin copiar su marca.",
    source: "https://www.ui-skills.com/skills/emilkowalski/apple-design",
    palette: ["#F5F5F7", "#1D1D1F", "#0A84FF", "#2BB3B1", "#7B5CFF"],
    iconographyPath: "/iconography/light",
  },
  {
    id: "dark",
    label: "Inteligencia Nocturna",
    shortLabel: "Oscuro",
    description:
      "Aubergine, grafito, champagne y luz medida para sesiones profundas y superficies analíticas.",
    source: "Sistema LUMA de inteligencia adulta premium",
    palette: ["#24181A", "#F7EDD8", "#EFC86A", "#D97B4B", "#9DAC78"],
    iconographyPath: "/iconography/dark",
  },
] as const;

export const defaultLumaTheme: LumaThemeId = "se";

export function isLumaTheme(value: string | null | undefined): value is LumaThemeId {
  return value === "se" || value === "light" || value === "dark";
}

export function getLumaTheme(id: LumaThemeId): LumaTheme {
  return lumaThemes.find((theme) => theme.id === id) ?? lumaThemes[0];
}
