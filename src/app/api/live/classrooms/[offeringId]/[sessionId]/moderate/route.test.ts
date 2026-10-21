import { beforeEach, describe, expect, it, vi } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import { mayRestoreRevokedLearnerAccess } from "@/lib/live-classroom-revocation-queue";

const mocked = vi.hoisted(() => ({
  requireUser: vi.fn(),
  authorize: vi.fn(),
  configuration: vi.fn(),
  rosterGet: vi.fn(),
  rosterSet: vi.fn(),
  removeParticipant: vi.fn(),
}));

const roomName = "luma_" + "c".repeat(64);
const instructorIdentity = "p_" + "a".repeat(64);
const learnerIdentity = "p_" + "b".repeat(64);
const offeringId = "offering-live";
const sessionId = "session-live";

vi.mock("@/lib/learning-server", () => ({
  requireLearningUser: mocked.requireUser,
}));
vi.mock("@/lib/live-classroom-server", () => ({
  ClassroomError: class extends Error {
    constructor(readonly reason: string, readonly status: number) { super(reason); }
  },
  authorizeClassroom: mocked.authorize,
  liveKitConfiguration: mocked.configuration,
  roomReference: () => ({
    collection: () => ({
      doc: () => ({ get: mocked.rosterGet, set: mocked.rosterSet }),
    }),
  }),
  roomService: () => ({ removeParticipant: mocked.removeParticipant }),
}));

import { POST } from "./route";

function request(identity = learnerIdentity) {
  return new Request(
    `https://luma.example.test/api/live/classrooms/${offeringId}/${sessionId}/moderate`,
    {
      method: "POST",
      headers: { authorization: "Bearer synthetic", "content-type": "application/json" },
      body: JSON.stringify({ action: "remove", identity }),
    },
  );
}
const context = { params: Promise.resolve({ offeringId, sessionId }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocked.requireUser.mockResolvedValue({ uid: "instructor-uid" });
  mocked.authorize.mockResolvedValue({
    role: "instructor", uid: "instructor-uid", identity: instructorIdentity, roomName,
  });
  mocked.rosterGet.mockResolvedValue({
    exists: true,
    get: (field: string) => ({
      role: "learner",
      bannedAt: "2026-10-19T12:00:00.000Z",
      banReason: "enrollment_revoked",
      revocationJobId: "previous-commerce-refund",
    })[field as "role" | "bannedAt" | "banReason" | "revocationJobId"],
  });
  mocked.rosterSet.mockResolvedValue(undefined);
  mocked.removeParticipant.mockResolvedValue(undefined);
  mocked.configuration.mockReturnValue({ serverUrl: "wss://qa.livekit.cloud" });
});

describe("instructor expulsion versus later commercial reactivation", () => {
  it("makes the instructor ban sticky even if a previous refund ban existed", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    const update = mocked.rosterSet.mock.calls[0]?.[0] as {
      bannedAt: string; bannedBy: string; banReason: string;
      revocationJobId?: unknown;
    };
    expect(update).toMatchObject({
      bannedBy: "instructor-uid",
      banReason: "instructor_removed",
    });
    expect(new Date(update.bannedAt).toISOString()).toBe(update.bannedAt);
    expect(update.revocationJobId).toBeInstanceOf(FieldValue);
    // A merge used to retain the commercial ban reason after moderation.
    const persisted = Object.assign({ banReason: "enrollment_revoked",
      bannedAt: "2026-10-19T12:00:00.000Z" }, update);
    expect(mayRestoreRevokedLearnerAccess(persisted,
      ["2026-10-21T12:00:00.000Z"])).toBe(false);
    expect(mayRestoreRevokedLearnerAccess(update,
      ["2026-10-21T12:00:00.000Z"])).toBe(false);
    expect(mocked.removeParticipant).toHaveBeenCalledWith(roomName, learnerIdentity,
      expect.objectContaining({ revokeTokenTs: expect.any(BigInt) }));
  });

  it("persists the moderator ban before a provider removal failure and does not claim success", async () => {
    mocked.removeParticipant.mockRejectedValueOnce(new Error("provider unavailable"));
    const response = await POST(request(), context);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "moderation_unavailable" });
    expect(mocked.rosterSet).toHaveBeenCalledOnce();
    expect(mocked.rosterSet.mock.calls[0][0]).toMatchObject({
      banReason: "instructor_removed",
      bannedBy: "instructor-uid",
    });
  });

  it("denies learner-initiated moderation before writing an instructor ban", async () => {
    mocked.authorize.mockResolvedValue({ role: "learner", identity: learnerIdentity, uid: "other-user", roomName });
    const response = await POST(request(), context);
    expect(response.status).toBe(403);
    expect(mocked.rosterSet).not.toHaveBeenCalled();
    expect(mocked.removeParticipant).not.toHaveBeenCalled();
  });
});
