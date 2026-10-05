import { rankLearningActions } from "@/lib/learning-engine";
import type {
  JourneyStep,
  LearnerState,
  LearningAction,
  StudioSignal,
  TwinDimension,
} from "@/types/learning";

export const moduleThreeSource = {
  id: "1OwHgWtDXC_AzkU31f6a7tuoHWHl0gv5V",
  label: "Módulo 3 · Redescubriendo y transformando tu poder",
  url: "https://drive.google.com/file/d/1OwHgWtDXC_AzkU31f6a7tuoHWHl0gv5V/view",
  corpus: "Practitioner · Módulo 3",
};

export const learnerState: LearnerState = {
  learnerId: "demo-mariana",
  goal: "Gestionar mis emociones y transformar creencias que me frenan",
  availableMinutes: 12,
  concepts: [
    {
      conceptId: "emotional-communication",
      label: "Comunicación emocional",
      mastery: 0.78,
      confidence: 0.7,
      attempts: 4,
      consecutiveFailures: 0,
      completedContent: true,
      prerequisiteIds: [],
    },
    {
      conceptId: "pas",
      label: "Pensamientos automáticos saboteadores",
      mastery: 0.49,
      confidence: 0.42,
      attempts: 3,
      consecutiveFailures: 2,
      completedContent: true,
      prerequisiteIds: ["emotional-communication"],
    },
    {
      conceptId: "logical-levels",
      label: "Niveles lógicos",
      mastery: 0.62,
      confidence: 0.58,
      attempts: 2,
      consecutiveFailures: 0,
      completedContent: false,
      prerequisiteIds: ["emotional-communication"],
    },
    {
      conceptId: "beliefs",
      label: "Creencias y cambio",
      mastery: 0.55,
      confidence: 0.46,
      attempts: 2,
      consecutiveFailures: 1,
      completedContent: false,
      prerequisiteIds: ["pas", "logical-levels"],
    },
  ],
};

export const learningActions: LearningAction[] = [
  {
    id: "pas-guided-practice",
    kind: "practice",
    conceptId: "pas",
    title: "Detecta un P.A.S. en una situación real",
    description:
      "Identifica el pensamiento, nombra la emoción y prueba una formulación alternativa en un ejercicio guiado.",
    minutes: 12,
    sourceLabel: "Módulo 3 · Comunicación emocional y P.A.S.",
    sourceUrl: moduleThreeSource.url,
    targetMastery: 0.78,
    prerequisiteIds: ["emotional-communication"],
  },
  {
    id: "beliefs-mini-simulation",
    kind: "simulation",
    conceptId: "beliefs",
    title: "Simula un cambio de creencia",
    description:
      "Trabaja un caso breve para distinguir evidencia, interpretación y una creencia alternativa comprobable.",
    minutes: 9,
    sourceLabel: "Módulo 3 · Creencias y cambio de creencias",
    sourceUrl: moduleThreeSource.url,
    targetMastery: 0.75,
    prerequisiteIds: ["pas", "logical-levels"],
  },
  {
    id: "logical-levels-review",
    kind: "review",
    conceptId: "logical-levels",
    title: "Revisa dónde intervenir",
    description:
      "Un mapa visual de entorno, conducta, capacidades, creencias, valores e identidad.",
    minutes: 6,
    sourceLabel: "Módulo 3 · Niveles lógicos",
    sourceUrl: moduleThreeSource.url,
    targetMastery: 0.76,
    prerequisiteIds: ["emotional-communication"],
  },
  {
    id: "emotions-advance",
    kind: "continue",
    conceptId: "emotional-communication",
    title: "Avanza a niveles lógicos",
    description: "La evidencia actual permite evitar repetir la introducción emocional.",
    minutes: 4,
    sourceLabel: "Módulo 3 · Comunicación emocional",
    sourceUrl: moduleThreeSource.url,
    targetMastery: 0.8,
    prerequisiteIds: [],
  },
];

export const rankedActions = rankLearningActions(learnerState, learningActions);
export const nextAction = rankedActions[0];

export const journeySteps: JourneyStep[] = [
  {
    id: "goal",
    label: "Meta definida",
    detail: "Gestionar emociones y transformar creencias limitantes.",
    status: "complete",
    conceptId: "goal",
  },
  {
    id: "emotions",
    label: "Comunicación emocional",
    detail: "Base conceptual demostrada con evidencia consistente.",
    status: "complete",
    conceptId: "emotional-communication",
  },
  {
    id: "pas",
    label: "Pensamientos saboteadores",
    detail: "Práctica de transferencia recomendada ahora.",
    status: "current",
    conceptId: "pas",
  },
  {
    id: "levels",
    label: "Niveles lógicos",
    detail: "Siguiente puente para trabajar creencias y valores.",
    status: "upcoming",
    conceptId: "logical-levels",
  },
  {
    id: "beliefs",
    label: "Creencias e identidad",
    detail: "Aplicación integrada al objetivo personal.",
    status: "upcoming",
    conceptId: "beliefs",
  },
];

