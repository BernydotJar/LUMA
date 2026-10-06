"use server";

import { buildReflectionSpeechRequest } from "@/lib/se-voice-contract";
import { getGoogleIdentityToken } from "@/lib/google-oidc";

export type ReflectionGuideSpeechResult =
  | {
      ok: true;
      audioDataUrl: string;
      voiceId: string;
      engine: string;
    }
  | {
      ok: false;
      reason:
        | "unavailable"
        | "not_authorized"
        | "invalid_response"
        | "invalid_request";
    };

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const VOICE_TIMEOUT_MS = 150_000;

export async function synthesizeReflectionGuide(
  text: string,
): Promise<ReflectionGuideSpeechResult> {
  let bridge;
  try {
    bridge = buildReflectionSpeechRequest(text);
  } catch {
    return { ok: false, reason: "invalid_request" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VOICE_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (bridge.config.authMode === "google_oidc") {
      headers.authorization = `Bearer ${await getGoogleIdentityToken(bridge.config.audience)}`;
    }

    const response = await fetch(`${bridge.config.apiUrl}/v1/speech`, {
      method: "POST",
      headers,
      body: JSON.stringify(bridge.request),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: response.status === 409 ? "not_authorized" : "unavailable",
      };
    }

    const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
    if (!contentType.startsWith("audio/")) {
      return { ok: false, reason: "invalid_response" };
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_AUDIO_BYTES) {
      return { ok: false, reason: "invalid_response" };
    }

    return {
      ok: true,
      audioDataUrl: `data:${contentType};base64,${bytes.toString("base64")}`,
      voiceId: bridge.config.voiceId,
      engine: bridge.config.engine,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}
