import { firebaseAuth } from "./firebase-client";
import type {
  LiveProgramSession,
  ProgramDeliveryMode,
} from "./program-delivery";

export interface LearnerScheduledSession {
  offeringId: string;
  programId: string;
  offeringTitle: string;
  deliveryMode: ProgramDeliveryMode;
  timezone: string;
  session: LiveProgramSession;
}

export async function fetchLearnerSchedule(): Promise<
  LearnerScheduledSession[] | undefined
> {
  const user = firebaseAuth.currentUser;
  if (!user) return undefined;

  const response = await fetch("/api/programs/my-schedule", {
    cache: "no-store",
    headers: {
      authorization: `Bearer ${await user.getIdToken()}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`PROGRAM_SCHEDULE_FAILED_${response.status}`);
  }

  const body = (await response.json()) as {
    schedule?: LearnerScheduledSession[];
  };
  return Array.isArray(body.schedule) ? body.schedule : [];
}
