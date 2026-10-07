export type TutorConversationRole = "learner" | "tutor";

export type TutorConversationMessage = {
  role: TutorConversationRole;
  content: string;
};

export type TutorIntent =
  | "LEARNING"
  | "FRUSTRATION"
  | "AMBIGUOUS"
  | "PRIVACY"
  | "ACCOUNT_ACCESS"
  | "POLICY_EXCEPTION"
  | "HIGH_STAKES"
  | "OUT_OF_SCOPE";

export type TutorTrustStatus =
  | "GROUNDED"
  | "BLOCKED_CLAIM"
  | "INSUFFICIENT_CONTEXT"
  | "INSUFFICIENT_EVIDENCE"
  | "POLICY_BLOCKED"
  | "RETRIEVAL_UNAVAILABLE";

export type TutorControlOutcome =
  | "CONTINUE"
  | "RECOVERY"
  | "NEEDS_CLARIFICATION"
  | "POLICY_BLOCKED"
  | "HIGH_STAKES_ESCALATION"
  | "OUT_OF_SCOPE";

export type TutorControlResponse = {
  answer: string;
  learningMove: "ASK" | "RECOVER" | "ESCALATE";
  trust: {
    status: TutorTrustStatus;
    reason?: string;
  };
};

export type TutorControlDecision = {
  intent: TutorIntent;
  outcome: TutorControlOutcome;
  query: string;
  context: TutorConversationMessage[];
  resolvedFromContext: boolean;
  response?: TutorControlResponse;
};

const MAX_CONTEXT_MESSAGES = 8;
const MAX_CONTEXT_CONTENT = 1200;

const frustrationPhrases = [
  "esto no ayuda",
  "eso no ayuda",
  "ya te dije",
  "sigues diciendo lo mismo",
  "sigues repitiendo",
  "otra vez lo mismo",
  "no me entiendes",
  "no estas entendiendo",
  "no estás entendiendo",
  "you keep saying the same",
  "this is not helping",
  "you are not understanding",
];

const ambiguousPhrases = [
  "eso",
  "esto",
  "lo anterior",
  "lo de ayer",
  "lo que dijiste",
  "lo que me dijiste",
  "lo que dijiste antes",
  "la evidencia que te di",
  "esa evidencia",
  "aquello",
  "what you told me",
  "what you said",
  "what you said yesterday",
];

const highStakesKeywords = [
  "organo",
  "rinon",
  "pulmon",
  "higado",
  "corazon",
  "enfermedad",
  "enferman",
  "cura",
  "curar",
  "medico",
  "diagnostico",
  "tratamiento",
];

const domainSignals = [
  "pas",
  "sabote",
  "pensamiento",
  "nivel",
  "identidad",
  "creencia",
  "entorno",
  "emocion",
  "ira",
  "miedo",
  "triste",
  "pnl",
  "rapport",
  "comunicacion",
  "aprendiz",
  "aprendizaje",
  "curso",
  "modulo",
  "ejercicio",
  "practica",
  "belief",
  "emotion",
  "learning",
];

const outOfScopeSignals = [
  "clima",
  "weather",
  "bitcoin",
  "crypto",
  "criptomoneda",
  "receta",
  "recipe",
  "futbol",
  "football",
  "soccer",
  "eleccion",
  "election",
  "hotel",
  "vuelo",
  "flight",
  "restaurante",
  "restaurant",
  "codigo python",
  "python code",
  "javascript",
  "typescript",
  "programacion",
  "programming",
];

const commerceSignals = [
  "reembolso",
  "refund",
  "devolucion",
  "suscripcion",
  "subscription",
  "cobro",
  "charge",
  "factura",
  "invoice",
  "cancelar compra",
  "cancel purchase",
];

const stopWords = new Set([
  "a",
  "al",
  "algo",
  "and",
  "ante",
  "como",
  "con",
  "de",
  "del",
  "dime",
  "el",
  "en",
  "es",
  "esa",
  "ese",
  "eso",
  "esta",
  "este",
  "esto",
  "explica",
  "explicame",
  "for",
  "give",
  "la",
  "las",
  "lo",
  "los",
  "me",
  "mi",
  "of",
  "para",
  "por",
  "que",
  "quiero",
  "sobre",
  "the",
  "to",
  "un",
  "una",
  "what",
  "you",
]);

