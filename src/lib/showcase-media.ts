export type ShowcaseVideoSource = {
  label: string;
  sizeGiB: number;
  status: "private";
};

export const showcaseVideoSources: ShowcaseVideoSource[] = [
  { label: "Módulo 1 · Clase 1", sizeGiB: 3.16, status: "private" },
  { label: "Módulo 1 · Clase 2", sizeGiB: 2.19, status: "private" },
  { label: "Módulo 1 · Clase 3", sizeGiB: 4.29, status: "private" },
  { label: "Módulo 1 · Clase 4", sizeGiB: 2.25, status: "private" },
  { label: "Módulo 1 · Clase 5", sizeGiB: 3.93, status: "private" },
];

export const showcaseVideoSummary = {
  count: showcaseVideoSources.length,
  totalGiB: 15.82,
  recommendedFirstSource: "Módulo 1 · Clase 2",
  rightsState: "Rights gate",
} as const;

export const voicePrototype = {
  label: "Seres Coach Voice · Prototype 01",
  durationSeconds: 12.4,
  status: "Direction review",
  path: "/audio/seres-coach-prototype-01.mp3",
  rightsMode: "Original voice direction · direct cloning blocked without explicit rights",
} as const;

export const publicVideoDemo = {
  title: "PASO 58 · Semillas de Esperanza para Volver a Empezar",
  author: "Mary Cardona Lenis · Seres de Excelencia",
  youtubeId: "0Q4ZcGexZSY",
  embedUrl: "https://www.youtube-nocookie.com/embed/0Q4ZcGexZSY?rel=0",
  posterPath: "/media/seres-paso-58.jpg",
  status: "Public source · showcase safe",
  evidenceRule: "Ver el video registra exposición; la capacidad se demuestra en una práctica posterior.",
} as const;

export const iconStillCandidate = {
  label: "Practice / P.A.S. · SE",
  status: "Awaiting PO approval",
  path: "/iconography/review/practice-se-candidate.png",
  generation: "Gemini Images · authenticated private bridge",
  motionState: "Motion intentionally not generated before still approval",
} as const;
