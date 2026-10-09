/** Distinguish a genuinely empty intervention queue from unavailable backend data. */
export type CoachDataStatus = "loading" | "unavailable" | "partial" | "ready";

export function deriveCoachDataStatus(
  snapshot: {
    learners?: readonly unknown[];
    interventions?: readonly unknown[];
    error: boolean;
  } | null,
): CoachDataStatus {
  if (!snapshot) return "loading";
  const hasLearners = snapshot.learners !== undefined;
  const hasInterventions = snapshot.interventions !== undefined;
  if (!hasLearners && !hasInterventions) return "unavailable";
  if (snapshot.error || !hasLearners || !hasInterventions) return "partial";
  return "ready";
}
