import type { Firestore } from "firebase-admin/firestore";
import {
  applyEventToPersistentLearner,
  createPersistentLearnerRecord,
  type PersistedLearnerRecord,
} from "./persistent-learning";
import { createAdaptiveLearningPlanFromState, type StoredLearningEvent, type StoredOnboardingState } from "./learner-projection";

export interface LearningStoreResult {
  record: PersistedLearnerRecord;
  duplicate: boolean;
  plan: ReturnType<typeof createAdaptiveLearningPlanFromState>;
}

export class FirestoreLearningStore {
  constructor(private readonly firestore: Firestore) {}

  private learnerRef(learnerId: string) {
    return this.firestore.collection("learners").doc(learnerId);
  }

  async get(learnerId: string): Promise<LearningStoreResult | undefined> {
    const snapshot = await this.learnerRef(learnerId).get();
    if (!snapshot.exists) return undefined;

    const record = snapshot.data() as PersistedLearnerRecord;
    return {
      record,
      duplicate: false,
      plan: createAdaptiveLearningPlanFromState(record.state, record.onboarding),
    };
  }

  async bootstrap(
    learnerId: string,
    onboarding: StoredOnboardingState,
  ): Promise<LearningStoreResult> {
    const result = createPersistentLearnerRecord(learnerId, onboarding);
    await this.learnerRef(learnerId).set(result.record);

    return {
      record: result.record,
      duplicate: false,
      plan: result.plan,
    };
  }

  async appendEvent(
    learnerId: string,
    eventId: string,
    event: StoredLearningEvent,
  ): Promise<LearningStoreResult> {
    const learnerRef = this.learnerRef(learnerId);
    const eventRef = learnerRef.collection("events").doc(eventId);

    return this.firestore.runTransaction(async (transaction) => {
      const [eventSnapshot, learnerSnapshot] = await Promise.all([
        transaction.get(eventRef),
        transaction.get(learnerRef),
      ]);

      if (!learnerSnapshot.exists) {
        throw new Error("LEARNER_NOT_FOUND");
      }

      const current = learnerSnapshot.data() as PersistedLearnerRecord;
      if (eventSnapshot.exists) {
        return {
          record: current,
          duplicate: true,
          plan: createAdaptiveLearningPlanFromState(current.state, current.onboarding),
        };
      }

      const applied = applyEventToPersistentLearner(current, eventId, event);
      transaction.set(eventRef, {
        ...event,
        eventId,
        learnerId,
        journeyId: current.journeyId,
        recordedAt: applied.record.updatedAt,
      });
      transaction.set(learnerRef, applied.record);

      return {
        record: applied.record,
        duplicate: false,
        plan: applied.plan,
      };
    });
  }
}
