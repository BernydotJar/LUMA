import { AccessToken, TrackSource } from "livekit-server-sdk";
import type { LiveClassroomRole } from "./live-classroom";

/** This is a *joining* credential, not a durable authentication session. */
export async function signClassroomJoinToken(input: {
  apiKey: string;
  apiSecret: string;
  roomName: string;
  identity: string;
  displayName: string;
  role: LiveClassroomRole;
}): Promise<string> {
  const token = new AccessToken(input.apiKey, input.apiSecret, {
    identity: input.identity,
    name: input.displayName,
    ttl: "10m",
  });
  token.metadata = JSON.stringify({ role: input.role });
  token.addGrant({
    room: input.roomName,
    roomJoin: true,
    roomCreate: false,
    roomAdmin: false,
    roomRecord: false,
    canPublishData: true,
    canSubscribe: true,
    canPublishSources: input.role === "instructor"
      ? [
        TrackSource.CAMERA, TrackSource.MICROPHONE,
        TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO,
      ]
      : [TrackSource.CAMERA, TrackSource.MICROPHONE],
  });
  return token.toJwt();
}
