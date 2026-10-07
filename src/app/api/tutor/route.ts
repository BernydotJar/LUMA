import { NextResponse } from "next/server";
import { moduleThreeSource } from "@/lib/luma-data";
import {
  extractivePnlAnswer,
  isPnlHitRelevant,
  normalizePnlText,
  searchPnlRag,
} from "@/lib/pnl-rag";

const responses = [
  {
    keywords: ["pas", "sabote", "pensamiento"],
    answer:
      "Un P.A.S. es un pensamiento automático saboteador: aparece rápido, suele sentirse creíble y usa absolutos como “siempre”, “jamás” o “imposible”. En lugar de discutirlo de inmediato, prueba tres pasos: describe el acontecimiento sin interpretar, escribe el pensamiento exacto y nombra la emoción que siguió. ¿Qué frase apareció primero en tu mente?",
    concept: "Pensamientos automáticos saboteadores",
    source: "Módulo 3 · sección Comunicación emocional / P.A.S.",
    reflection: {
      artifactId: "reflection-pas-loop",
      label: "Conexión curricular aprobada",
      insight:
        "P.A.S. vuelve observable la cadena pensamiento–emoción–acción y permite convertirla en práctica de transferencia.",
      sourceCount: 2,
    },
  },
  {
    keywords: ["nivel", "identidad", "creencia", "entorno"],
    answer:
      "Los niveles lógicos ayudan a ubicar dónde conviene intervenir: entorno, conducta, capacidades, creencias y valores, identidad y misión. Cambiar solo la conducta puede exigir mucho esfuerzo si una creencia o identidad la contradice. Cuéntame el cambio que buscas y te ayudo a formular una pregunta para cada nivel.",
    concept: "Niveles lógicos",
    source: "Módulo 3 · sección Dónde cambiar / Niveles lógicos",
    reflection: {
      artifactId: "reflection-intervention-map",
      label: "Reflexión pendiente de revisión",
      insight:
        "La relación entre detectar un patrón y elegir el nivel de intervención aún necesita una rúbrica aprobada.",
      sourceCount: 2,
    },
  },
  {
    keywords: ["emocion", "ira", "miedo", "triste"],
    answer:
      "El material propone empezar por el pensamiento que originó la emoción, porque cambiar la interpretación puede cambiar la respuesta. Eso no significa negar lo que sientes: primero nómbralo, observa qué estabas pensando y decide una acción que no te haga daño. ¿Quieres trabajar con una situación de hoy?",
    concept: "Comunicación emocional",
    source: "Módulo 3 · sección Cómo se gestionan las emociones",
    reflection: {
      artifactId: "reflection-pas-loop",
      label: "Conexión curricular aprobada",
      insight:
        "La sección de P.A.S. operacionaliza la relación entre pensamiento y emoción descrita al inicio del módulo.",
      sourceCount: 2,
    },
  },
];

const highStakesKeywords = [
  "organo", "rinon", "pulmon", "higado", "corazon",
  "enfermedad", "enferman", "cura", "curar", "medico",
];

export async function POST(request: Request) {
  let payload: { message?: unknown };
  try {
    payload = (await request.json()) as { message?: unknown };
  } catch {
    return NextResponse.json(
      { error: "La solicitud del tutor no contiene JSON válido." },
      { status: 400 },
    );
  }

  const message =
    typeof payload.message === "string" ? payload.message.trim() : "";

  if (!message) {
    return NextResponse.json(
      { error: "Escribe una pregunta para continuar." },
      { status: 400 },
    );
  }

  const normalized = normalizePnlText(message);

  if (highStakesKeywords.some((keyword) => normalized.includes(keyword))) {
    return NextResponse.json({
      answer:
        "El material del curso contiene una afirmación que relaciona emociones, órganos y enfermedad, pero el corpus no aporta evidencia clínica independiente. LUMA no puede presentarla como un hecho médico verificado. Puedo mostrarte exactamente dónde aparece y separar la perspectiva del curso de la evidencia disponible; para una preocupación de salud, corresponde consultar a un profesional cualificado.",
      evidence: {
        concept: "Afirmación de salud bajo revisión",
        source: "Módulo 3 · págs. 7–8 · afirmaciones de salud",
        url: moduleThreeSource.url,
        confidence: 1,
      },
      learningMove: "ESCALATE",
      trust: {
        status: "BLOCKED_CLAIM",
        reason:
          "La afirmación es de alto impacto y no tiene evidencia independiente ni aprobación cualificada dentro del corpus.",
        artifactId: "finding-health-claims",
      },
    });
  }

  const rag = await searchPnlRag(message, 5);
  const relevantRagHits = rag.configured
    ? rag.results.filter((hit) => isPnlHitRelevant(message, hit))
    : [];

  if (rag.configured && relevantRagHits.length > 0) {
    const top = relevantRagHits[0];
    return NextResponse.json({
      answer: extractivePnlAnswer(top),
      evidence: {
        concept: `Corpus audiovisual · ${top.module}`,
        source: `${top.title} · ${top.startClock} → ${top.endClock}`,
        url: top.driveUrl,
        sourceId: top.sourceId,
        driveFileId: top.driveFileId,
        chunkId: top.chunkId,
        startClock: top.startClock,
        endClock: top.endClock,
      },
      evidenceItems: relevantRagHits.slice(0, 3).map((hit) => ({
        sourceId: hit.sourceId,
        driveFileId: hit.driveFileId,
        chunkId: hit.chunkId,
        module: hit.module,
        title: hit.title,
        startClock: hit.startClock,
        endClock: hit.endClock,
        text: hit.text,
        driveUrl: hit.driveUrl,
      })),
      learningMove: "EXPLAIN",
      trust: {
        status: "GROUNDED",
        artifactId: top.chunkId,
      },
      retrieval: {
        backend: `pnl-rag/${rag.backend ?? "unknown"}`,
        resultCount: relevantRagHits.length,
        rejectedAsIrrelevant:
          rag.results.length - relevantRagHits.length,
      },
    });
  }

  if (rag.configured && rag.strict) {
    if (rag.error) {
      return NextResponse.json(
        {
          answer:
            "El corpus PNL está configurado, pero la recuperación no está disponible en este momento. No voy a completar la respuesta desde memoria general.",
          learningMove: "ESCALATE",
          trust: {
            status: "RETRIEVAL_UNAVAILABLE",
            reason:
              "El servicio de recuperación del corpus no respondió.",
          },
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      answer:
        rag.results.length > 0
          ? "La recuperación devolvió contenido, pero no puedo demostrar que sea relevante para tu solicitud actual. Necesito una pregunta más específica."
          : "No encontré evidencia suficiente en el corpus procesado.",
      learningMove: "ASK",
      trust: {
        status: "INSUFFICIENT_EVIDENCE",
        reason:
          rag.results.length > 0
            ? "Los resultados recuperados no superaron la verificación mínima de relevancia para la solicitud actual."
            : "El corpus configurado no devolvió evidencia para la solicitud actual.",
      },
    });
  }

  const matched =
    responses.find((candidate) =>
      candidate.keywords.some((keyword) => normalized.includes(keyword)),
    ) ?? responses[0];

  return NextResponse.json({
    answer: matched.answer,
    evidence: {
      concept: matched.concept,
      source: matched.source,
      url: moduleThreeSource.url,
      confidence: 0.92,
    },
    reflection: matched.reflection,
    learningMove:
      normalized.includes("respuesta") || normalized.includes("dime")
        ? "ASK"
        : "SOCRATIC_QUESTION",
    trust: {
      status: "GROUNDED",
      artifactId: matched.reflection.artifactId,
    },
  });
}