export function normalizeTutorText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/\b([a-z])\.\s*([a-z])\.\s*([a-z])\.?/g, "$1$2$3")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeConversation(
  value: unknown,
): TutorConversationMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is { role: TutorConversationRole; content: string } =>
        Boolean(item) &&
        typeof item === "object" &&
        ((item as { role?: unknown }).role === "learner" ||
          (item as { role?: unknown }).role === "tutor") &&
        typeof (item as { content?: unknown }).content === "string",
    )
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_CONTEXT_CONTENT),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_CONTEXT_MESSAGES);
}

function includesAny(normalized: string, values: string[]) {
  return values.some((value) =>
    normalized.includes(normalizeTutorText(value)),
  );
}

function hasPrivacyAccessRequest(normalized: string) {
  const sensitiveObject =
    /\b(twin|learning twin|gemelo|progreso|progress|perfil|profile|datos|data|evidencia|evidence)\b/.test(
      normalized,
    );
  const anotherPerson =
    /\b(otro|otra|otros|otras|another|other)\s+(learner|alumno|alumna|aprendiz|participante|coachee|usuario|user)\b/.test(
      normalized,
    ) ||
    /\b(de|of)\s+(otro|otra|another|other)\s+(learner|alumno|alumna|aprendiz|participante|coachee|usuario|user)\b/.test(
      normalized,
    );
  const accessVerb =
    /\b(muestra|mostrar|ensena|dame|ver|accede|acceder|revela|revelar|comparte|compartir|solicita|solicitar|revisa|revisar|necesito|requiere|requiero|informe|analisis|metricas|show|give|view|see|provide|inspect|read|access|reveal|share|export|download|request|review|need|require|report|analysis|metrics|obtain|get)\b/.test(
      normalized,
    );

  return sensitiveObject && anotherPerson && accessVerb;
}

function hasAccountAccessRequest(normalized: string) {
  return (
    /\b(hazme|convierteme|cambiame|dame|otorgame|make me|give me|change my|grant me)\b.{0,48}\b(admin|administrador|coach|director|role|rol|access|acceso|permission|permiso)\b/.test(
      normalized,
    ) ||
    /\b(cambia|change|override)\b.{0,40}\b(role|rol|permission|permiso|access|acceso)\b/.test(
      normalized,
    )
  );
}

function hasPolicyExceptionRequest(normalized: string) {
  return /\b(make an exception|haz una excepcion|hacer una excepcion|bypass|override|ignore permissions|ignore permission|ignore access controls|skip permissions|ignora los permisos|ignora permisos|omite la politica|omite politica|sin permiso|without permission|saltate los controles|salta los controles)\b/.test(
    normalized,
  );
}

