import { describe, it, expect, afterEach, vi } from "vitest";
vi.mock("@/lib/institutions/review-server", () => ({ academyApprovalStore: {} }));
vi.mock("@/lib/learning-server", () => ({ requireLearningAdmin: vi.fn(async()=>{throw Error("AUTH_REQUIRED")}), requireLearningUser: vi.fn(async()=>{throw Error("AUTH_REQUIRED")}) }));
const { GET } = await import("./route");
const { POST: DECIDE } = await import("./[applicationId]/decisions/route");
const { POST: ACCEPT } = await import("@/app/api/institutions/invitations/accept/route");
const previous = process.env.LUMA_INSTITUTION_APPROVAL_ENABLED;
afterEach(()=>{if(previous===undefined)delete process.env.LUMA_INSTITUTION_APPROVAL_ENABLED;else process.env.LUMA_INSTITUTION_APPROVAL_ENABLED=previous;});
describe("institutional approvals disabled unless explicitly enabled",()=>{
  it("GET, decision, invitation acceptance all respond 503 by default",async()=>{
    delete process.env.LUMA_INSTITUTION_APPROVAL_ENABLED;
    const request=new Request("http://localhost/api/platform/institution-applications");
    expect((await GET(request)).status).toBe(503);
    expect((await DECIDE(new Request(request.url,{method:"POST"}),{params:Promise.resolve({applicationId:"a".repeat(64)})})).status).toBe(503);
    expect((await ACCEPT(new Request(request.url,{method:"POST"}))).status).toBe(503);
  });
  it("only exact true activates the authenticated flow",async()=>{
    for(const flag of ["True","1","TRUE","true ","false"]){
      process.env.LUMA_INSTITUTION_APPROVAL_ENABLED=flag;
      expect((await GET(new Request("http://localhost/api/platform/institution-applications"))).status).toBe(503);
    }
    process.env.LUMA_INSTITUTION_APPROVAL_ENABLED="true";
    expect((await GET(new Request("http://localhost/api/platform/institution-applications"))).status).toBe(401);
  });
});
