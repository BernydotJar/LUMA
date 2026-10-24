import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { compareInvitationDigest, parseOperatorDecision, retentionDate, secureInvitationDigest } from "./approval-policy";

const reason = "Verificación realizada con evidencia institucional documentada.";
describe("institutional two-person screening and invitation parser", () => {
  it("accepts exact screening and invitation commands without client authority fields", () => {
    expect(parseOperatorDecision({action:"screen",expectedStatus:"received",tenantId:"qa-academia",initialProgramId:"curso-inicial",reason})).toMatchObject({tenantId:"qa-academia"});
    expect(parseOperatorDecision({action:"invite",expectedStatus:"in_review",reason})).toHaveProperty("action","invite");
    expect(parseOperatorDecision({action:"reissue",expectedStatus:"invitation_pending",reason})).toHaveProperty("action","reissue");
    expect(parseOperatorDecision({action:"revoke_invitation",expectedStatus:"invitation_accepted",reason})).toHaveProperty("action","revoke_invitation");
  });
  it.each([
    null,[],"hello",{},
    {action:"screen",expectedStatus:"received",tenantId:"qa",initialProgramId:"qa",reason},
    {action:"screen",expectedStatus:"received",tenantId:"qa",initialProgramId:"program",reason,admin:true},
    {action:"screen",expectedStatus:"received",tenantId:"../../other",initialProgramId:"program",reason},
    {action:"invite",expectedStatus:"received",reason},
    {action:"invite",expectedStatus:"in_review",reason,applicantUid:"another"},
    {action:"reissue",expectedStatus:"invitation_accepted",reason},
    {action:"reject",expectedStatus:"activated",reason},
    {action:"reject",expectedStatus:"received",reason:"bad"},
  ])("refuses invalid or privilege-bearing input %#", input => {
    expect(()=>parseOperatorDecision(input)).toThrow();
  });
  it("uses a 256-bit bearer only in constant-time digest comparison", () => {
    const token = randomBytes(32).toString("base64url");
    const digest = secureInvitationDigest(token);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(compareInvitationDigest(token,digest)).toBe(true);
    expect(compareInvitationDigest(randomBytes(32).toString("base64url"),digest)).toBe(false);
    expect(compareInvitationDigest("short",digest)).toBe(false);
    expect(compareInvitationDigest(token,"not-a-hash")).toBe(false);
  });
  it("applies documented retention windows, never silently promises completed deletion", () => {
    const now="2026-10-18T00:00:00.000Z";
    expect(Date.parse(retentionDate("rejected",now))-Date.parse(now)).toBe(30*86400000);
    expect(Date.parse(retentionDate("received",now))-Date.parse(now)).toBe(90*86400000);
    expect(Date.parse(retentionDate("activated",now))-Date.parse(now)).toBe(365*86400000);
  });
});
