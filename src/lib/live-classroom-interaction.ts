import { TrackSource } from "livekit-server-sdk";

/** Provider attributes are server-owned. Never grant learners canUpdateOwnMetadata. */
export const LIVE_HAND_ATTRIBUTE = "luma.handRaised";
export const MAX_MUTE_ALL_PARTICIPANTS = 120;

export type ClassroomInteraction =
  | { action: "set_hand"; raised: boolean }
  | { action: "acknowledge_hand"; identity: string }
  | { action: "mute_all" };

export function parseClassroomInteraction(payload: unknown): ClassroomInteraction | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const body = payload as Record<string, unknown>;
  const keys = Object.keys(body).sort().join(",");
  if (body.action === "set_hand" && keys === "action,raised" && typeof body.raised === "boolean") {
    return { action: "set_hand", raised: body.raised };
  }
  if (body.action === "acknowledge_hand" && keys === "action,identity" &&
      typeof body.identity === "string" && /^p_[a-f0-9]{64}$/.test(body.identity)) {
    return { action: "acknowledge_hand", identity: body.identity };
  }
  if (body.action === "mute_all" && keys === "action") return { action: "mute_all" };
  return null;
}

export function isRaised(attributes: Record<string, string> | undefined): boolean {
  return attributes?.[LIVE_HAND_ATTRIBUTE] === "1";
}

interface RoomMember {
  identity: string;
  tracks: readonly { sid: string; source: TrackSource; muted?: boolean }[];
}
interface RosterMember { identity: string; role: string; banned: boolean }
export interface MicrophoneTarget { identity: string; trackSid: string }

/** Only authoritative, enrolled learners. Never mute instructors or screen share audio. */
export function microphoneTargets(
  participants: readonly RoomMember[],
  roster: readonly RosterMember[],
): MicrophoneTarget[] {
  const learners = new Set(roster.filter((p) => p.role === "learner" && !p.banned)
    .map((p) => p.identity));
  return participants.flatMap((participant) =>
    learners.has(participant.identity)
      ? participant.tracks.filter((track) =>
          track.source === TrackSource.MICROPHONE && !!track.sid && !track.muted)
        .map((track) => ({ identity: participant.identity, trackSid: track.sid }))
      : [],
  );
}

/** Keep LiveKit moderation fan-out bounded and surface partial failures. */
export async function muteTracksBounded(
  tracks: readonly MicrophoneTarget[],
  apply: (target: MicrophoneTarget) => Promise<unknown>,
  concurrency = 6,
): Promise<{ muted: number; failed: number }> {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) {
    throw new Error("CLASSROOM_MUTE_CONCURRENCY_INVALID");
  }
  let cursor = 0;
  let muted = 0;
  let failed = 0;
  const runners = Array.from({ length: Math.min(tracks.length, concurrency) }, async () => {
    while (cursor < tracks.length) {
      const target = tracks[cursor++];
      try {
        await apply(target);
        muted += 1;
      } catch {
        failed += 1;
      }
    }
  });
  await Promise.all(runners);
  return { muted, failed };
}
