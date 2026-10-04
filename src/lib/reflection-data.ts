import type { KnowledgeArtifact, ReflectionSourceRef } from "@/types/reflection";

export const moduleThreePdf = {
  id: "1OwHgWtDXC_AzkU31f6a7tuoHWHl0gv5V",
  label: "Módulo 3 · Redescubriendo y transformando tu poder",
  url: "https://drive.google.com/file/d/1OwHgWtDXC_AzkU31f6a7tuoHWHl0gv5V/view",
};

export const reflectionSources: Record<string, ReflectionSourceRef> = {
  emotionalLoop: {
    sourceId: "m3-pdf-emotional-loop",
    sourceLabel: moduleThreePdf.label,
    url: moduleThreePdf.url,
    locator: "págs. 5–9 · Comunicación emocional",
    statement:
      "El material relaciona pensamiento, emoción, acción y objetivo, y propone identificar el pensamiento que precede a la emoción.",
    rightsStatus: "approved",
  },
  pas: {
    sourceId: "m3-pdf-pas",
    sourceLabel: moduleThreePdf.label,
    url: moduleThreePdf.url,
    locator: "págs. 9–10 · P.A.S.",
    statement:
      "Los P.A.S. se describen como pensamientos automáticos, veloces, rígidos y modificables, a menudo expresados con absolutos.",
    rightsStatus: "approved",
  },
  intervention: {
    sourceId: "m3-pdf-intervention",
    sourceLabel: moduleThreePdf.label,
    url: moduleThreePdf.url,
    locator: "págs. 10–13 · Dónde cambiar / Niveles lógicos",
    statement:
      "El material distingue comportamiento, proceso interior y estado interno, y organiza posibles niveles de intervención.",
    rightsStatus: "approved",
  },
  healthClaim: {
    sourceId: "m3-pdf-health-claim",
    sourceLabel: moduleThreePdf.label,
    url: moduleThreePdf.url,
    locator: "págs. 7–8 · afirmaciones de salud",
    statement:
      "El documento relaciona la gestión emocional con órganos y enfermedad física sin aportar evidencia independiente en el corpus.",
    rightsStatus: "approved",
  },
};

