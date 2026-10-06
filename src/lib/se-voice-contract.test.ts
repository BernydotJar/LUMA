import { describe, expect, it } from "vitest";
import {
  buildReflectionSpeechRequest,
  resolveSeVoiceConfig,
} from "./se-voice-contract";

describe("SE Voice contract", () => {
  it("uses the colocated pilot defaults", () => {
    expect(resolveSeVoiceConfig({})).toEqual({
      apiUrl: "http://127.0.0.1:8097",
      voiceId: "example_public",
      engine: "openvoice_v2",
    });
  });

  it("builds a learning-only request and normalizes the prompt", () => {
    const result = buildReflectionSpeechRequest(
      "  ¿Qué cambió   en tu mensaje?  ",
      {
        SE_VOICE_API_URL: "https://voice.example.com/",
        SE_VOICE_DEFAULT_VOICE: "se_authorized_voice",
        SE_VOICE_ENGINE: "openvoice_v2",
      },
    );

    expect(result.config.apiUrl).toBe("https://voice.example.com");
    expect(result.request).toEqual({
      voice_id: "se_authorized_voice",
      text: "¿Qué cambió en tu mensaje?",
      use: "learning",
      speed: 1,
      engine: "openvoice_v2",
    });
  });

  it("rejects empty or oversized guide text", () => {
    expect(() => buildReflectionSpeechRequest("   ", {})).toThrow();
    expect(() => buildReflectionSpeechRequest("x".repeat(701), {})).toThrow();
  });

  it("rejects unsafe runtime identifiers and protocols", () => {
    expect(() =>
      resolveSeVoiceConfig({ SE_VOICE_API_URL: "file:///tmp/voice" }),
    ).toThrow();

    expect(() =>
      resolveSeVoiceConfig({ SE_VOICE_DEFAULT_VOICE: "../../mary" }),
    ).toThrow();
  });
});
