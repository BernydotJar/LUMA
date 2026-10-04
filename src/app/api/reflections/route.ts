import { NextResponse } from "next/server";
import { createReflectionDraft } from "@/lib/reflection-engine";
import { reflectionSources } from "@/lib/reflection-data";
import type { ReflectionExecutionReceipt } from "@/types/reflection";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as {
    sourceIds?: unknown;
  };
  const sourceIds = Array.isArray(payload.sourceIds)
    ? payload.sourceIds.filter((value): value is string => typeof value === "string")
    : [];

  const allowed = new Set([
    "raw-emotional-loop",
    "raw-pas",
    "raw-intervention-levels",
  ]);
  if (sourceIds.length > 0 && sourceIds.some((sourceId) => !allowed.has(sourceId))) {
    return NextResponse.json(
      { error: "Una o más fuentes no pertenecen al alcance aprobado de esta reflexión." },
      { status: 400 },
    );
  }

  const createdAt = new Date().toISOString();
  const artifact = createReflectionDraft({
    id: `reflection-${crypto.randomUUID()}`,
    title: "De pensamiento automático a intervención comprobable",
    body:
      "La lectura combinada sugiere una secuencia pedagógica: detectar el pensamiento, observar su efecto emocional y elegir el nivel donde una práctica puede producir evidencia nueva.",
    novelty:
      "La conexión convierte tres secciones separadas en una hipótesis curricular que puede probarse con escenarios de transferencia.",
    connection:
      "P.A.S. aporta señales de detección; la cadena emocional explica su impacto; los niveles lógicos proponen dónde intervenir.",
    gap:
      "Antes de publicarla, un experto debe aprobar una rúbrica para decidir el nivel de intervención y validar retención después de 72 horas.",
    sources: [
      reflectionSources.emotionalLoop,
      reflectionSources.pas,
      reflectionSources.intervention,
    ],
    createdAt,
  });

  const receipt: ReflectionExecutionReceipt = {
    receiptId: crypto.randomUUID(),
    artifactId: artifact.id,
    sourceIds: artifact.sourceRefs.map((source) => source.sourceId),
    executionMode: "deterministic-showcase-adapter",
    pipelineVersion: artifact.pipelineVersion,
    createdAt,
    stateAuthority: "none",
  };

  return NextResponse.json({
    artifact,
    receipt,
    policy: {
      originalSourcesRemainAuthoritative: true,
      learnerTwinUpdated: false,
      humanApprovalRequired: true,
      failureDoesNotBlockIngestion: true,
    },
  });
}
