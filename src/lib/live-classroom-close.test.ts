import { describe, expect, it, vi } from "vitest";
import {
  CLOSE_REVOKE_PARALLELISM, MAX_CLOSE_CREDENTIALS,
  closeRevocationTargets, revokeClassroomJoinTokens,
} from "./live-classroom-close";

const room = "luma_" + "a".repeat(64);
describe("cloud-safe class closure", () => {
  it("revokes disconnected and connected token owners without dropping duplicates", () => {
    expect(closeRevocationTargets(["learner-b","instructor","learner-a"],["instructor","learner-b"]))
      .toEqual(["instructor","learner-a","learner-b"]);
  });

  it("refuses abusive or malformed rosters", () => {
    expect(() => closeRevocationTargets(Array.from(
      {length:MAX_CLOSE_CREDENTIALS+1},(_,i)=>String(i)),[]))
      .toThrow("CLASSROOM_CLOSE_IDENTITY_LIMIT");
    expect(() => closeRevocationTargets(["student\ninvalid"],[]))
      .toThrow("CLASSROOM_CLOSE_IDENTITY_INVALID");
  });

  it("uses a shared cutoff within the provider's 60s window for every issued JWT", async () => {
    const removeParticipant=vi.fn().mockResolvedValue(undefined);
    const t=Date.UTC(2026,9,21,3,0,0);
    const r=await revokeClassroomJoinTokens({removeParticipant},room,
      ["instructor","learner-one","learner-two"],()=>t);
    expect(r).toEqual({revoked:3,failed:0,cutoff:BigInt(Math.floor(t/1000)+1)});
    expect(removeParticipant).toHaveBeenCalledTimes(3);
    for(const call of removeParticipant.mock.calls) {
      expect(call[0]).toBe(room);
      expect(call[2]).toEqual({revokeTokenTs:r.cutoff});
    }
  });

  it("bounds concurrent revocation fanout for larger courses", async () => {
    let active=0,peak=0;
    const removeParticipant=vi.fn(async()=>{
      active++;peak=Math.max(peak,active);
      await new Promise(resolve=>setTimeout(resolve,2));
      active--;
    });
    const ids=Array.from({length:80},(_,i)=>"learner-"+i);
    const r=await revokeClassroomJoinTokens({removeParticipant},room,ids);
    expect(r.revoked).toBe(80);
    expect(peak).toBeLessThanOrEqual(CLOSE_REVOKE_PARALLELISM);
  });

  it("never ACKs successful closure when a provider credential revoke failed", async () => {
    const removeParticipant=vi.fn(async(_room: string,id: string)=>{
      if(id==="learner-a")throw new Error("provider unavailable");
    });
    await expect(revokeClassroomJoinTokens({removeParticipant},room,
      ["instructor","learner-a","learner-b"]))
      .rejects.toThrow("CLASSROOM_CLOSE_CREDENTIAL_REVOKE_RETRYABLE");
    expect(removeParticipant).toHaveBeenCalledTimes(3);
  });

  it("rejects inconsistent rooms and duplicated input", async () => {
    const revoker={removeParticipant:vi.fn()};
    await expect(revokeClassroomJoinTokens(revoker,"bad-room",[]))
      .rejects.toThrow("CLASSROOM_CLOSE_ROOM_INVALID");
    await expect(revokeClassroomJoinTokens(revoker,room,["x","x"]))
      .rejects.toThrow("CLASSROOM_CLOSE_TARGETS_INVALID");
  });
});
