import type {
  KnowledgeArtifact,
  RankedKnowledgeArtifact,
  ReflectionSourceRef,
  RetrievalIntent,
} from "@/types/reflection";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();

const tokenize = (value: string) =>
  new Set(normalize(value).split(/\s+/).filter((token) => token.length > 2));

const uniqueSources = (sources: ReflectionSourceRef[]) => {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.sourceId}:${source.locator}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function validateArtifactLineage(
  artifact: KnowledgeArtifact,
  knownSourceIds: Set<string>,
): string[] {
  const errors: string[] = [];

  if (artifact.kind !== "raw-source" && artifact.sourceRefs.length === 0) {
    errors.push("Derived artifacts require at least one source reference.");
  }

  for (const ref of artifact.sourceRefs) {
    if (!knownSourceIds.has(ref.sourceId)) {
      errors.push(`Unknown source reference: ${ref.sourceId}.`);
    }
    if (!ref.locator.trim()) {
      errors.push(`Source ${ref.sourceId} is missing a locator.`);
    }
  }

  if (artifact.kind !== "raw-source" && !artifact.promptVersion) {
    errors.push("Derived artifacts require a prompt version.");
  }

  return errors;
}

export function canSurfaceArtifact(
  artifact: KnowledgeArtifact,
  intent: RetrievalIntent,
): boolean {
  if (intent === "curriculum-review") {
    return true;
  }

  if (artifact.status !== "approved") return false;
  if (!artifact.learnerVisible || artifact.highStakes) return false;
  if (artifact.kind === "quality-finding") return false;

  return true;
}

const kindWeight: Record<RetrievalIntent, Record<KnowledgeArtifact["kind"], number>> = {
  factual: {
    "raw-source": 1.45,
    reflection: 0.82,
    summary: 0.72,
    "quality-finding": 0,
  },
  conceptual: {
    "raw-source": 1,
    reflection: 1.2,
    summary: 1.12,
    "quality-finding": 0,
  },
  "curriculum-review": {
    "raw-source": 0.8,
    reflection: 1.08,
    summary: 1.16,
    "quality-finding": 1.32,
  },
};

export function rankKnowledgeArtifacts(
  query: string,
  intent: RetrievalIntent,
  artifacts: KnowledgeArtifact[],
): RankedKnowledgeArtifact[] {
  const queryTokens = tokenize(query);

  return artifacts
    .filter((artifact) => canSurfaceArtifact(artifact, intent))
    .map((artifact) => {
      const searchable = tokenize(
        [
          artifact.title,
          artifact.body,
          artifact.novelty,
          artifact.connection,
          artifact.gap,
          artifact.tags.join(" "),
        ]
          .filter(Boolean)
          .join(" "),
      );
      const overlap = [...queryTokens].filter((token) => searchable.has(token)).length;
      const coverage = queryTokens.size === 0 ? 0 : overlap / queryTokens.size;
      const statusWeight =
        artifact.status === "approved"
          ? 0.24
          : artifact.status === "in-review"
            ? 0.08
            : 0;
      const sourceWeight = Math.min(artifact.sourceRefs.length * 0.025, 0.1);
      const score =
        coverage * 2.6 +
        kindWeight[intent][artifact.kind] +
        statusWeight +
        sourceWeight +
        artifact.confidence * 0.22;

      const rankReason =
        intent === "factual" && artifact.kind === "raw-source"
          ? "La intención es factual: LUMA prioriza la fuente original."
          : artifact.kind === "quality-finding"
            ? "La revisión curricular prioriza un hallazgo de riesgo o calidad."
            : artifact.kind === "reflection" || artifact.kind === "summary"
              ? "La síntesis conecta varias fuentes y conserva su linaje."
              : "Coincidencia directa con el material aprobado.";

      return {
        ...artifact,
        rankScore: Number(score.toFixed(4)),
        rankReason,
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore || b.confidence - a.confidence);
}

export function createReflectionDraft({
  id,
  title,
  body,
  novelty,
  connection,
  gap,
  sources,
  createdAt,
}: {
  id: string;
  title: string;
  body: string;
  novelty: string;
  connection: string;
  gap: string;
  sources: ReflectionSourceRef[];
  createdAt: string;
}): KnowledgeArtifact {
  return {
    id,
    corpusId: "practitioner-module-3",
    kind: "reflection",
    title,
    body,
    novelty,
    connection,
    gap,
    sourceArtifactIds: [...new Set(sources.map((source) => source.sourceId))],
    sourceRefs: uniqueSources(sources),
    status: "draft",
    confidence: 0.78,
    highStakes: false,
    learnerVisible: false,
    tags: ["pensamiento", "emocion", "transferencia", "intervencion"],
    pipelineVersion: "curriculum-reflection-v1",
    promptVersion: "module-3-reflection-2026-10-04",
    createdAt,
  };
}

export function consolidateApprovedReflections(
  id: string,
  reflections: KnowledgeArtifact[],
  createdAt: string,
): KnowledgeArtifact | undefined {
  const approved = reflections.filter(
    (artifact) =>
      artifact.kind === "reflection" &&
      artifact.status === "approved" &&
      !artifact.highStakes,
  );

  if (approved.length < 2) return undefined;

  return {
    id,
    corpusId: approved[0].corpusId,
    kind: "summary",
    title: "Mapa sistémico del cambio personal",
    body:
      "El módulo plantea una secuencia conectada: observar pensamiento y emoción, elegir el nivel de intervención y ensayar una respuesta verificable.",
    novelty:
      "La consolidación hace explícito un modelo común que estaba distribuido entre secciones.",
    connection:
      "Conecta P.A.S., estado interno, niveles lógicos y cambio de creencias sin reemplazar sus fuentes.",
    gap:
      "Aún falta una evaluación diferida que compruebe transferencia y retención fuera del escenario guiado.",
    sourceArtifactIds: approved.map((artifact) => artifact.id),
    sourceRefs: uniqueSources(approved.flatMap((artifact) => artifact.sourceRefs)),
    status: "approved",
    confidence: Math.min(...approved.map((artifact) => artifact.confidence)),
    highStakes: false,
    learnerVisible: true,
    tags: ["sistema", "cambio", "transferencia", "resumen"],
    pipelineVersion: "curriculum-reflection-v1",
    promptVersion: "reflection-consolidator-2026-10-04",
    createdAt,
  };
}