export const knowledgeArtifacts: KnowledgeArtifact[] = [
  {
    id: "raw-emotional-loop",
    corpusId: "practitioner-module-3",
    kind: "raw-source",
    title: "Pensamiento, emoción, acción y objetivo",
    body:
      "Fuente aprobada que presenta la secuencia pensamiento → emoción → acción → resultado como marco de trabajo del módulo.",
    sourceArtifactIds: [moduleThreePdf.id],
    sourceRefs: [reflectionSources.emotionalLoop],
    status: "approved",
    confidence: 1,
    highStakes: false,
    learnerVisible: true,
    tags: ["pensamiento", "emocion", "accion", "objetivo"],
    pipelineVersion: "source-extraction-v1",
    createdAt: "2026-10-04T05:00:00.000Z",
  },
  {
    id: "raw-pas",
    corpusId: "practitioner-module-3",
    kind: "raw-source",
    title: "Pensamientos Automáticos Saboteadores",
    body:
      "Fuente aprobada sobre características de los P.A.S., su lenguaje absoluto, su relación con emociones y conductas, y su posibilidad de modificación.",
    sourceArtifactIds: [moduleThreePdf.id],
    sourceRefs: [reflectionSources.pas],
    status: "approved",
    confidence: 1,
    highStakes: false,
    learnerVisible: true,
    tags: ["pas", "pensamiento", "saboteador", "absolutos"],
    pipelineVersion: "source-extraction-v1",
    createdAt: "2026-10-04T05:01:00.000Z",
  },
  {
    id: "raw-intervention-levels",
    corpusId: "practitioner-module-3",
    kind: "raw-source",
    title: "Dónde cambiar y niveles lógicos",
    body:
      "Fuente aprobada que organiza el cambio en entorno, conducta, capacidades, creencias y valores, identidad y misión.",
    sourceArtifactIds: [moduleThreePdf.id],
    sourceRefs: [reflectionSources.intervention],
    status: "approved",
    confidence: 1,
    highStakes: false,
    learnerVisible: true,
    tags: ["intervencion", "niveles", "creencias", "identidad"],
    pipelineVersion: "source-extraction-v1",
    createdAt: "2026-10-04T05:02:00.000Z",
  },
  {
    id: "reflection-pas-loop",
    corpusId: "practitioner-module-3",
    kind: "reflection",
    title: "El P.A.S. vuelve practicable la cadena emocional",
    body:
      "La sección de P.A.S. convierte el marco general pensamiento–emoción–acción en un punto concreto de observación y práctica.",
    novelty:
      "No introduce una teoría nueva: explicita el mecanismo operativo que conecta dos secciones del documento.",
    connection:
      "La cadena emocional explica por qué importa observar el pensamiento; P.A.S. aporta señales lingüísticas para detectarlo.",
    gap:
      "Falta una rúbrica que distinga reconocer un absoluto de transferir el concepto a una situación real ambigua.",
    sourceArtifactIds: ["raw-emotional-loop", "raw-pas"],
    sourceRefs: [reflectionSources.emotionalLoop, reflectionSources.pas],
    status: "approved",
    confidence: 0.91,
    highStakes: false,
    learnerVisible: true,
    tags: ["pas", "pensamiento", "emocion", "transferencia"],
    pipelineVersion: "curriculum-reflection-v1",
    promptVersion: "module-3-reflection-2026-10-04",
    createdAt: "2026-10-04T05:10:00.000Z",
  },
  {
    id: "reflection-intervention-map",
    corpusId: "practitioner-module-3",
    kind: "reflection",
    title: "De detectar el patrón a elegir dónde intervenir",
    body:
      "P.A.S. ayuda a observar el patrón; los niveles lógicos proponen dónde actuar. Juntos forman una ruta de diagnóstico pedagógico.",
    novelty:
      "Hace visible una progresión curricular que no aparece nombrada como tal en el índice.",
    connection:
      "Conecta la detección del pensamiento con una decisión posterior sobre conducta, capacidad, creencia o identidad.",
    gap:
      "El material no ofrece todavía una regla verificable para seleccionar el nivel correcto en casos con evidencia contradictoria.",
    sourceArtifactIds: ["raw-pas", "raw-intervention-levels"],
    sourceRefs: [reflectionSources.pas, reflectionSources.intervention],
    status: "in-review",
    confidence: 0.82,
    highStakes: false,
    learnerVisible: false,
    tags: ["pas", "niveles", "intervencion", "diagnostico"],
    pipelineVersion: "curriculum-reflection-v1",
    promptVersion: "module-3-reflection-2026-10-04",
    createdAt: "2026-10-04T05:11:00.000Z",
  },
  {
    id: "finding-health-claims",
    corpusId: "practitioner-module-3",
    kind: "quality-finding",
    title: "Afirmaciones de salud requieren evidencia independiente",
    body:
      "El corpus contiene afirmaciones que vinculan emociones, órganos y enfermedad. LUMA las conserva como texto de la fuente, pero bloquea su presentación como hecho médico.",
    novelty:
      "Clasificación automática de una afirmación de alto impacto para revisión experta.",
    connection:
      "El hallazgo afecta tutor, evaluaciones, resúmenes y cualquier contenido generado desde estas páginas.",
    gap:
      "No existe evidencia clínica independiente ni aprobación de un profesional cualificado dentro del corpus suministrado.",
    sourceArtifactIds: [moduleThreePdf.id],
    sourceRefs: [reflectionSources.healthClaim],
    status: "blocked",
    confidence: 0.98,
    highStakes: true,
    learnerVisible: false,
    tags: ["salud", "riesgo", "claim", "revision"],
    pipelineVersion: "quality-policy-v1",
    promptVersion: "high-stakes-claim-review-2026-10-04",
    createdAt: "2026-10-04T05:12:00.000Z",
  },
  {
    id: "summary-systemic-change",
    corpusId: "practitioner-module-3",
    kind: "summary",
    title: "Mapa sistémico del cambio personal",
    body:
      "La lectura integrada propone observar el pensamiento, reconocer la respuesta emocional, seleccionar un nivel de intervención y ensayar una alternativa verificable.",
    novelty:
      "Resume una estructura distribuida entre tres secciones sin reemplazar la secuencia original del curso.",
    connection:
      "Une comunicación emocional, P.A.S. y niveles lógicos en una ruta utilizable por diagnóstico, tutor y práctica.",
    gap:
      "Faltan comprobaciones diferidas de retención y transferencia fuera de los ejemplos guiados.",
    sourceArtifactIds: ["reflection-pas-loop", "reflection-intervention-map"],
    sourceRefs: [
      reflectionSources.emotionalLoop,
      reflectionSources.pas,
      reflectionSources.intervention,
    ],
    status: "approved",
    confidence: 0.82,
    highStakes: false,
    learnerVisible: true,
    tags: ["sistema", "cambio", "transferencia", "resumen"],
    pipelineVersion: "curriculum-reflection-v1",
    promptVersion: "reflection-consolidator-2026-10-04",
    createdAt: "2026-10-04T05:13:00.000Z",
  },
];

export const knownReflectionSourceIds = new Set(
  Object.values(reflectionSources).map((source) => source.sourceId),
);
