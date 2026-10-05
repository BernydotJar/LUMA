import { getLearningExperience, learningExperiences } from "./learning-content";

export type ClassTopology =
  | "concept-contrast-case-transfer"
  | "scenario-decision-feedback-replay"
  | "demonstrate-diagnose-remediate-recheck"
  | "observe-label-interpret-test";

export type EvidenceCategory = "observed" | "scored" | "self-reported";
export type TwinAuthority = "none" | "supporting" | "eligible";

export type DiagnosticChoice = {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
};

export type ClassContract = {
  experienceSlug: string;
  sourceIds: string[];
  capabilityId: string;
  objective: string;
  topology: ClassTopology;
  diagnostic: {
    prompt: string;
    choices: DiagnosticChoice[];
    correctRoute: "practice" | "simulation" | "transfer";
    remediationRoute: "review";
  };
  evidenceContract: {
    category: EvidenceCategory;
    label: string;
    twinAuthority: TwinAuthority;
  };
  rubric?: {
    id: string;
    criteria: string[];
  };
  remediation: {
    trigger: string;
    move: string;
  }[];
  transferPrompt: string;
  deferredRecheck: {
    delayHours: number;
    prompt: string;
  };
};

export type ClassQualityFinding = {
  code: string;
  message: string;
};

export type ClassQualityResult = {
  pass: boolean;
  findings: ClassQualityFinding[];
};

