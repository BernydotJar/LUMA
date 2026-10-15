/**
 * This preference is a display choice, not a permission. Every API endpoint
 * MUST independently verify the selected program against live entitlements.
 */
export type ProgramAudience = "learner" | "coach";

export interface SelectableProgram {
  tenantId: string;
  programId: string;
  title: string;
  offeringId?: string;
  deliveryMode?: "asynchronous" | "live" | "hybrid";
  publishedOfferingAvailable?: boolean;
}

export function selectedProgramStorageKey(audience: ProgramAudience, uid: string): string {
  return "luma-selected-program:" + audience + ":" + uid;
}

export function readSelectedProgram(audience: ProgramAudience, uid: string): string | null {
  if (typeof window === "undefined" || !uid) return null;
  try {
    const value = window.localStorage.getItem(selectedProgramStorageKey(audience, uid));
    return value && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveSelectedProgram(
  audience: ProgramAudience, uid: string, programId: string,
): void {
  if (typeof window === "undefined" || !uid) return;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(programId)) return;
  try {
    window.localStorage.setItem(selectedProgramStorageKey(audience, uid), programId);
  } catch {
    // Storage is an optional preference, not a permission or app requirement.
  }
}