function hasContradictoryExactDemand(normalized: string) {
  const exact = /\b(exact|exacta|exacto|definitiv[ao])\b/.test(normalized);
  const noAssumption =
    /\b(don't assume|do not assume|no asumas|sin asumir)\b/.test(normalized);
  const noQuestion =
    /\b(don't ask|do not ask|no preguntes|sin preguntar)\b/.test(normalized);
  return exact && noAssumption && noQuestion;
}

function hasStandaloneAmbiguousReference(normalized: string) {
  if (!includesAny(normalized, ambiguousPhrases)) return false;

  const informativeTokens = tokenize(normalized).filter(
    (token) => !stopWords.has(token),
  );
  return informativeTokens.length <= 3;
}

function requiresUnavailableHistoricalContext(normalized: string) {
  return /\b(ayer|yesterday|anoche|last night|semana pasada|last week)\b/.test(
    normalized,
  );
}

function findReferent(context: TutorConversationMessage[]) {
  return [...context]
    .reverse()
    .find((item) => item.content.trim().length >= 12);
}

function compactReference(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= 240 ? clean : `${clean.slice(0, 237)}…`;
}

function frustrationCount(context: TutorConversationMessage[]) {
  return context.filter(
    (item) =>
      item.role === "learner" &&
      includesAny(normalizeTutorText(item.content), frustrationPhrases),
  ).length;
}

function isPolicyIntent(intent: TutorIntent) {
  return (
    intent === "PRIVACY" ||
    intent === "ACCOUNT_ACCESS" ||
    intent === "POLICY_EXCEPTION"
  );
}

function policyAttemptCount(context: TutorConversationMessage[]) {
  return context.filter(
    (item) =>
      item.role === "learner" &&
      isPolicyIntent(classifyTutorIntent(item.content)),
  ).length;
}

function buildPolicyBoundaryResponse(context: TutorConversationMessage[]) {
  const attempt = Math.min(policyAttemptCount(context), 3);

  if (attempt === 0) {
    return "No puedo exponer datos de otro participante, cambiar roles ni saltar controles de acceso desde el tutor. Tampoco voy a asumir autoridad por una afirmación del usuario. Usa únicamente las opciones de acceso que el producto pueda verificar y autorizar.";
  }

  if (attempt === 1) {
    return "La excepción solicitada no cambia el límite: el tutor no puede revelar datos de otra persona ni conceder privilegios que no pueda verificar. Solo puede continuar con acceso ya autorizado por el producto.";
  }

  if (attempt === 2) {
    return "Ignorar permisos no es una ruta válida. Mantengo el límite de privacidad y autorización; no voy a mostrar Twin, progreso ni perfil de otra persona desde este tutor.";
  }

  return "Repetir la solicitud o afirmar autoridad ejecutiva no crea autorización verificable. El tutor seguirá sin exponer datos ajenos ni modificar roles o permisos.";
}

function ambiguityAttemptCount(context: TutorConversationMessage[]) {
  return context.filter(
    (item) =>
      item.role === "learner" &&
      classifyTutorIntent(item.content) === "AMBIGUOUS",
  ).length;
}

function buildAmbiguityResponse(
  normalized: string,
  context: TutorConversationMessage[],
) {
  if (hasContradictoryExactDemand(normalized)) {
    return "No puedo dar una respuesta exacta y, al mismo tiempo, no asumir nada ni pedir el dato que falta. Necesito al menos el contexto concreto al que quieres que responda.";
  }

  const attempt = Math.min(ambiguityAttemptCount(context), 3);
  if (attempt === 0) {
    return "No tengo contexto suficiente para saber a qué te refieres sin inventarlo. ¿Qué tema, explicación o evidencia concreta quieres retomar?";
  }

  if (attempt === 1) {
    return "La referencia sigue apuntando a un contexto que no está disponible en estos turnos. Indica el tema o pega la evidencia concreta y continúo desde ahí.";
  }

  if (attempt === 2) {
    return "No voy a atribuirme memoria de una conversación o evidencia que no está disponible. Para continuar, necesito que identifiques el contenido específico que quieres recuperar.";
  }

  return "La información histórica sigue fuera del contexto disponible. Pega el fragmento o nombra el tema exacto; sin eso, mantener la incertidumbre es más seguro que reconstruirlo.";
}

function buildRecoveryResponse(context: TutorConversationMessage[]) {
  const previousLearner = [...context]
    .reverse()
    .find((item) => item.role === "learner");
  const subject = previousLearner
    ? ` sobre «${compactReference(previousLearner.content)}»`
    : "";
  const attempt = frustrationCount(context);

  if (attempt === 0) {
    return `Entiendo: repetir la misma explicación no está resolviendo lo que necesitas${subject}. Voy a cambiar de estrategia. ¿Qué necesitas ahora: un ejemplo concreto, una aplicación a tu caso o una explicación paso a paso?`;
  }

  if (attempt === 1) {
    return `No voy a repetir la respuesta anterior${subject}. Para corregir el rumbo, ¿cuál es el punto exacto que sigue sin encajar?`;
  }

  if (attempt === 2) {
    return "Seguimos sin resolverlo y repetir contenido no aporta. ¿Quieres que lo reconstruya desde un ejemplo concreto o que identifiquemos primero la premisa que está fallando?";
  }

  return "La explicación anterior sigue sin servirte, así que no la repetiré. Dame una situación concreta de una sola línea y trabajaré únicamente desde ese caso.";
}

function tokenize(value: string) {
  return normalizeTutorText(value)
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function isRagEvidenceRelevant(
  query: string,
  evidence: {
    text: string;
    title?: string;
    module?: string;
  },
) {
  const queryTokens = new Set(
    tokenize(query).filter(
      (token) => token.length >= 4 && !stopWords.has(token),
    ),
  );

  if (queryTokens.size === 0) return false;

  const evidenceTokens = new Set(
    tokenize(
      [evidence.text, evidence.title ?? "", evidence.module ?? ""].join(" "),
    ),
  );

  return [...queryTokens].some((token) => evidenceTokens.has(token));
}

export function classifyTutorIntent(
  message: string,
  context: TutorConversationMessage[] = [],
): TutorIntent {
  const normalized = normalizeTutorText(message);

  if (hasPrivacyAccessRequest(normalized)) return "PRIVACY";
  if (hasAccountAccessRequest(normalized)) return "ACCOUNT_ACCESS";
  if (hasPolicyExceptionRequest(normalized)) return "POLICY_EXCEPTION";
  if (includesAny(normalized, frustrationPhrases)) return "FRUSTRATION";
  if (
    hasContradictoryExactDemand(normalized) ||
    requiresUnavailableHistoricalContext(normalized) ||
    hasStandaloneAmbiguousReference(normalized)
  ) {
    return "AMBIGUOUS";
  }
  if (includesAny(normalized, highStakesKeywords)) return "HIGH_STAKES";

  const commerce = includesAny(normalized, commerceSignals);
  const explicitOutside = includesAny(normalized, outOfScopeSignals);
  const domain = includesAny(normalized, domainSignals);

  if ((commerce || explicitOutside) && !domain) return "OUT_OF_SCOPE";

  void context;
  return "LEARNING";
}

export function evaluateTutorControl(input: {
  message: string;
  messages?: unknown;
}): TutorControlDecision {
  const context = normalizeConversation(input.messages);
  const intent = classifyTutorIntent(input.message, context);
  const normalized = normalizeTutorText(input.message);

  if (isPolicyIntent(intent)) {
    return {
      intent,
      outcome: "POLICY_BLOCKED",
      query: input.message,
      context,
      resolvedFromContext: false,
      response: {
        answer: buildPolicyBoundaryResponse(context),
        learningMove: "ESCALATE",
        trust: {
          status: "POLICY_BLOCKED",
          reason:
            "La solicitud requiere datos o privilegios que el tutor no puede verificar ni autorizar.",
        },
      },
    };
  }

  if (intent === "FRUSTRATION") {
    return {
      intent,
      outcome: "RECOVERY",
      query: input.message,
      context,
      resolvedFromContext: false,
      response: {
        answer: buildRecoveryResponse(context),
        learningMove: "RECOVER",
        trust: {
          status: "INSUFFICIENT_CONTEXT",
          reason:
            "Se requiere precisar la necesidad no resuelta antes de continuar con otra estrategia.",
        },
      },
    };
  }

  if (intent === "AMBIGUOUS") {
    const referent =
      hasStandaloneAmbiguousReference(normalized) &&
      !requiresUnavailableHistoricalContext(normalized)
        ? findReferent(context)
        : undefined;

    if (referent) {
      return {
        intent,
        outcome: "CONTINUE",
        query: `${referent.content}\nSeguimiento del learner: ${input.message}`,
        context,
        resolvedFromContext: true,
      };
    }

    return {
      intent,
      outcome: "NEEDS_CLARIFICATION",
      query: input.message,
      context,
      resolvedFromContext: false,
      response: {
        answer: buildAmbiguityResponse(normalized, context),
        learningMove: "ASK",
        trust: {
          status: "INSUFFICIENT_CONTEXT",
          reason:
            "La referencia no puede resolverse con los turnos recientes disponibles.",
        },
      },
    };
  }

  if (intent === "HIGH_STAKES") {
    return {
      intent,
      outcome: "HIGH_STAKES_ESCALATION",
      query: input.message,
      context,
      resolvedFromContext: false,
    };
  }

  if (intent === "OUT_OF_SCOPE") {
    return {
      intent,
      outcome: "OUT_OF_SCOPE",
      query: input.message,
      context,
      resolvedFromContext: false,
      response: {
        answer:
          "Esa solicitud no pertenece al alcance de este tutor de aprendizaje, y no voy a convertirla en una respuesta curricular no relacionada. Si necesitas continuar aquí, conecta la pregunta con el contenido o práctica de aprendizaje que quieres trabajar.",
        learningMove: "ASK",
        trust: {
          status: "INSUFFICIENT_CONTEXT",
          reason:
            "La intención actual no corresponde a una interacción de aprendizaje soportada por este tutor.",
        },
      },
    };
  }

  return {
    intent,
    outcome: "CONTINUE",
    query: input.message,
    context,
    resolvedFromContext: false,
  };
}