export const classContracts: ClassContract[] = [
  {
    experienceSlug: "congruencia-tres-canales",
    sourceIds: ["166Ucwvs8pilTOwGkrp5wRQ3lvpS4Z5l-"],
    capabilityId: "congruence",
    objective:
      "Alinear palabras, cuerpo y voz para comunicar una intención clara en una conversación real.",
    topology: "concept-contrast-case-transfer",
    diagnostic: {
      prompt: "¿Cuál ejemplo muestra mayor congruencia entre palabras, cuerpo y voz?",
      choices: [
        {
          id: "a",
          label: "Decir “me interesa” mientras miras el teléfono y respondes con tono cortante.",
          correct: false,
          feedback: "Las palabras y las señales no verbales apuntan en direcciones diferentes.",
        },
        {
          id: "b",
          label: "Pedir tiempo para revisar una propuesta con palabras, postura y tono que transmiten calma.",
          correct: true,
          feedback: "Los tres canales sostienen la misma intención.",
        },
        {
          id: "c",
          label: "Usar exactamente el mismo tono en todas las conversaciones.",
          correct: false,
          feedback: "Congruencia no significa rigidez; significa coherencia entre canales e intención.",
        },
      ],
      correctRoute: "practice",
      remediationRoute: "review",
    },
    evidenceContract: {
      category: "self-reported",
      label: "Reflexión sobre congruencia comunicativa",
      twinAuthority: "supporting",
    },
    remediation: [
      {
        trigger: "Confunde congruencia con uniformidad.",
        move: "Contrastar dos mensajes con las mismas palabras y señales no verbales distintas.",
      },
    ],
    transferPrompt:
      "Elige una conversación pendiente y describe qué señal verbal, corporal y vocal haría visible la misma intención.",
    deferredRecheck: {
      delayHours: 48,
      prompt: "Recuerda una conversación reciente: ¿los tres canales transmitieron la misma intención?",
    },
  },
  {
    experienceSlug: "calibracion-observar-antes-de-interpretar",
    sourceIds: ["166Ucwvs8pilTOwGkrp5wRQ3lvpS4Z5l-"],
    capabilityId: "calibration",
    objective:
      "Separar observaciones de interpretaciones antes de concluir qué significa la conducta de otra persona.",
    topology: "observe-label-interpret-test",
    diagnostic: {
      prompt: "¿Cuál frase es una observación y no una interpretación?",
      choices: [
        {
          id: "a",
          label: "Está molesto conmigo.",
          correct: false,
          feedback: "Eso asigna significado a la conducta.",
        },
        {
          id: "b",
          label: "Hizo una pausa de cinco segundos antes de responder y bajó el volumen de la voz.",
          correct: true,
          feedback: "Describe señales que podrían observarse sin decidir todavía qué significan.",
        },
        {
          id: "c",
          label: "Ya no confía en mi criterio.",
          correct: false,
          feedback: "Eso concluye un estado interno que necesita evidencia adicional.",
        },
      ],
      correctRoute: "practice",
      remediationRoute: "review",
    },
    evidenceContract: {
      category: "self-reported",
      label: "Distinción entre señal e interpretación",
      twinAuthority: "supporting",
    },
    remediation: [
      {
        trigger: "La respuesta atribuye intención o emoción como si fuera observable.",
        move: "Reescribir la frase usando únicamente gesto, postura, palabras, ritmo o tono.",
      },
    ],
    transferPrompt:
      "Toma una impresión reciente sobre otra persona y conviértela en tres observaciones y una pregunta comprobable.",
    deferredRecheck: {
      delayHours: 48,
      prompt: "Describe una señal que observaste hoy sin convertirla inmediatamente en una conclusión.",
    },
  },
  {
    experienceSlug: "rapport-sintonia-con-respeto",
    sourceIds: ["166Ucwvs8pilTOwGkrp5wRQ3lvpS4Z5l-"],
    capabilityId: "rapport",
    objective:
      "Ajustar una variable de comunicación para crear sintonía sin imitar mecánicamente a la otra persona.",
    topology: "scenario-decision-feedback-replay",
    diagnostic: {
      prompt: "¿Qué acción se acerca más a crear rapport con respeto?",
      choices: [
        {
          id: "a",
          label: "Copiar cada gesto de la otra persona para que se sienta comprendida.",
          correct: false,
          feedback: "La imitación mecánica puede romper autenticidad y confianza.",
        },
        {
          id: "b",
          label: "Ajustar discretamente el ritmo de la conversación y observar si aumenta la fluidez.",
          correct: true,
          feedback: "Acompasar una variable permite probar sintonía sin perder autenticidad.",
        },
        {
          id: "c",
          label: "Hablar siempre más rápido para mantener energía.",
          correct: false,
          feedback: "El ajuste depende del contexto y de la otra persona, no de una regla fija.",
        },
      ],
      correctRoute: "practice",
      remediationRoute: "review",
    },
    evidenceContract: {
      category: "self-reported",
      label: "Reflexión sobre sintonía interpersonal",
      twinAuthority: "supporting",
    },
    remediation: [
      {
        trigger: "Confunde rapport con imitación.",
        move: "Practicar un único ajuste de ritmo o pausa y comparar el efecto.",
      },
    ],
    transferPrompt:
      "Elige una conversación de esta semana y prueba un solo ajuste de ritmo, volumen o pausas; registra qué cambió.",
    deferredRecheck: {
      delayHours: 72,
      prompt: "¿Qué ajuste de comunicación facilitó una conversación real sin hacerte sentir artificial?",
    },
  },
  {
    experienceSlug: "pas-detectar-y-reformular",
    sourceIds: ["1OwHgWtDXC_AzkU31f6a7tuoHWHl0gv5V"],
    capabilityId: "pas",
    objective:
      "Distinguir acontecimiento, pensamiento automático y emoción, y formular una alternativa que pueda comprobarse.",
    topology: "demonstrate-diagnose-remediate-recheck",
    diagnostic: {
      prompt:
        "Después de recibir dos correcciones en una entrega, ¿cuál frase es el pensamiento automático y no el acontecimiento?",
      choices: [
        {
          id: "a",
          label: "La directora señaló dos errores de la propuesta.",
          correct: false,
          feedback: "Eso describe el acontecimiento observable.",
        },
        {
          id: "b",
          label: "Siempre arruino todo; seguro ya perdieron la confianza en mí.",
          correct: true,
          feedback: "La frase generaliza el evento y anticipa una consecuencia sin evidencia suficiente.",
        },
        {
          id: "c",
          label: "Siento vergüenza y miedo.",
          correct: false,
          feedback: "Eso describe la respuesta emocional.",
        },
      ],
      correctRoute: "simulation",
      remediationRoute: "review",
    },
    evidenceContract: {
      category: "scored",
      label: "Simulación P.A.S. con cobertura de criterios",
      twinAuthority: "eligible",
    },
    rubric: {
      id: "pas-v1",
      criteria: [
        "Distingue acontecimiento de interpretación.",
        "Relaciona pensamiento automático con la emoción.",
        "Formula una alternativa que conserva la evidencia disponible.",
      ],
    },
    remediation: [
      {
        trigger: "Confunde acontecimiento y pensamiento.",
        move: "Mostrar un par contrastado y pedir que marque qué parte sería observable por una cámara.",
      },
      {
        trigger: "La reformulación reemplaza un absoluto negativo por uno positivo.",
        move: "Exigir una alternativa comprobable mediante una acción o dato nuevo.",
      },
    ],
    transferPrompt:
      "Usa una situación real distinta al ejemplo y registra evento, pensamiento, emoción y una alternativa comprobable.",
    deferredRecheck: {
      delayHours: 48,
      prompt: "Ante una situación nueva, separa de nuevo acontecimiento, pensamiento y emoción sin consultar el ejemplo anterior.",
    },
  },
  {
    experienceSlug: "niveles-logicos-donde-intervenir",
    sourceIds: ["1OwHgWtDXC_AzkU31f6a7tuoHWHl0gv5V"],
    capabilityId: "logical-levels",
    objective:
      "Identificar el nivel de un obstáculo antes de elegir una intervención para un problema concreto.",
    topology: "concept-contrast-case-transfer",
    diagnostic: {
      prompt: "“Sé qué hacer, pero creo que no soy una persona capaz de hablar en público”. ¿Qué nivel domina el obstáculo?",
      choices: [
        {
          id: "a",
          label: "Entorno.",
          correct: false,
          feedback: "El enunciado no describe principalmente una condición externa.",
        },
        {
          id: "b",
          label: "Capacidad.",
          correct: false,
          feedback: "La persona afirma que sabe qué hacer; la dificultad aparece en cómo se define a sí misma.",
        },
        {
          id: "c",
          label: "Identidad.",
          correct: true,
          feedback: "La frase convierte el reto en una afirmación sobre quién es la persona.",
        },
      ],
      correctRoute: "practice",
      remediationRoute: "review",
    },
    evidenceContract: {
      category: "self-reported",
      label: "Hipótesis de nivel de intervención",
      twinAuthority: "supporting",
    },
    remediation: [
      {
        trigger: "Elige una intervención sin identificar el nivel.",
        move: "Separar hechos del entorno, conductas, capacidades, creencias/valores e identidad.",
      },
    ],
    transferPrompt:
      "Toma un reto actual, formula una hipótesis de nivel y propone una intervención que actúe únicamente en ese nivel.",
    deferredRecheck: {
      delayHours: 72,
      prompt: "Revisa un reto distinto: ¿el nivel que parecía obvio al principio sigue siendo el más útil?",
    },
  },
  {
    experienceSlug: "creencias-evidencia-e-interpretacion",
    sourceIds: ["1OwHgWtDXC_AzkU31f6a7tuoHWHl0gv5V"],
    capabilityId: "beliefs",
    objective:
      "Separar hechos de una regla interpretativa y reformular una creencia para que pueda convivir con toda la evidencia.",
    topology: "observe-label-interpret-test",
    diagnostic: {
      prompt: "¿Cuál frase funciona como una regla interpretativa y no como un hecho?",
      choices: [
        {
          id: "a",
          label: "Tres propuestas no recibieron respuesta esta semana.",
          correct: false,
          feedback: "Puede verificarse como un hecho concreto.",
        },
        {
          id: "b",
          label: "Si no responden rápido significa que mi trabajo no tiene valor.",
          correct: true,
          feedback: "Convierte un patrón limitado en una regla general de significado.",
        },
        {
          id: "c",
          label: "Enviaré un seguimiento el jueves.",
          correct: false,
          feedback: "Eso es una acción futura, no una creencia sobre el significado de los hechos.",
        },
      ],
      correctRoute: "practice",
      remediationRoute: "review",
    },
    evidenceContract: {
      category: "self-reported",
      label: "Revisión de evidencia e interpretación",
      twinAuthority: "supporting",
    },
    remediation: [
      {
        trigger: "La creencia se presenta como hecho.",
        move: "Pedir evidencia a favor, evidencia en contra y una formulación que incluya ambas.",
      },
    ],
    transferPrompt:
      "Elige una regla personal recurrente y reescríbela después de buscar dos hechos que la apoyan y dos que no encajan.",
    deferredRecheck: {
      delayHours: 72,
      prompt: "¿Qué evidencia nueva apareció desde que reformulaste la regla y cómo cambia tu interpretación?",
    },
  },
  {
    experienceSlug: "valores-identidad-y-eleccion",
    sourceIds: ["1OwHgWtDXC_AzkU31f6a7tuoHWHl0gv5V"],
    capabilityId: "values-identity",
    objective:
      "Convertir un valor elegido en un criterio observable para tomar una decisión real y actuar.",
    topology: "concept-contrast-case-transfer",
    diagnostic: {
      prompt: "Si dices que valoras la honestidad, ¿qué opción convierte el valor en un criterio observable?",
      choices: [
        {
          id: "a",
          label: "Repetir “soy una persona honesta”.",
          correct: false,
          feedback: "La etiqueta no define por sí sola una conducta observable.",
        },
        {
          id: "b",
          label: "Elegir la opción que me haga sentir mejor en el momento.",
          correct: false,
          feedback: "La sensación inmediata no necesariamente representa el valor elegido.",
        },
        {
          id: "c",
          label: "Comunicar un dato relevante aunque complique la conversación, explicando por qué importa.",
          correct: true,
          feedback: "El valor se traduce en una conducta que puede observarse.",
        },
      ],
      correctRoute: "practice",
      remediationRoute: "review",
    },
    evidenceContract: {
      category: "self-reported",
      label: "Reflexión sobre valor y conducta",
      twinAuthority: "supporting",
    },
    remediation: [
      {
        trigger: "El valor queda como etiqueta abstracta.",
        move: "Pedir una conducta concreta que una tercera persona pudiera observar.",
      },
    ],
    transferPrompt:
      "Toma una decisión pendiente y define una conducta observable que haría visible el valor que quieres expresar.",
    deferredRecheck: {
      delayHours: 72,
      prompt: "¿La acción que elegiste hizo visible el valor? Describe la conducta, no la etiqueta.",
    },
  },
];

