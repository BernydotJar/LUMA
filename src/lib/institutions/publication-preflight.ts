import { createHash } from "node:crypto";
import { assertInstitutionConfig, type InstitutionConfig } from "./config";
import { parseDraftTenantId } from "./draft-input";
import type { FirestoreInstitutionDraftStore } from "./draft-store";
import type { ScopedOfferingReader } from "./offering-reader";

export type ProgramInspectionCode =
  | "NO_ACTIVE_OFFERING"
  | "OFFERING_LIMIT_EXCEEDED"
  | "OFFERING_DATA_INVALID";

export interface ProgramInspection {
  readonly programId: string;
  readonly activeOfferings: number;
  readonly localStatus: "pass" | "blocked";
  readonly blockers: readonly ProgramInspectionCode[];
}

export interface InstitutionPublicationPreflight {
  readonly tenantId: string;
  readonly configVersion: number;
  readonly shellId: InstitutionConfig["shellId"];
  readonly observedAt: string;
  readonly inspectionDigest: string;
  readonly localChecksPassed: boolean;
  readonly activationAllowed: false;
  readonly status: "blocked";
  readonly programs: readonly ProgramInspection[];
  readonly releaseBlockers: readonly [
    "IDENTITY_AND_MEMBERSHIP_UNVERIFIED",
    "CONTENT_AND_RAG_ISOLATION_UNVERIFIED",
    "SECURITY_AND_PRODUCTION_RELEASE_UNAPPROVED",
  ];
}

const hash = (value: unknown) => createHash("sha256")
  .update(JSON.stringify(value)).digest("hex");

/** This inspector cannot publish a tenant, authorize a learner or issue a cert. */
export class FirestoreInstitutionPublicationInspector {
  constructor(
    private readonly draftStore: Pick<FirestoreInstitutionDraftStore, "getDraftForTenant">,
    private readonly offerings: ScopedOfferingReader,
  ) {}

  async inspect(tenantId: string): Promise<InstitutionPublicationPreflight> {
    parseDraftTenantId(tenantId);
    const draft = await this.draftStore.getDraftForTenant(tenantId);
    if (!draft) throw new Error("INSTITUTION_PREFLIGHT_DRAFT_NOT_FOUND");
    if (draft.status !== "draft" || draft.config.tenantId !== tenantId) {
      throw new Error("INSTITUTION_PREFLIGHT_DRAFT_CORRUPT");
    }
    assertInstitutionConfig(draft.config);
    const programs: ProgramInspection[] = [];
    const evidence: Array<{
      programId: string;
      offerings: readonly { id: string; status: string }[];
      blockers: readonly string[];
    }> = [];

    // Do not use a collection-wide scan that can turn truncation into false readiness.
    // Queries are strictly tenant+program scoped. 51 rows detects overflow of 50.
    for (const programId of [...draft.config.programIds].sort()) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(programId)) {
        throw new Error("INSTITUTION_PREFLIGHT_DRAFT_CORRUPT");
      }
      const results = await this.offerings.listBoundedForProgram(tenantId, programId);
      const blockers: ProgramInspectionCode[] = [];
      const matched: string[] = [];
      const inspectedOfferings: Array<{ id: string; status: string }> = [];
      if (results.length > 50) {
        blockers.push("OFFERING_LIMIT_EXCEEDED");
      } else {
        for (const record of results) {
          if (record.tenantId !== tenantId || record.programId !== programId ||
              typeof record.offeringId !== "string" || record.offeringId !== record.documentId ||
              typeof record.status !== "string" ||
              !["active", "draft", "completed", "archived"].includes(record.status)) {
            blockers.push("OFFERING_DATA_INVALID");
            break;
          }
          inspectedOfferings.push({ id: record.documentId, status: record.status });
          if (record.status === "active") matched.push(record.documentId);
        }
        if (matched.length === 0 && !blockers.includes("OFFERING_DATA_INVALID")) {
          blockers.push("NO_ACTIVE_OFFERING");
        }
      }
      const unique = [...new Set(blockers)];
      const active = unique.length ? 0 : matched.length;
      programs.push({
        programId,
        activeOfferings: active,
        localStatus: unique.length ? "blocked" : "pass",
        blockers: unique,
      });
      // The advisory digest observes *all* validated status changes, including
      // draft -> archived transitions that remain locally blocked.
      evidence.push({
        programId,
        offerings: unique.includes("OFFERING_DATA_INVALID") ? [] :
          inspectedOfferings.sort((a, b) => a.id.localeCompare(b.id)),
        blockers: unique,
      });
    }
    // A local structural pass does not confer publication authorization.
    const localChecksPassed = programs.every(program => program.localStatus === "pass");
    return {
      tenantId,
      configVersion: draft.config.configVersion,
      shellId: draft.config.shellId,
      observedAt: new Date().toISOString(),
      inspectionDigest: hash({ config: draft.config, evidence }),
      localChecksPassed,
      activationAllowed: false,
      status: "blocked",
      programs,
      releaseBlockers: [
        "IDENTITY_AND_MEMBERSHIP_UNVERIFIED",
        "CONTENT_AND_RAG_ISOLATION_UNVERIFIED",
        "SECURITY_AND_PRODUCTION_RELEASE_UNAPPROVED",
      ],
    };
  }
}
