export type SeVoiceSpeechRequest = {
  voice_id: string;
  text: string;
  use: "learning";
  speed: number;
  engine: string;
};

export type SeVoiceRuntimeConfig = {
  apiUrl: string;
  voiceId: string;
  engine: string;
  authMode: "none" | "google_oidc";
  audience: string;
};

const MAX_GUIDE_CHARS = 700;
const DEFAULT_API_URL = "http://127.0.0.1:8097";
const DEFAULT_VOICE_ID = "example_public";
const DEFAULT_ENGINE = "openvoice_v2";

function normalizeBaseUrl(value: string): string {
  const candidate = value.trim().replace(/\/+$/, "");
  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SE Voice API URL must use http or https");
  }
  return url.toString().replace(/\/$/, "");
}

function normalizeIdentifier(value: string, label: string): string {
  const candidate = value.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(candidate)) {
    throw new Error(`${label} contains unsupported characters`);
  }
  return candidate;
}

export function resolveSeVoiceConfig(
  env: Record<string, string | undefined> = process.env,
): SeVoiceRuntimeConfig {
  const apiUrl = normalizeBaseUrl(env.SE_VOICE_API_URL || DEFAULT_API_URL);
  const authMode = (env.SE_VOICE_AUTH_MODE || "none").trim().toLowerCase();
  if (authMode !== "none" && authMode !== "google_oidc") {
    throw new Error("SE Voice auth mode must be none or google_oidc");
  }

  return {
    apiUrl,
    voiceId: normalizeIdentifier(
      env.SE_VOICE_DEFAULT_VOICE || DEFAULT_VOICE_ID,
      "SE Voice voice id",
    ),
    engine: normalizeIdentifier(
      env.SE_VOICE_ENGINE || DEFAULT_ENGINE,
      "SE Voice engine",
    ),
    authMode,
    audience: normalizeBaseUrl(env.SE_VOICE_AUDIENCE || apiUrl),
  };
}

export function buildReflectionSpeechRequest(
  text: string,
  env: Record<string, string | undefined> = process.env,
): { config: SeVoiceRuntimeConfig; request: SeVoiceSpeechRequest } {
  const normalized = text.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new Error("Reflection guide text is required");
  }

  if (normalized.length > MAX_GUIDE_CHARS) {
    throw new Error("Reflection guide text exceeds the voice bridge limit");
  }

  const config = resolveSeVoiceConfig(env);
  return {
    config,
    request: {
      voice_id: config.voiceId,
      text: normalized,
      use: "learning",
      speed: 1,
      engine: config.engine,
    },
  };
}
