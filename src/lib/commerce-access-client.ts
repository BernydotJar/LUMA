import { firebaseAuth } from "./firebase-client";

/** Claim only via verified Firebase identity. No input email can impersonate another buyer. */
export async function claimEntitledPrograms(): Promise<{ programId: string; status: string }[]> {
  const user = firebaseAuth.currentUser;
  if (!user) return [];
  const response = await fetch("/api/commerce/access", {
    cache: "no-store",
    headers: { authorization: `Bearer ${await user.getIdToken()}` },
  });
  if (!response.ok) throw new Error(`COURSE_ACCESS_${response.status}`);
  const data = await response.json() as { enrollments: { programId: string; status: string }[] };
  return data.enrollments;
}
