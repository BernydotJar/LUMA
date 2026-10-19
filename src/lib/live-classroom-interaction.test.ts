import { describe, expect, it, vi } from "vitest";
import { TrackSource } from "livekit-server-sdk";
import {
  LIVE_HAND_ATTRIBUTE, MAX_MUTE_ALL_PARTICIPANTS, isRaised,
  microphoneTargets, muteTracksBounded, parseClassroomInteraction,
} from "./live-classroom-interaction";

const a = "p_" + "a".repeat(64);
const b = "p_" + "b".repeat(64);
const coach = "p_" + "c".repeat(64);

describe("educational live classroom action contract", () => {
  it("accepts only narrowly-typed, non-targetable hand actions", () => {
    expect(parseClassroomInteraction({ action: "set_hand", raised: true }))
      .toEqual({ action: "set_hand", raised: true });
    expect(parseClassroomInteraction({ action: "set_hand", raised: false }))
      .toEqual({ action: "set_hand", raised: false });
    expect(parseClassroomInteraction({ action: "acknowledge_hand", identity: a }))
      .toEqual({ action: "acknowledge_hand", identity: a });
    expect(parseClassroomInteraction({ action: "mute_all" })).toEqual({ action: "mute_all" });
    for (const invalid of [null, [], "raise_hand", { action: "set_hand", raised: "true" },
      { action: "set_hand", raised: true, identity: b }, { action: "acknowledge_hand", identity: "p_ab" },
      { action: "mute_all", target: a }, { action: "remove", identity: b }]) {
      expect(parseClassroomInteraction(invalid)).toBeNull();
    }
  });
  it("reconstructs the raised state from server-owned participant attributes", () => {
    expect(LIVE_HAND_ATTRIBUTE).toBe("luma.handRaised");
    expect(isRaised({ [LIVE_HAND_ATTRIBUTE]: "1" })).toBe(true);
    expect(isRaised({ [LIVE_HAND_ATTRIBUTE]: "" })).toBe(false);
    expect(isRaised({ "luma.handRaised": "true" })).toBe(false);
    expect(isRaised(undefined)).toBe(false);
  });
  it("never includes instructor, banned learner, already-muted tracks or screen-share audio", () => {
    const members = [
      { identity: a, tracks: [
        { sid: "MA", source: TrackSource.MICROPHONE },
        { sid: "SA", source: TrackSource.SCREEN_SHARE_AUDIO },
      ] },
      { identity: b, tracks: [{ sid: "MB", source: TrackSource.MICROPHONE }] },
      { identity: coach, tracks: [{ sid: "MC", source: TrackSource.MICROPHONE }] },
    ];
    const result = microphoneTargets(members, [
      { identity: a, role: "learner", banned: false },
      { identity: b, role: "learner", banned: true },
      { identity: coach, role: "instructor", banned: false },
    ]);
    expect(result).toEqual([{ identity: a, trackSid: "MA" }]);
    expect(MAX_MUTE_ALL_PARTICIPANTS).toBe(120);
  });
  it("counts partial provider errors without claiming everyone was muted", async () => {
    const targets = Array.from({ length: 15 }, (_, i) => ({ identity: a, trackSid: String(i) }));
    let active = 0;
    let maxActive = 0;
    const provider = vi.fn(async (target: { trackSid: string }) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      if (target.trackSid === "5" || target.trackSid === "9") throw new Error("provider down");
    });
    const result = await muteTracksBounded(targets, provider, 3);
    expect(result).toEqual({ muted: 13, failed: 2 });
    expect(maxActive).toBeLessThanOrEqual(3);
    expect(provider).toHaveBeenCalledTimes(15);
  });
  it("rejects unsafe parallel mute fan-out", async () => {
    await expect(muteTracksBounded([], async () => {}, 100)).rejects.toThrow(/CONCURRENCY_INVALID/);
  });
});
