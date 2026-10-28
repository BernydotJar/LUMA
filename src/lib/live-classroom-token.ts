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
    // A participant already in a call remains connected; TTL only limits the
    // window for first joining/replaying an earlier signed credential. During
    // a call the media provider may issue refreshed tokens; on LiveKit Cloud,
    // RemoveParticipant plus revokeTokenTs must fence those credentials.
    ttl: "90s",
  });
  token.metadata = JSON.stringify({ role: input.role });
  token.addGrant({
    room: input.roomName,
    roomJoin: true,
    roomCreate: false,
    roomAdmin: false,
    roomRecord: false,
    canPublishData: true,
    // Hand gestures go through authenticated LUMA APIs; prevent client role/attribute spoofing.
    canUpdateOwnMetadata: false,
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
