export type ProgramModule = {
  id: string;
  number: number;
  title: string;
  focus: string;
  sourceId: string;
  sourceKind: "documento" | "carpeta" | "material";
  status: "disponible" | "en-curso" | "revision";
  practiceSlugs: string[];
  sourceNote: string;
};

export const programModules: ProgramModule[] = [
  {
    id: "modulo-1",
    number: 1,
    title: "Despertando tu Excelencia",
    focus: "El renacer de tu poder interno",
    sourceId: "1SOQugbNc-7lFqh-9_fAWlq3JNmETskVk",
    sourceKind: "documento",
    status: "disponible",
    practiceSlugs: [],
    sourceNote: "El material fuente incluye P.N.L., aprendizaje, creencias y sistemas representacionales.",
  },
  {
    id: "modulo-2",
    number: 2,
    title: "Comunicación Emocional",
    focus: "Congruencia, calibración, rapport y los tres canales de comunicación",
    sourceId: "166Ucwvs8pilTOwGkrp5wRQ3lvpS4Z5l-",
    sourceKind: "documento",
    status: "disponible",
    practiceSlugs: [
      "congruencia-tres-canales",
      "calibracion-observar-antes-de-interpretar",
      "rapport-sintonia-con-respeto",
    ],
    sourceNote: "Título y ejes tomados del material Practitioner del Módulo 2.",
  },
  {
    id: "modulo-3",
    number: 3,
    title: "Redescubriendo y transformando tu poder",
    focus: "P.A.S., niveles lógicos, creencias, valores e identidad",
    sourceId: "1OwHgWtDXC_AzkU31f6a7tuoHWHl0gv5V",
    sourceKind: "documento",
    status: "en-curso",
    practiceSlugs: [
      "pas-detectar-y-reformular",
      "niveles-logicos-donde-intervenir",
      "creencias-evidencia-e-interpretacion",
      "valores-identidad-y-eleccion",
    ],
    sourceNote: "Título y conceptos tomados del material Practitioner del Módulo 3.",
  },
  {
    id: "modulo-4",
    number: 4,
    title: "Módulo 4",
    focus: "Misión personal, propósito, submodalidades y SCORE",
    sourceId: "1InPVHMxYyCkRxE6ULcZHVlVjTTpHjb5A",
    sourceKind: "material",
    status: "disponible",
    practiceSlugs: [],
    sourceNote: "El título editorial específico no aparece en el material revisado; el foco resume sus ejercicios.",
  },
  {
    id: "modulo-5",
    number: 5,
    title: "Encuentro contigo mismo",
    focus: "Y la razón de tus conflictos",
    sourceId: "1VhVkraWINHDyIZRSSFsrR3KSdBVKiYUi",
    sourceKind: "documento",
    status: "disponible",
    practiceSlugs: [],
    sourceNote: "Título tomado del PDF Practitioner del Módulo 5.",
  },
  {
    id: "modulo-6",
    number: 6,
    title: "Módulo 6",
    focus: "Prácticas avanzadas del Practitioner",
    sourceId: "1r6eGiOztoJ6kx30pAgDT1CY04MDQJkV5",
    sourceKind: "material",
    status: "revision",
    practiceSlugs: [],
    sourceNote: "El material revisado contiene ejercicios sensibles; LUMA lo mantiene en revisión editorial antes de convertirlo en práctica digital.",
  },
  {
    id: "modulo-7",
    number: 7,
    title: "Módulo 7",
    focus: "Reencuadre, línea de tiempo e integración de creencias",
    sourceId: "1c0pWssowRCSo_QrOikfpr49Ul0Df_Jkk",
    sourceKind: "material",
    status: "disponible",
    practiceSlugs: [],
    sourceNote: "El material de ejercicios incluye reencuadre en seis pasos, línea de tiempo e integración de creencias conflictivas.",
  },
];

export const currentProgramModule = programModules.find((module) => module.status === "en-curso") ?? programModules[0];
