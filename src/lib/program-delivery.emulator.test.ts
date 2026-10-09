import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { FirestoreProgramDeliveryStore } from "./program-delivery";

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
      [{ tenantId: offering.tenantId, programId: offering.programId }],
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
      [{ tenantId: tenantA.tenantId, programId }],
      "2026-10-08T00:00:00Z",
    );

    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].offering.tenantId).toBe(tenantA.tenantId);
    expect(upcoming[0].session.joinUrl).toContain("tenant-a");
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
      [{ tenantId: target.tenantId, programId: target.programId }],
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
      [{ tenantId: offering.tenantId, programId: offering.programId }],
      "2026-10-08T00:00:00Z",
    );

    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].session.sessionId).toBe("future-session");
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