export const twinDimensions: TwinDimension[] = [
  {
    id: "knowledge",
    label: "Conocimiento",
    score: 72,
    band: "developing",
    delta: 6,
    summary: "Comprendes la relación entre pensamiento, emoción y conducta.",
    evidence: [
      {
        id: "knowledge-1",
        category: "observed",
        statement: "4 de 5 respuestas conceptuales fueron correctas.",
        source: "Diagnóstico del Módulo 3",
        confidence: 0.94,
      },
      {
        id: "knowledge-2",
        category: "inferred",
        statement: "La distinción entre emoción y pensamiento todavía es inestable bajo presión.",
        source: "Patrón combinado de diagnóstico y simulación",
        confidence: 0.68,
      },
    ],
  },
  {
    id: "application",
    label: "Aplicación",
    score: 58,
    band: "needs-attention",
    delta: 11,
    summary: "Reconoces el concepto, pero transferirlo a un caso real sigue costando.",
    evidence: [
      {
        id: "application-1",
        category: "observed",
        statement: "Dos intentos consecutivos no identificaron el P.A.S. central del escenario.",
        source: "Simulación guiada · caso 2",
        confidence: 0.97,
      },
      {
        id: "application-2",
        category: "observed",
        statement: "La segunda respuesta mejoró después de una pista socrática.",
        source: "Tutor LUMA · interacción 18",
        confidence: 0.93,
      },
    ],
  },
  {
    id: "communication",
    label: "Comunicación",
    score: 84,
    band: "strong",
    delta: 3,
    summary: "Explicas tus ejemplos con claridad y vocabulario propio.",
    evidence: [
      {
        id: "communication-1",
        category: "observed",
        statement: "Explicación correcta sin copiar la definición del material.",
        source: "Respuesta abierta · evidencia 7",
        confidence: 0.9,
      },
    ],
  },
  {
    id: "confidence",
    label: "Confianza",
    score: 46,
    band: "needs-attention",
    delta: -2,
    summary: "Tu autoconfianza está por debajo del desempeño conceptual observado.",
    evidence: [
      {
        id: "confidence-1",
        category: "self-reported",
        statement: "Reportaste 2/5 de seguridad antes de responder.",
        source: "Chequeo de confianza · hoy",
        confidence: 1,
      },
      {
        id: "confidence-2",
        category: "inferred",
        statement: "Podría existir subestimación; hace falta más evidencia antes de concluirlo.",
        source: "Comparación entre confianza y precisión",
        confidence: 0.61,
      },
    ],
  },
  {
    id: "consistency",
    label: "Consistencia",
    score: 68,
    band: "developing",
    delta: 8,
    summary: "Tres sesiones breves esta semana sostuvieron el ritmo.",
    evidence: [
      {
        id: "consistency-1",
        category: "observed",
        statement: "3 sesiones completadas en 5 días; mediana de 14 minutos.",
        source: "Eventos de aprendizaje",
        confidence: 0.99,
      },
    ],
  },
  {
    id: "retention",
    label: "Retención",
    score: 64,
    band: "developing",
    delta: 4,
    summary: "Recuerdas las ideas principales; falta una comprobación diferida.",
    evidence: [
      {
        id: "retention-1",
        category: "observed",
        statement: "3 de 4 conceptos recuperados correctamente después de 72 horas.",
        source: "Chequeo de retención",
        confidence: 0.95,
      },
    ],
  },
];

export const studioSignals: StudioSignal[] = [
  {
    id: "bottleneck",
    label: "Mayor oportunidad de refuerzo",
    value: "P.A.S. → aplicación",
    detail: "59% ya lo aplica en contexto; la práctica adaptativa se concentra en el siguiente 41%.",
    trend: "down",
  },
  {
    id: "mastery",
    label: "Progreso verificado",
    value: "+18%",
    detail: "Cambio de competencia demostrada por hora efectiva de aprendizaje.",
    trend: "up",
  },
  {
    id: "intervention",
    label: "Intervención útil",
    value: "Pregunta socrática",
    detail: "Mejoró el segundo intento en 63% de los casos observados.",
    trend: "up",
  },
  {
    id: "human",
    label: "Acompañamiento humano",
    value: "7 personas",
    detail: "Señales que justifican revisión del entrenador, evidencia adicional o un seguimiento.",
    trend: "steady",
  },
];

export const tutorQuickPrompts = [
  "Ayúdame a identificar un P.A.S.",
  "¿Por qué me recomiendas esta práctica?",
  "Dame un ejemplo de niveles lógicos",
];
