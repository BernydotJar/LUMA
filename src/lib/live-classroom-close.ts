/**
 * Cloud-safe end-of-classroom token revocation.
 * Room deletion alone is not sufficient: LiveKit can auto-create deleted rooms
 * when a previously issued roomJoin JWT is reused.
 */
export const MAX_CLOSE_CREDENTIALS = 1000;
export const CLOSE_REVOKE_PARALLELISM = 6;

export interface CloseParticipantRevoker {
  removeParticipant(room: string, identity: string, options: { revokeTokenTs: bigint }): Promise<unknown>;
}

/**
 * Every identity that ever received a join token must be revoked, not just the
 * presently connected identities. Active identities are included as a fallback
 * for media clients whose roster records have not yet been migrated.
 */
export function closeRevocationTargets(
  issued: readonly string[],
  connected: readonly string[],
): string[] {
  const values = [...new Set([...issued, ...connected])];
  if (values.length > MAX_CLOSE_CREDENTIALS) {
    throw new Error("CLASSROOM_CLOSE_IDENTITY_LIMIT");
  }
  if (values.some((value) =>
    typeof value !== "string" || value.length < 1 || value.length > 256 ||
    /[\u0000-\u001f\u007f]/.test(value))) {
    throw new Error("CLASSROOM_CLOSE_IDENTITY_INVALID");
  }
  return values.sort();
}

/**
 * Revoke existing and refreshed Cloud credentials using an explicit cutoff.
 * Never hide a failed call: the application must not ACK closure while a
 * previously minted token still has a possible replay path.
 */
export async function revokeClassroomJoinTokens(
  revoker: CloseParticipantRevoker,
  roomName: string,
  identities: readonly string[],
  now = Date.now,
): Promise<{ revoked: number; failed: number; cutoff: bigint }> {
  if (!/^luma_[a-f0-9]{64}$/.test(roomName)) {
    throw new Error("CLASSROOM_CLOSE_ROOM_INVALID");
  }
  if (!Number.isFinite(now())) {
    throw new Error("CLASSROOM_CLOSE_TIME_INVALID");
  }
  if (identities.length > MAX_CLOSE_CREDENTIALS ||
      new Set(identities).size !== identities.length) {
    throw new Error("CLASSROOM_CLOSE_TARGETS_INVALID");
  }
  const cutoff=BigInt(Math.floor(now()/1000)+1);
  let cursor=0, revoked=0, failed=0;
  const workers=Array.from(
    {length:Math.min(CLOSE_REVOKE_PARALLELISM,identities.length)},
    async ()=>{
      while(cursor<identities.length) {
        const identity=identities[cursor++];
        try {
          // Compute a fresh cutoff per API request: the provider rejects values
          // over 60 seconds from server time during a lengthy large-class close.
          const callCutoff=BigInt(Math.floor(now()/1000)+1);
          await revoker.removeParticipant(roomName,identity,{revokeTokenTs:callCutoff});
          revoked++;
        } catch {
          failed++;
        }
      }
    }
  );
  await Promise.all(workers);
  if(failed)throw new Error("CLASSROOM_CLOSE_CREDENTIAL_REVOKE_RETRYABLE");
  return {revoked,failed,cutoff};
}