export function getClassContract(slug: string) {
  return classContracts.find((contract) => contract.experienceSlug === slug);
}

export function validateClassContract(contract: ClassContract): ClassQualityResult {
  const findings: ClassQualityFinding[] = [];

  if (!getLearningExperience(contract.experienceSlug)) {
    findings.push({
      code: "UNKNOWN_EXPERIENCE",
      message: `No learning experience exists for ${contract.experienceSlug}.`,
    });
  }

  if (contract.sourceIds.length === 0) {
    findings.push({ code: "NO_SOURCE", message: "At least one source id is required." });
  }

  if (contract.objective.trim().length < 25) {
    findings.push({
      code: "WEAK_OBJECTIVE",
      message: "The class objective must describe a concrete capability.",
    });
  }

  if (contract.diagnostic.choices.length < 3) {
    findings.push({
      code: "WEAK_DIAGNOSTIC",
      message: "A class diagnostic needs at least three meaningful choices.",
    });
  }

  const correctChoices = contract.diagnostic.choices.filter((choice) => choice.correct);
  if (correctChoices.length !== 1) {
    findings.push({
      code: "AMBIGUOUS_DIAGNOSTIC",
      message: "The current micro-diagnostic contract requires exactly one correct choice.",
    });
  }

  if (contract.evidenceContract.category === "self-reported" && contract.evidenceContract.twinAuthority === "eligible") {
    findings.push({
      code: "SELF_REPORT_MASTERY",
      message: "Self-reported evidence cannot independently be eligible for mastery updates.",
    });
  }

  if (contract.evidenceContract.category === "scored" && (!contract.rubric || contract.rubric.criteria.length < 2)) {
    findings.push({
      code: "SCORED_WITHOUT_RUBRIC",
      message: "Scored evidence requires a rubric with observable criteria.",
    });
  }

  if (contract.remediation.length === 0) {
    findings.push({
      code: "NO_REMEDIATION",
      message: "Every class needs at least one remediation rule.",
    });
  }

  if (contract.transferPrompt.trim().length < 25) {
    findings.push({
      code: "NO_TRANSFER",
      message: "Every class needs a transfer task outside the teaching example.",
    });
  }

  if (contract.deferredRecheck.delayHours < 24) {
    findings.push({
      code: "RECHECK_TOO_SOON",
      message: "Deferred recheck must occur at least 24 hours after the initial class.",
    });
  }

  return { pass: findings.length === 0, findings };
}

export function validatePublishedClassCoverage(): ClassQualityResult {
  const findings: ClassQualityFinding[] = [];

  for (const experience of learningExperiences) {
    const contract = getClassContract(experience.slug);
    if (!contract) {
      findings.push({
        code: "MISSING_CLASS_CONTRACT",
        message: `Published experience ${experience.slug} has no class contract.`,
      });
      continue;
    }

    const result = validateClassContract(contract);
    findings.push(
      ...result.findings.map((finding) => ({
        ...finding,
        message: `${experience.slug}: ${finding.message}`,
      })),
    );
  }

  return { pass: findings.length === 0, findings };
}
