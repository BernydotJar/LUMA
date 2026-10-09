import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { FirestoreProgramDeliveryStore, type LiveProgramSession } from "./program-delivery";

const emulatorEnabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const app = emulatorEnabled
  ? initializeApp(
      { projectId: process.env.GCLOUD_PROJECT || "demo-luma-program-delivery" },
      `luma-program-delivery-${randomUUID()}`,
    )
  : undefined;
const store = app ? new FirestoreProgramDeliveryStore(getFirestore(app)) : undefined;

describe.runIf(emulatorEnabled)("FirestoreProgramDeliveryStore emulator", () => {
  afterAll(async () => {
    if (app) await deleteApp(app);
  });

  it("supports live cohort sessions without requiring recordings", async () => {
    const suffix = randomUUID();
    const offering = await store!.upsertOffering({
      tenantId: "seres-de-excelencia",
      programId: `high-ticket-${suffix}`,
      cohortKey: "oct-2026",
      title: "Programa High Ticket · Octubre",
      deliveryMode: "live",
      timezone: "America/Bogota",
      coachIds: ["coach-1"],
    });

    const session = await store!.scheduleSession(offering.offeringId, {
      title: "Sesión en vivo 1",
      startsAt: "2026-10-20T23:00:00Z",
      durationMinutes: 120,
      joinUrl: "https://meet.example.com/session-1",
      recordingPolicy: "none",
    });

    const upcoming = await store!.upcomingForPrograms(
      [{ tenantId: offering.tenantId, programId: offering.programId, offeringId: offering.offeringId }],
      "2026-10-08T00:00:00Z",
    );

    expect(session.recordingPolicy).toBe("none");
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].offering.deliveryMode).toBe("live");
  });

  it("never leaks a same-program cohort across tenants", async () => {
    const suffix = randomUUID();
    const programId = `shared-program-${suffix}`;
    const tenantA = await store!.upsertOffering({
      tenantId: `tenant-a-${suffix}`,
      programId,
      cohortKey: "cohort-a",
      title: "Tenant A cohort",
      deliveryMode: "live",
      timezone: "America/Bogota",
    });
    const tenantB = await store!.upsertOffering({
      tenantId: `tenant-b-${suffix}`,
      programId,
      cohortKey: "cohort-b",
      title: "Tenant B private cohort",
      deliveryMode: "live",
      timezone: "America/Bogota",
    });

    await store!.scheduleSession(tenantA.offeringId, {
      title: "Tenant A session",
      startsAt: "2026-10-20T20:00:00Z",
      durationMinutes: 60,
      joinUrl: "https://meet.example.com/tenant-a",
    });
    await store!.scheduleSession(tenantB.offeringId, {
      title: "Tenant B private session",
      startsAt: "2026-10-20T21:00:00Z",
      durationMinutes: 60,
      joinUrl: "https://meet.example.com/tenant-b",
    });

    const upcoming = await store!.upcomingForPrograms(
      [{ tenantId: tenantA.tenantId, programId, offeringId: tenantA.offeringId }],
      "2026-10-08T00:00:00Z",
    );

    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].offering.tenantId).toBe(tenantA.tenantId);
    expect(upcoming[0].session.joinUrl).toContain("tenant-a");
  });

  it("limits a learner to the assigned cohort within one tenant and program", async () => {
    const suffix = randomUUID();
    const tenantId = `one-tenant-${suffix}`;
    const programId = `one-program-${suffix}`;
    const a = await store!.upsertOffering({ tenantId, programId, cohortKey: "A",
      title: "Cohort A", deliveryMode: "live", timezone: "America/Bogota" });
    const b = await store!.upsertOffering({ tenantId, programId, cohortKey: "B",
      title: "Cohort B", deliveryMode: "live", timezone: "America/Bogota" });
    await store!.scheduleSession(a.offeringId, { title: "A private",
      startsAt: "2026-10-20T20:00:00Z", durationMinutes: 60, joinUrl: "https://example.com/A" });
    await store!.scheduleSession(b.offeringId, { title: "B private",
      startsAt: "2026-10-20T20:00:00Z", durationMinutes: 60, joinUrl: "https://example.com/B" });
    const visible = await store!.upcomingForPrograms([{ tenantId, programId, offeringId: a.offeringId }],
      "2026-10-08T00:00:00Z");
    expect(visible).toHaveLength(1);
    expect(visible[0].offering.offeringId).toBe(a.offeringId);
    expect(visible[0].session.joinUrl).toBe("https://example.com/A");
  });

  it("shows an ongoing live session until its scheduled end", async () => {
    const suffix = randomUUID();
    const offering = await store!.upsertOffering({ tenantId: `live-tenant-${suffix}`,
      programId: `live-program-${suffix}`, cohortKey: "live", title: "Ongoing cohort",
      deliveryMode: "live", timezone: "America/Bogota" });
    await store!.scheduleSession(offering.offeringId, { title: "Live session",
      startsAt: "2026-10-08T12:00:00Z", durationMinutes: 120,
      joinUrl: "https://meet.example.com/ongoing" });
    const access = [{ tenantId: offering.tenantId, programId: offering.programId,
      offeringId: offering.offeringId }];
    const during = await store!.upcomingForPrograms(access, "2026-10-08T12:30:00Z");
    expect(during).toHaveLength(1);
    expect(during[0].session.joinUrl).toContain("ongoing");
    const after = await store!.upcomingForPrograms(access, "2026-10-08T14:00:01Z");
    expect(after).toHaveLength(0);
  });

  it("rejects non-finite session durations", async () => {
    const suffix = randomUUID();
    const offering = await store!.upsertOffering({
      tenantId: "seres-de-excelencia",
      programId: `duration-${suffix}`,
      cohortKey: "finite",
      title: "Finite duration",
      deliveryMode: "live",
      timezone: "America/Bogota",
    });

    await expect(
      store!.scheduleSession(offering.offeringId, {
        title: "Invalid duration",
        startsAt: "2026-10-20T23:00:00Z",
        durationMinutes: Number.NaN,
      }),
    ).rejects.toThrow("durationMinutes must be finite");
  });

  it("finds an authorized offering after more than 250 unrelated offerings", async () => {
    const suffix = randomUUID();
    const firestore = getFirestore(app!);
    const batch = firestore.batch();
    const now = "2026-10-08T00:00:00.000Z";

    for (let index = 0; index < 260; index += 1) {
      const id = `unrelated-${suffix}-${String(index).padStart(3, "0")}`;
      batch.set(firestore.collection("programOfferings").doc(id), {
        offeringId: id,
        tenantId: `other-tenant-${suffix}`,
        programId: `other-program-${index}`,
        cohortKey: "other",
        title: `Other ${index}`,
        deliveryMode: "live",
        timezone: "America/Bogota",
        status: "active",
        coachIds: [],
        createdAt: now,
        updatedAt: now,
      });
    }
    await batch.commit();

    const target = await store!.upsertOffering({
      tenantId: `target-tenant-${suffix}`,
      programId: `target-program-${suffix}`,
      cohortKey: "target",
      title: "Target cohort",
      deliveryMode: "live",
      timezone: "America/Bogota",
    });
    await store!.scheduleSession(target.offeringId, {
      title: "Target future session",
      startsAt: "2026-10-20T20:00:00Z",
      durationMinutes: 60,
    });

    const upcoming = await store!.upcomingForPrograms(
      [{ tenantId: target.tenantId, programId: target.programId, offeringId: target.offeringId }],
      "2026-10-08T00:00:00Z",
    );

    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].offering.offeringId).toBe(target.offeringId);
  });

  it("finds future sessions after more than 100 historical sessions", async () => {
    const suffix = randomUUID();
    const firestore = getFirestore(app!);
    const offering = await store!.upsertOffering({
      tenantId: `history-tenant-${suffix}`,
      programId: `history-program-${suffix}`,
      cohortKey: "history",
      title: "Long-running cohort",
      deliveryMode: "live",
      timezone: "America/Bogota",
    });
    const batch = firestore.batch();
    for (let index = 0; index < 105; index += 1) {
      const startsAt = new Date(
        Date.UTC(2025, 0, 1 + index, 12, 0, 0),
      ).toISOString();
      const id = `past-${String(index).padStart(3, "0")}`;
      batch.set(
        firestore
          .collection("programOfferings")
          .doc(offering.offeringId)
          .collection("sessions")
          .doc(id),
        {
          sessionId: id,
          offeringId: offering.offeringId,
          title: `Historical ${index}`,
          startsAt,
          durationMinutes: 60,
          recordingPolicy: "none",
          status: "completed",
          createdAt: startsAt,
          updatedAt: startsAt,
        },
      );
    }
    await batch.commit();

    await store!.scheduleSession(offering.offeringId, {
      sessionId: "future-session",
      title: "Future session",
      startsAt: "2026-10-20T20:00:00Z",
      durationMinutes: 60,
    });

    const upcoming = await store!.upcomingForPrograms(
      [{ tenantId: offering.tenantId, programId: offering.programId, offeringId: offering.offeringId }],
      "2026-10-08T00:00:00Z",
    );

    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].session.sessionId).toBe("future-session");
  });

  it("preserves coach assignments when an offering update omits coachIds", async () => {
    const suffix = randomUUID();
    const first = await store!.upsertOffering({
      tenantId: `coach-tenant-${suffix}`,
      programId: `coach-program-${suffix}`,
      cohortKey: "coach-cohort",
      title: "Coach cohort",
      deliveryMode: "live",
      timezone: "America/Bogota",
      coachIds: ["coach-a", "coach-b"],
    });
    const updated = await store!.upsertOffering({
      tenantId: first.tenantId,
      programId: first.programId,
      cohortKey: first.cohortKey,
      title: "Coach cohort updated",
      deliveryMode: "live",
      timezone: first.timezone,
    });
    expect(updated.coachIds).toEqual(["coach-a", "coach-b"]);
  });

  it("preserves an existing join URL when a session update omits joinUrl", async () => {
    const suffix = randomUUID();
    const offering = await store!.upsertOffering({
      tenantId: `join-tenant-${suffix}`,
      programId: `join-program-${suffix}`,
      cohortKey: "join",
      title: "Join URL cohort",
      deliveryMode: "live",
      timezone: "America/Bogota",
    });
    const first = await store!.scheduleSession(offering.offeringId, {
      sessionId: "stable-session",
      title: "Original",
      startsAt: "2026-10-20T20:00:00Z",
      durationMinutes: 60,
      joinUrl: "https://meet.example.com/stable",
    });
    const updated = await store!.scheduleSession(offering.offeringId, {
      sessionId: first.sessionId,
      title: "Updated",
      startsAt: first.startsAt,
      durationMinutes: 75,
      status: "completed",
    });
    expect(updated.joinUrl).toBe("https://meet.example.com/stable");
  });

  it("returns admin sessions beyond the first 100 records", async () => {
    const suffix = randomUUID();
    const offering = await store!.upsertOffering({
      tenantId: `admin-history-${suffix}`,
      programId: `admin-history-${suffix}`,
      cohortKey: "history",
      title: "Admin history",
      deliveryMode: "live",
      timezone: "America/Bogota",
    });
    const firestore = getFirestore(app!);
    const batch = firestore.batch();
    for (let index = 0; index < 105; index += 1) {
      const startsAt = new Date(Date.UTC(2025, 0, 1 + index, 12)).toISOString();
      const id = `admin-${String(index).padStart(3, "0")}`;
      batch.set(
        firestore.collection("programOfferings").doc(offering.offeringId).collection("sessions").doc(id),
        {
          sessionId: id, offeringId: offering.offeringId, title: `Admin ${index}`,
          startsAt, durationMinutes: 60, recordingPolicy: "none", status: "completed",
          createdAt: startsAt, updatedAt: startsAt,
        },
      );
    }
    await batch.commit();
    const sessions: LiveProgramSession[] = [];
    let cursor: string | undefined;
    let pageCount = 0;
    do {
      const page = await store!.listSessionsPage(offering.offeringId, 40, cursor);
      expect(page.sessions.length).toBeLessThanOrEqual(40);
      sessions.push(...page.sessions);
      pageCount += 1;
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(pageCount).toBe(3);
    expect(sessions).toHaveLength(105);
    expect(new Set(sessions.map((item) => item.sessionId)).size).toBe(105);
    expect(sessions.some((item) => item.sessionId === "admin-104")).toBe(true);
    await expect(store!.listSessionsPage(offering.offeringId, 40, "wrong"))
      .rejects.toThrow("PROGRAM_SESSION_CURSOR_INVALID");
    await expect(store!.listSessionsPage(offering.offeringId, 0))
      .rejects.toThrow("PROGRAM_SESSION_PAGE_LIMIT_INVALID");
  });

  it("keeps asynchronous workshops free of live-session assumptions", async () => {
    const suffix = randomUUID();
    const offering = await store!.upsertOffering({
      tenantId: "seres-de-excelencia",
      programId: `low-cost-${suffix}`,
      cohortKey: "evergreen",
      title: "Taller Evergreen",
      deliveryMode: "asynchronous",
      timezone: "America/Bogota",
    });

    await expect(
      store!.scheduleSession(offering.offeringId, {
        title: "Should not exist",
        startsAt: "2026-10-20T23:00:00Z",
        durationMinutes: 60,
      }),
    ).rejects.toThrow("ASYNCHRONOUS_OFFERING_HAS_NO_LIVE_SESSIONS");
  });
});
