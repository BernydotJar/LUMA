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
      [offering.programId],
      "2026-10-08T00:00:00Z",
    );

    expect(session.recordingPolicy).toBe("none");
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].offering.deliveryMode).toBe("live");
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
