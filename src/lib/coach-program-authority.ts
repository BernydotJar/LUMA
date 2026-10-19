import type { ProgramOffering } from "./program-delivery";
import type { LearningCoachAccess } from "./coach-access";
import type { LearningScope } from "./learning-entitlement";
import { validLearningScopeId } from "./learning-entitlement";
import { firebaseAdminFirestore } from "./firebase-admin";

/**
 * The learning Twin is tenant/program scoped, not cohort scoped. Until cohort
 * evidence is isolated, an assigned instructor can read a program only when
 * assigned to ALL offerings (including archived historical cohorts) of
 * that program. Archiving an offering does not delete program-wide Twin
 * evidence. Institution admins retain tenant-wide oversight, never global.
 */
export interface AuthorizedCoachProgram {
  tenantId: string;
  programId: string;
  offerings: ProgramOffering[];
}

export type TenantOfferingsReader = (tenantId: string) => Promise<ProgramOffering[]>;

/** Query once per API request; bounded and fail-closed until catalog pagination. */
export const readTenantCoachOfferings: TenantOfferingsReader = async (tenantId) => {
  if (!validLearningScopeId(tenantId)) throw new Error("COACH_SCOPE_REQUIRED");
  const result = await firebaseAdminFirestore.collection("programOfferings")
    .where("tenantId", "==", tenantId)
    .limit(101).get();
  if (result.size > 100) throw new Error("COACH_PROGRAM_CATALOG_TOO_LARGE");
  return result.docs.map((doc) => doc.data() as ProgramOffering)
    .filter((item) => item.tenantId === tenantId &&
      validLearningScopeId(item.programId) && typeof item.offeringId === "string");
};

export function authorizedCoachPrograms(
  access: LearningCoachAccess,
  uid: string,
  tenantId: string,
  offerings: readonly ProgramOffering[],
): AuthorizedCoachProgram[] {
  const hasTenantAccess = access.unrestricted || access.tenantIds.includes(tenantId);
  if (!hasTenantAccess || !uid) return [];
  const programs = new Map<string, ProgramOffering[]>();
  for (const offering of offerings) {
    if (offering.tenantId !== tenantId || !validLearningScopeId(offering.programId)) continue;
    const group = programs.get(offering.programId) ?? [];
    group.push(offering);
    programs.set(offering.programId, group);
  }
  const isAdmin = access.unrestricted || access.institutionalAdmin === true;
  return [...programs.entries()]
    .filter(([, group]) => group.some((offering) => offering.status === "active") &&
      (isAdmin || group.every((offering) =>
      Array.isArray(offering.coachIds) && offering.coachIds.includes(uid))))
    .map(([programId, group]) => ({ tenantId, programId, offerings: group }))
    .sort((a, b) => a.programId.localeCompare(b.programId));
}

/** Fresh database assignment is mandatory for every entitled-mode read. */
export async function requireCoachProgramGrant(
  access: LearningCoachAccess,
  coachUid: string,
  scope: LearningScope,
  readOfferings: TenantOfferingsReader = readTenantCoachOfferings,
): Promise<LearningCoachAccess> {
  const allOfferings = await readOfferings(scope.tenantId);
  const permitted = authorizedCoachPrograms(access, coachUid, scope.tenantId, allOfferings)
    .find((item) => item.programId === scope.programId);
  if (!permitted) throw new Error("COACH_SCOPE_REQUIRED");
  if (access.unrestricted || access.institutionalAdmin === true) return access;
  // A server-derived allow-list; never parsed from Firebase custom claims,
  // headers, browser storage or any client-controlled field.
  return {
    ...access,
    authorizedOfferingIds: permitted.offerings.map((item) => item.offeringId),
  };
}
