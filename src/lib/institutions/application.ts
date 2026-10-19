/** An application requests HUMAN institutional onboarding; it grants no privileges. */
export type AcademyDeliveryMode = "live" | "evergreen" | "hybrid";
export type AcademyLearnerRange = "1-50" | "51-200" | "201-1000" | "1000+";
export type AcademyContactRole = "owner" | "director" | "academic";
export type AcademyApplicationStatus =
  | "received" | "in_review" | "invitation_pending" | "invitation_accepted" | "activated" | "rejected";

export interface AcademyApplicationInput {
  organizationName: string;
  countryCode: string;
  timezone: string;
  deliveryMode: AcademyDeliveryMode;
  learnerRange: AcademyLearnerRange;
  contactRole: AcademyContactRole;
}

export interface AcademyApplicationRecord extends AcademyApplicationInput {
  applicationId: string;
  applicantUid: string;
  applicantEmail: string;
  status: AcademyApplicationStatus;
  createdAt: string;
  updatedAt: string;
  /** UTC ISO instant, indexable for governed deletion; not a guarantee of automatic TTL. */
  retentionExpiresAt?: string;
  tenantId?: string;
  initialProgramId?: string;
  firstReviewerUid?: string;
  firstReviewedAt?: string;
  secondReviewerUid?: string;
  invitationIssuedAt?: string;
  invitationAcceptedAt?: string;
  activatedAt?: string;
  activationAuditId?: string;
}

export function parseAcademyApplication(input: unknown): AcademyApplicationInput {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.getPrototypeOf(input) !== Object.prototype) {
    throw new Error("APPLICATION_INPUT_INVALID");
  }
  const raw = input as Record<string, unknown>;
  const fields = ["organizationName", "countryCode", "timezone", "deliveryMode", "learnerRange", "contactRole"];
  if (Object.keys(raw).length !== fields.length ||
      Object.keys(raw).some((key) => !fields.includes(key))) {
    throw new Error("APPLICATION_INPUT_INVALID");
  }
  if (typeof raw.organizationName !== "string" ||
      raw.organizationName !== raw.organizationName.trim() ||
      raw.organizationName.length < 2 || raw.organizationName.length > 100 ||
      /[\u0000-\u001f\u007f<>]/.test(raw.organizationName)) {
    throw new Error("APPLICATION_INPUT_INVALID");
  }
  if (typeof raw.countryCode !== "string" || !/^[A-Z]{2}$/.test(raw.countryCode)) {
    throw new Error("APPLICATION_INPUT_INVALID");
  }
  if (typeof raw.timezone !== "string" || raw.timezone.length > 80) {
    throw new Error("APPLICATION_INPUT_INVALID");
  }
  try { new Intl.DateTimeFormat("en", { timeZone: raw.timezone }); }
  catch { throw new Error("APPLICATION_INPUT_INVALID"); }
  if (!["live", "evergreen", "hybrid"].includes(String(raw.deliveryMode)) ||
      !["1-50", "51-200", "201-1000", "1000+"].includes(String(raw.learnerRange)) ||
      !["owner", "director", "academic"].includes(String(raw.contactRole))) {
    throw new Error("APPLICATION_INPUT_INVALID");
  }
  return {
    organizationName: raw.organizationName,
    countryCode: raw.countryCode,
    timezone: raw.timezone,
    deliveryMode: raw.deliveryMode as AcademyDeliveryMode,
    learnerRange: raw.learnerRange as AcademyLearnerRange,
    contactRole: raw.contactRole as AcademyContactRole,
  };
}

export function matchesExistingAcademyApplication(
  existing: AcademyApplicationRecord,
  requested: AcademyApplicationInput,
): boolean {
  return (Object.keys(requested) as (keyof AcademyApplicationInput)[])
    .every((key) => existing[key] === requested[key]);
}
