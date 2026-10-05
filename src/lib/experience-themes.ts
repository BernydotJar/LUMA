export type ExperienceMode =
  | "organic-reflection"
  | "editorial-warmth"
  | "architectural-focus"
  | "technical-precision";

export type SemanticObjectVariant =
  | "prism"
  | "orbit"
  | "strata"
  | "bridge"
  | "lens"
  | "mirror"
  | "axis"
  | "cartography";

export type ConceptVisualProfile = {
  id: string;
  label: string;
  semanticObject: SemanticObjectVariant;
  experienceMode: ExperienceMode;
  sourceLocator: string;
  rationale: string;
};

export const experienceModes: Record<
  ExperienceMode,
  { label: string; description: string }
> = {
  "organic-reflection": {
    label: "Reflexión orgánica",
    description:
      "Formas fluidas, vidrio cálido, ritmo contemplativo y profundidad relacional.",
  },
  "editorial-warmth": {
    label: "Editorial Warmth",
    description:
      "Crema, vino, tipografía protagonista y composición editorial adulta.",
  },
  "architectural-focus": {
    label: "Architectural Focus",
    description:
      "Planos estructurales, aubergine, grafito y jerarquía espacial decidida.",
  },
  "technical-precision": {
    label: "Technical Precision",
    description:
      "Reglas finas, métricas exactas y motion medido para superficies analíticas.",
  },
};

export const conceptVisualProfiles: Record<string, ConceptVisualProfile> = {
  "emotional-communication": {
    id: "emotional-communication",
    label: "Comunicación emocional",
    semanticObject: "orbit",
    experienceMode: "organic-reflection",
    sourceLocator: "Módulo 3 · págs. 5–9",
    rationale:
      "El material conecta pensamiento, emoción, acción y objetivo como un sistema de influencia.",
  },
  pas: {
    id: "pas",
    label: "Pensamientos Automáticos Saboteadores",
    semanticObject: "prism",
    experienceMode: "architectural-focus",
    sourceLocator: "Módulo 3 · págs. 9–10",
    rationale:
      "P.A.S. opera como un filtro rápido de interpretación; el prisma visualiza refracción y reenfoque.",
  },
  "logical-levels": {
    id: "logical-levels",
    label: "Niveles lógicos",
    semanticObject: "strata",
    experienceMode: "architectural-focus",
    sourceLocator: "Módulo 3 · págs. 10–13",
    rationale:
      "El material organiza cambio e intervención en niveles, desde entorno hasta identidad y misión.",
  },
  beliefs: {
    id: "beliefs",
    label: "Creencias",
    semanticObject: "lens",
    experienceMode: "editorial-warmth",
    sourceLocator: "Módulo 3 · sección Creencias y cambio",
    rationale:
      "El material describe las creencias como filtros de la experiencia y de la interpretación.",
  },
  values: {
    id: "values",
    label: "Valores",
    semanticObject: "axis",
    experienceMode: "organic-reflection",
    sourceLocator: "Módulo 3 · sección Valores",
    rationale:
      "Los valores orientan decisiones y congruencia, por eso se representan como un eje de alineación.",
  },
  identity: {
    id: "identity",
    label: "Identidad",
    semanticObject: "mirror",
    experienceMode: "editorial-warmth",
    sourceLocator: "Módulo 3 · sección Identidad",
    rationale:
      "La identidad es una capa profunda de autodescripción; el espejo representa perspectiva y profundidad.",
  },
  "mental-maps": {
    id: "mental-maps",
    label: "Mapas mentales",
    semanticObject: "cartography",
    experienceMode: "technical-precision",
    sourceLocator: "Módulo 3 · sección Mapas mentales",
    rationale:
      "El material diferencia mapa y territorio; la cartografía representa una interpretación posible.",
  },
};

export const productSemanticObjects = {
  practice: conceptVisualProfiles.pas,
  progress: {
    ...conceptVisualProfiles["emotional-communication"],
    id: "progress",
    label: "Progreso",
    semanticObject: "orbit" as const,
    rationale:
      "El progreso se presenta como señales relacionadas y en movimiento, no como una mascota o trofeo.",
  },
  coachInsight: {
    ...conceptVisualProfiles["logical-levels"],
    id: "coach-insight",
    label: "Perspectiva del entrenador",
    semanticObject: "strata" as const,
  },
  humanIntervention: {
    id: "human-intervention",
    label: "Intervención humana",
    semanticObject: "bridge" as const,
    experienceMode: "architectural-focus" as const,
    sourceLocator: "Modelo de aprendizaje · escalamiento humano",
    rationale:
      "La intervención conecta evidencia del sistema con contexto experto humano.",
  },
};
