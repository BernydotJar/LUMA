import type { SemanticObjectVariant } from "@/lib/experience-themes";

export type LearningExperience = {
  id: string;
  slug: string;
  category: string;
  title: string;
  shortTitle: string;
  capability: string;
  summary: string;
  minutes: number;
  sourceId: string;
  sourceLabel: string;
  sourceUnit: string;
  semanticObject: SemanticObjectVariant;
  keyIdeas: string[];
  practiceTitle: string;
  scenario: string;
  practiceSteps: string[];
  reflectionPrompt: string;
  evidenceLabel: string;
  scoredSimulationHref?: string;
};

const moduleTwo = {
  id: "166Ucwvs8pilTOwGkrp5wRQ3lvpS4Z5l-",
  label: "Practitioner · Comunicación Emocional",
};

const moduleThree = {
  id: "1OwHgWtDXC_AzkU31f6a7tuoHWHl0gv5V",
  label: "Practitioner · Redescubriendo y transformando tu poder",
};

export const learningExperiences: LearningExperience[] = [
  {
    id: "congruence",
    slug: "congruencia-tres-canales",
    category: "Comunicación",
    title: "Congruencia: tres canales, un mensaje",
    shortTitle: "Congruencia",
    capability: "Alinear palabras, cuerpo y voz para comunicar con claridad.",
    summary: "Observa si lo verbal, lo no verbal y lo paraverbal están reforzando el mismo mensaje.",
    minutes: 8,
    sourceId: moduleTwo.id,
    sourceLabel: moduleTwo.label,
    sourceUnit: "Comunicación global · congruencia",
    semanticObject: "axis",
    keyIdeas: [
      "El material distingue comunicación verbal, no verbal y paraverbal.",
      "Congruencia significa que esos canales avanzan en la misma dirección.",
      "Una discrepancia entre lo que dices y cómo lo expresas puede cambiar cómo se recibe el mensaje.",
    ],
    practiceTitle: "Repite el mismo mensaje con intención",
    scenario: "Necesitas pedir a alguien de tu equipo que corrija una entrega sin convertir la conversación en una confrontación.",
    practiceSteps: [
      "Escribe en una frase lo que realmente necesitas comunicar.",
      "Decide qué postura, expresión y distancia acompañan ese mensaje.",
      "Lee la frase en voz alta y ajusta tono, velocidad, pausas y volumen.",
      "Comprueba si los tres canales transmiten la misma intención.",
    ],
    reflectionPrompt: "¿Qué cambió en tu mensaje cuando alineaste las palabras, el cuerpo y la voz? Describe una señal concreta.",
    evidenceLabel: "Reflexión sobre congruencia comunicativa",
  },
  {
    id: "calibration",
    slug: "calibracion-observar-antes-de-interpretar",
    category: "Observación",
    title: "Calibración: observar antes de interpretar",
    shortTitle: "Calibración",
    capability: "Separar lo observable de la interpretación antes de concluir.",
    summary: "Entrena una mirada más precisa: primero registra señales; después construye una interpretación.",
    minutes: 7,
    sourceId: moduleTwo.id,
    sourceLabel: moduleTwo.label,
    sourceUnit: "Comunicación global · calibración",
    semanticObject: "lens",
    keyIdeas: [
      "El material presenta calibrar como observar de forma sistemática.",
      "La práctica pide diferenciar lo que ves u oyes de lo que crees que significa.",
      "Buscar patrones requiere más de una señal y comparación, no una conclusión instantánea.",
    ],
    practiceTitle: "Convierte una impresión en observaciones",
    scenario: "Piensas: “mi interlocutor está incómodo conmigo”. Antes de actuar, necesitas revisar de qué señales reales nace esa impresión.",
    practiceSteps: [
      "Escribe tu interpretación inicial en una frase.",
      "Anota tres cosas observables: gesto, postura, palabras, ritmo o tono.",
      "Marca qué dato apoya tu interpretación y cuál podría tener otra explicación.",
      "Formula una pregunta que te permita obtener evidencia adicional.",
    ],
    reflectionPrompt: "¿Qué parte de tu conclusión inicial era observación y qué parte era interpretación?",
    evidenceLabel: "Distinción entre señal e interpretación",
  },
  {
    id: "rapport",
    slug: "rapport-sintonia-con-respeto",
    category: "Relación",
    title: "Rapport: crear sintonía con respeto",
    shortTitle: "Rapport",
    capability: "Ajustar tu forma de comunicar sin convertir la conexión en imitación.",
    summary: "Explora ritmo, lenguaje y presencia para encontrarte con la otra persona desde su contexto.",
    minutes: 9,
    sourceId: moduleTwo.id,
    sourceLabel: moduleTwo.label,
    sourceUnit: "Comunicación global · sincronización y rapport",
    semanticObject: "bridge",
    keyIdeas: [
      "El material relaciona rapport con sintonía y confianza en la interacción.",
      "Acompasar no significa copiar todos los movimientos de la otra persona.",
      "La conexión funciona mejor cuando el objetivo de la otra persona también importa.",
    ],
    practiceTitle: "Ajusta una sola variable",
    scenario: "Hablas con alguien cuyo ritmo es mucho más pausado que el tuyo. Tu tendencia es acelerar la conversación.",
    practiceSteps: [
      "Escoge una sola variable: velocidad, volumen, vocabulario o cantidad de pausa.",
      "Ajusta esa variable de manera discreta durante unos minutos.",
      "Observa si la conversación se vuelve más fluida sin dejar de sentirte auténtico.",
      "Vuelve a tu ritmo normal y compara el efecto.",
    ],
    reflectionPrompt: "¿Qué ajuste facilitó la conexión y cómo evitaste convertirlo en una imitación mecánica?",
    evidenceLabel: "Reflexión sobre sintonía interpersonal",
  },
  {
    id: "pas",
    slug: "pas-detectar-y-reformular",
    category: "Autoconocimiento",
    title: "P.A.S.: detectar y reformular",
    shortTitle: "P.A.S.",
    capability: "Distinguir acontecimiento, pensamiento y emoción antes de responder.",
    summary: "Identifica el pensamiento automático que aparece entre lo que ocurre y la respuesta que das.",
    minutes: 12,
    sourceId: moduleThree.id,
    sourceLabel: moduleThree.label,
    sourceUnit: "Comunicación emocional · P.A.S.",
    semanticObject: "prism",
    keyIdeas: [
      "El material describe los P.A.S. como pensamientos automáticos, rápidos y rígidos.",
      "Los absolutos pueden ser una señal útil para detenerse y revisar la interpretación.",
      "Reformular significa construir una alternativa que conserve la evidencia disponible.",
    ],
    practiceTitle: "Encuentra el pensamiento entre el evento y la emoción",
    scenario: "Recibes una observación crítica sobre un trabajo que te importa y notas una reacción emocional inmediata.",
    practiceSteps: [
      "Describe sólo el acontecimiento observable.",
      "Escribe el primer pensamiento que apareció.",
      "Nombra la emoción que ese pensamiento hace comprensible.",
      "Formula una alternativa que puedas comprobar con una acción o dato nuevo.",
    ],
    reflectionPrompt: "¿Qué palabra o supuesto convirtió el acontecimiento en una conclusión más grande de lo que la evidencia permitía?",
    evidenceLabel: "Práctica de distinción y reformulación",
    scoredSimulationHref: "/learn/session/pas",
  },
  {
    id: "logical-levels",
    slug: "niveles-logicos-donde-intervenir",
    category: "Cambio",
    title: "Niveles lógicos: elegir dónde intervenir",
    shortTitle: "Niveles lógicos",
    capability: "Distinguir si un reto pide cambiar entorno, conducta, capacidad, creencia, valor o identidad.",
    summary: "Antes de buscar una solución, identifica en qué nivel está realmente el obstáculo.",
    minutes: 10,
    sourceId: moduleThree.id,
    sourceLabel: moduleThree.label,
    sourceUnit: "Niveles lógicos",
    semanticObject: "strata",
    keyIdeas: [
      "El material organiza el cambio en niveles como entorno, conducta, capacidades, creencias/valores e identidad.",
      "Problemas parecidos pueden requerir intervenciones distintas según el nivel.",
      "Cambiar de nivel evita insistir en una solución que no corresponde al problema.",
    ],
    practiceTitle: "Ubica el obstáculo antes de actuar",
    scenario: "Quieres hablar mejor en público, pero no sabes si necesitas practicar una técnica, cambiar una creencia o modificar el contexto.",
    practiceSteps: [
      "Describe el reto sin explicar todavía la causa.",
      "Pregunta: ¿es entorno, conducta, capacidad, creencia/valor o identidad?",
      "Elige el nivel con la evidencia más concreta.",
      "Propón una intervención que corresponda sólo a ese nivel.",
    ],
    reflectionPrompt: "¿En qué nivel estabas intentando resolver el problema y en cuál parece estar realmente?",
    evidenceLabel: "Hipótesis de nivel de intervención",
  },
  {
    id: "beliefs",
    slug: "creencias-evidencia-e-interpretacion",
    category: "Perspectiva",
    title: "Creencias: separar evidencia e interpretación",
    shortTitle: "Creencias",
    capability: "Reconocer cuándo una interpretación empieza a funcionar como filtro.",
    summary: "Revisa una conclusión repetida y vuelve a mirar qué hechos la sostienen y qué hechos la contradicen.",
    minutes: 10,
    sourceId: moduleThree.id,
    sourceLabel: moduleThree.label,
    sourceUnit: "Creencias y mapas mentales",
    semanticObject: "lens",
    keyIdeas: [
      "El material trabaja las creencias como parte del modo en que organizamos e interpretamos la experiencia.",
      "Un mapa mental es una representación; no equivale a la totalidad del territorio.",
      "Buscar evidencia a favor y en contra ayuda a distinguir una regla útil de una conclusión rígida.",
    ],
    practiceTitle: "Pon a prueba una regla personal",
    scenario: "Hay una frase que repites sobre ti o sobre otras personas y que influye en tus decisiones.",
    practiceSteps: [
      "Escribe la regla exactamente como aparece en tu mente.",
      "Anota dos hechos que parecen apoyarla.",
      "Anota dos hechos que no encajan con ella.",
      "Reescribe la regla para que pueda convivir con toda la evidencia disponible.",
    ],
    reflectionPrompt: "¿Qué parte de la creencia era un hecho y qué parte era una regla que estabas aplicando a muchos casos?",
    evidenceLabel: "Revisión de evidencia e interpretación",
  },
  {
    id: "values-identity",
    slug: "valores-identidad-y-eleccion",
    category: "Dirección",
    title: "Valores e identidad: alinear lo que importa con cómo actúas",
    shortTitle: "Valores e identidad",
    capability: "Relacionar una decisión concreta con el valor que quieres expresar y la persona que quieres ser.",
    summary: "Convierte valores e identidad en criterios observables para una decisión real.",
    minutes: 11,
    sourceId: moduleThree.id,
    sourceLabel: moduleThree.label,
    sourceUnit: "Valores e identidad",
    semanticObject: "mirror",
    keyIdeas: [
      "El material ubica valores e identidad en niveles profundos del cambio personal.",
      "Un valor se vuelve útil cuando puede orientar una elección concreta.",
      "La identidad puede explorarse como una dirección de acción, no como una etiqueta fija.",
    ],
    practiceTitle: "Haz observable un valor",
    scenario: "Tienes una decisión pendiente y dos alternativas razonables. Quieres elegir de una manera que se parezca a la persona que quieres ser.",
    practiceSteps: [
      "Nombra el valor que quieres expresar en esta decisión.",
      "Describe una conducta observable que represente ese valor.",
      "Compara las dos alternativas usando esa conducta como criterio.",
      "Elige una acción pequeña que puedas realizar en las próximas 24 horas.",
    ],
    reflectionPrompt: "¿Qué acción concreta hace visible el valor que elegiste, sin depender de una etiqueta sobre quién eres?",
    evidenceLabel: "Reflexión sobre valor y conducta",
  },
];

export const featuredLearningExperiences = [
  learningExperiences[0],
  learningExperiences[1],
  learningExperiences[4],
];

export function getLearningExperience(slug: string) {
  return learningExperiences.find((experience) => experience.slug === slug);
}
