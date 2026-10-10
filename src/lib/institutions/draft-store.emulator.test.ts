import { randomUUID, createHash } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { parseDraftBrandInput, parseDraftCreateInput } from "./draft-input";
import { FirestoreInstitutionDraftStore } from "./draft-store";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST &&
  process.env.GCLOUD_PROJECT?.startsWith("demo-"));
const app = enabled ? initializeApp(
  { projectId: process.env.GCLOUD_PROJECT },
  "gruv-draft-store-" + randomUUID(),
) : null;
const firestore = app ? getFirestore(app) : null;
const store = firestore ? new FirestoreInstitutionDraftStore(firestore) : null;
const tenantId = () => "tenant-" + randomUUID();
const uid = () => "admin-" + randomUUID();
const reqId = () => "gruv-request-" + randomUUID();
const create = (tenant: string, requestId: string) => parseDraftCreateInput(tenant, {
  templateId: "gruv-languages", programIds: ["english-work"], expectedVersion: 0,
  reasonCode: "institution-onboarding", requestId,
});
const update = (tenant: string, requestId: string, name = "GRUV Academy") => parseDraftBrandInput(tenant, {
  expectedVersion: 1, requestId, reasonCode: "brand-update",
  brand: { displayName: name, shortName: "GRUV", palette: ["#FFFFFF", "#111111"] },
});

describe.runIf(enabled)("Firestore institution draft transactional contract", () => {
  afterAll(async () => { if (app) await deleteApp(app); });

  it("keeps each draft isolated and fails closed on missing tenants", async () => {
    const a = tenantId(); const b = tenantId(); const actor = uid();
    await store!.createDraft(create(a, reqId()), actor);
    expect((await store!.getDraftForTenant(a))?.config).toMatchObject({
      tenantId: a, shellId: "gruv-languages", configVersion: 1,
    });
    expect(await store!.getDraftForTenant(b)).toBeNull();
    expect((store as unknown as Record<string, unknown>).getByTenantId).toBeUndefined();
  });

  it("records each revision once, replays the exact request and denies altered reuse", async () => {
    const tenant = tenantId(); const actor = uid(); const initialRequestId = reqId();
    const creation = create(tenant, initialRequestId);
    expect(await store!.createDraft(creation, actor)).toMatchObject({ appliedVersion: 1, duplicate: false });
    expect(await store!.createDraft(creation, actor)).toMatchObject({ appliedVersion: 1, duplicate: true });
    await expect(store!.createDraft(creation, uid())).rejects.toThrow("INSTITUTION_DRAFT_REQUEST_REUSE_CONFLICT");
    const patchId = reqId(); const input = update(tenant, patchId);
    expect(await store!.updateDraftBrand(input, actor)).toMatchObject({ appliedVersion: 2, duplicate: false });
    expect(await store!.updateDraftBrand(input, actor)).toMatchObject({ appliedVersion: 2, duplicate: true });
    await expect(store!.updateDraftBrand(update(tenant, patchId, "Different Brand"), actor))
      .rejects.toThrow("INSTITUTION_DRAFT_REQUEST_REUSE_CONFLICT");
    const record = (await store!.getDraftForTenant(tenant))!;
    expect(record.config.configVersion).toBe(2);
    expect(record.config.shellId).toBe("gruv-languages");
    expect(record.config.programIds).toEqual(["english-work"]);
    expect(record.config.features.commerce).toBe(false);
    const doc = firestore!.collection("institutionConfigDrafts")
      .doc(createHash("sha256").update(tenant).digest("hex"));
    const audit = await doc.collection("audit").get();
    expect(audit.size).toBe(2);
    expect(audit.docs.map(d => d.data().appliedVersion).sort()).toEqual([1, 2]);
  });

  it("prevents lost updates when concurrent writers start from the same version", async () => {
    const tenant = tenantId(); const actor = uid();
    await store!.createDraft(create(tenant, reqId()), actor);
    const [a, b] = await Promise.allSettled([
      store!.updateDraftBrand(update(tenant, reqId(), "Brand Alpha"), actor),
      store!.updateDraftBrand(update(tenant, reqId(), "Brand Beta"), actor),
    ]);
    expect([a.status, b.status].sort()).toEqual(["fulfilled", "rejected"]);
    const failed = a.status === "rejected" ? a.reason : (b as PromiseRejectedResult).reason;
    expect(String(failed)).toContain("INSTITUTION_DRAFT_VERSION_CONFLICT");
    expect((await store!.getDraftForTenant(tenant))?.config.configVersion).toBe(2);
  });

  it("never reads corrupt cross-tenant documents as the requested tenant", async () => {
    const a = tenantId(); const b = tenantId(); const actor = uid();
    await store!.createDraft(create(a, reqId()), actor);
    const doc = firestore!.collection("institutionConfigDrafts")
      .doc(createHash("sha256").update(a).digest("hex"));
    await doc.update({ "config.tenantId": b });
    await expect(store!.getDraftForTenant(a)).rejects.toThrow("INSTITUTION_DRAFT_CORRUPT");
  });

  it("rejects forged internal requests even when TypeScript types are bypassed", async () => {
    const tenant = tenantId(); const actor = uid();
    const valid = create(tenant, reqId());
    await expect(store!.createDraft({ ...valid, requestId: "short" }, actor))
      .rejects.toThrow("INSTITUTION_DRAFT_REQUEST_ID_INVALID");
    await expect(store!.createDraft({ ...valid, programIds: ["../outside"] }, actor))
      .rejects.toThrow("INSTITUTION_DRAFT_PROGRAMS_INVALID");
    await store!.createDraft(valid, actor);
    const patch = update(tenant, reqId());
    await expect(store!.updateDraftBrand({ ...patch, brand: { ...patch.brand, palette: ["bad"] } }, actor))
      .rejects.toThrow("INSTITUTION_DRAFT_PALETTE_INVALID");
    await expect(store!.updateDraftBrand({ ...patch, requestId: "short" }, actor))
      .rejects.toThrow("INSTITUTION_DRAFT_REQUEST_ID_INVALID");
  });

  it("distinguishes missing records and rejects writes with stale versions", async () => {
    const tenant = tenantId(); const actor = uid();
    await expect(store!.updateDraftBrand(update(tenant, reqId()), actor))
      .rejects.toThrow("INSTITUTION_DRAFT_NOT_FOUND");
    await store!.createDraft(create(tenant, reqId()), actor);
    await expect(store!.createDraft(create(tenant, reqId()), actor))
      .rejects.toThrow("INSTITUTION_DRAFT_VERSION_CONFLICT");
    await store!.updateDraftBrand(update(tenant, reqId()), actor);
    await expect(store!.updateDraftBrand(update(tenant, reqId()), actor))
      .rejects.toThrow("INSTITUTION_DRAFT_VERSION_CONFLICT");
  });
});
