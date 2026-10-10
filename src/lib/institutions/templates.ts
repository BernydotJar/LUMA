import { gruvBrand, lumaPlatformBrand, seresDeExcelenciaBrand } from "./public-brand";
import type { InstitutionTemplate } from "./config";

export const seresDeExcelenciaTemplate: InstitutionTemplate = Object.freeze({
  shellId: "luma-platform",
  domain: "adult-learning",
  locale: "es-419",
  competencyFrameworkId: "competency-evidence-v1",
  brand: seresDeExcelenciaBrand,
  features: Object.freeze({
    tutor: true,
    adaptivePractice: true,
    liveClassroom: true,
    voicePractice: false,
    certificates: true,
    commerce: true,
  }),
});

/** No deploy, entitlement, revenue or CEFR certification is implied by this template. */
export const gruvLanguagesTemplate: InstitutionTemplate = Object.freeze({
  shellId: "gruv-languages",
  domain: "professional-languages",
  locale: "en",
  competencyFrameworkId: "cefr-aligned-experimental-v1",
  brand: gruvBrand,
  features: Object.freeze({
    tutor: true,
    adaptivePractice: true,
    liveClassroom: false,
    voicePractice: false,
    certificates: false,
    commerce: false,
  }),
});

/** Safe neutral starter. New tenants must never inherit SE institutional branding. */
export const lumaPlatformTemplate: InstitutionTemplate = Object.freeze({
  shellId: "luma-platform",
  domain: "adult-learning",
  locale: "es-419",
  competencyFrameworkId: "competency-evidence-v1",
  brand: lumaPlatformBrand,
  features: Object.freeze({
    tutor: false,
    adaptivePractice: false,
    liveClassroom: false,
    voicePractice: false,
    certificates: false,
    commerce: false,
  }),
});
