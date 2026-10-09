import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { ProgramOffering } from "@/lib/program-delivery";
import { publicCertificateState } from "./domain";

const providers = vi.hoisted(() => ({
  getUser: vi.fn(),
  listByLearner: vi.fn(),
  loadConfig: vi.fn(),
  sign: vi.fn(),
  bucket: vi.fn(),
}));

vi.mock("@/lib/firebase-admin", () => ({
  firebaseAdminAuth: { getUser: providers.getUser },
}));
vi.mock("@/lib/commerce/server", () => ({
  commerceEnrollments: { listByLearner: providers.listByLearner },
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: providers.bucket }),
}));
vi.mock("./stirling", () => ({
  loadStirlingConfig: providers.loadConfig,
  signCertificateWithStirling: providers.sign,
}));
vi.mock("./pdf", () => ({
  certificateBaseUrl: () => "https://luma.example.org",
  renderCertificatePdf: async () => Buffer.from("%PDF-1.4\n" + "A".repeat(400)),
}));
vi.mock("./docusign", () => ({
  sendForSignature: vi.fn(), downloadSignedEnvelope: vi.fn(),
}));

import { CertificateService } from "./service";

class TestFirestore {
  data = new Map<string, Record<string, unknown>>();
  collection(name: string) { return new TestCollection(this, name); }
  async runTransaction<T>(fn: (tx: {
    get: (doc: TestDoc) => ReturnType<TestDoc["get"]>;
    create: (doc: TestDoc, data: Record<string, unknown>) => void;
    update: (doc: TestDoc, data: Record<string, unknown>) => void;
  }) => Promise<T>): Promise<T> {
    const writes: Array<() => void> = [];
    const result = await fn({
      get: doc => doc.get(),
      create: (doc, data) => writes.push(() => {
        if (this.data.has(doc.path)) throw new Error("already exists");
        this.data.set(doc.path, structuredClone(data));
      }),
      update: (doc, data) => writes.push(() => {
        const current = this.data.get(doc.path);
        if (!current) throw new Error("missing");
        this.data.set(doc.path, { ...current, ...structuredClone(data) });
      }),
    });
    writes.forEach(w => w());
    return result;
  }
}
class TestCollection {
  constructor(private readonly fs: TestFirestore, private readonly name: string) {}
  doc(id: string) { return new TestDoc(this.fs, this.name + "/" + id); }
  async add(data: Record<string, unknown>) {
    const id = "event-" + Math.random().toString(36).slice(2);
    return this.doc(id).set(data);
  }
}
class TestDoc {
  constructor(readonly fs: TestFirestore, readonly path: string) {}
  get() {
    const found = this.fs.data.get(this.path);
    return Promise.resolve({ exists: Boolean(found), data: () => found ? structuredClone(found) : undefined });
  }
  async set(value: Record<string, unknown>) { this.fs.data.set(this.path, structuredClone(value)); }
  async update(value: Record<string, unknown>) {
    const before = this.fs.data.get(this.path);
    if (!before) throw new Error("not found");
    this.fs.data.set(this.path, { ...before, ...structuredClone(value) });
  }
  collection(name: string) { return new TestCollection(this.fs, this.path + "/" + name); }
}

const issuer = {
  tenantId: "seres",
  legalName: "Seres de Excelencia",
  signerName: "Dirección Académica",
  signerEmail: "academic@example.com",
  institutionalSigningAuthorized: true,
};
const coach = {
  uid: "coach-a",
  access: { unrestricted: false, tenantIds: ["seres"], learnerIds: [] },
};
const originalStatus = process.env.CERTIFICATE_SIGNING_PROVIDER;
const originalBucket = process.env.CERTIFICATE_STORAGE_BUCKET;
let firestore: TestFirestore;
let storage: Map<string, Buffer>;
let service: CertificateService;
let signingPdf: Buffer;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CERTIFICATE_SIGNING_PROVIDER = "stirling";
  process.env.CERTIFICATE_STORAGE_BUCKET = "luma-certificate-test-bucket";
  firestore = new TestFirestore();
  storage = new Map<string, Buffer>();
  service = new CertificateService(firestore as unknown as Firestore);
  const offering: ProgramOffering = {
    offeringId: "offering-a", tenantId: "seres", programId: "leadership",
    cohortKey: "2026", title: "Programa de Liderazgo",
    deliveryMode: "live", timezone: "America/Guatemala",
    status: "active", coachIds: ["coach-a"],
    createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-09T00:00:00Z",
  };
  firestore.data.set("programOfferings/offering-a", offering as unknown as Record<string, unknown>);
  providers.getUser.mockResolvedValue({ emailVerified: true, displayName: "Alias editable" });
  providers.listByLearner.mockResolvedValue([{
    tenantId: "seres", offeringId: "offering-a", programId: "leadership", status: "active",
  }]);
  providers.loadConfig.mockResolvedValue({ tenantId: "seres", issuerLegalName: "Seres de Excelencia" });
  signingPdf = Buffer.from("%PDF-1.4\n" + "S".repeat(460));
  providers.sign.mockImplementation(async (record: { certificateId: string; tenantId: string }) => {
    const hash = createHash("sha256").update(signingPdf).digest("hex");
    return {
      signedPdf: signingPdf, signedSha256: hash,
      signedAt: "2026-10-09T20:00:00Z",
      evidence: {
        schemaVersion: 1, provider: "stirling", certificateId: record.certificateId,
        tenantId: record.tenantId, signedSha256: hash,
        signerCertificateSerial: "a1b2", revocationStatus: "good",
      },
    };
  });
  providers.bucket.mockReturnValue({
    file: (path: string) => ({
      save: async (bytes: Buffer) => { storage.set(path, Buffer.from(bytes)); },
      download: async () => [storage.get(path)],
    }),
  });
});

afterEach(() => {
  if (originalStatus === undefined) delete process.env.CERTIFICATE_SIGNING_PROVIDER;
  else process.env.CERTIFICATE_SIGNING_PROVIDER = originalStatus;
  if (originalBucket === undefined) delete process.env.CERTIFICATE_STORAGE_BUCKET;
  else process.env.CERTIFICATE_STORAGE_BUCKET = originalBucket;
});

const rationale = "Se comprobaron las competencias y evidencias académicas exigidas para finalizar este programa.";

async function approve() {
  return service.approveCompletion(coach, {
    offeringId: "offering-a", learnerId: "learner-a",
    learnerLegalName: "María Fernández", identityConfirmed: true,
    rationale, evidenceEventIds: [],
  });
}

describe("institutional signing transaction integration", () => {
  it("rejects unauthorized automatic signing before reserving a credential", async () => {
    await service.configureIssuer({ ...issuer, institutionalSigningAuthorized: false }, "admin-a");
    await approve();
    await expect(service.issue(coach, { offeringId: "offering-a", learnerId: "learner-a" }))
      .rejects.toThrow("CERTIFICATE_INSTITUTIONAL_SIGNING_NOT_AUTHORIZED");
    expect([...firestore.data.keys()].filter(k => k.startsWith("academicCertificates/")))
      .toHaveLength(0);
  });

  it("signs exactly once, archives signed PDF and evidence and enforces idempotency", async () => {
    await service.configureIssuer(issuer, "admin-a");
    await approve();
    const first = await service.issue(coach, { offeringId: "offering-a", learnerId: "learner-a" });
    expect(first.provider).toBe("stirling");
    expect(first.status).toBe("signed");
    expect(first.learnerName).toBe("María Fernández");
    expect(first.learnerName).not.toBe("Alias editable");
    expect(first.signerCertificateSerial).toBe("a1b2");
    expect(await service.pdfForLearner(first.certificateId, "learner-a")).toEqual(signingPdf);
    await expect(service.pdfForLearner(first.certificateId, "another-user"))
      .rejects.toThrow("CERTIFICATE_NOT_ACCESSIBLE");
    expect(storage.has(first.evidenceStoragePath!)).toBe(true);
    const second = await service.issue(coach, { offeringId: "offering-a", learnerId: "learner-a" });
    expect(second.certificateId).toBe(first.certificateId);
    expect(providers.sign).toHaveBeenCalledTimes(1);
    expect(publicCertificateState(first)?.status).toBe("valid");
  });

  it("does not publish signature failure and will not automatically retry a failed issuance", async () => {
    await service.configureIssuer(issuer, "admin-a");
    await approve();
    providers.sign.mockRejectedValueOnce(new Error("STIRLING_UNREACHABLE"));
    await expect(service.issue(coach, { offeringId: "offering-a", learnerId: "learner-a" }))
      .rejects.toThrow("STIRLING_UNREACHABLE");
    const next = await service.issue(coach, { offeringId: "offering-a", learnerId: "learner-a" });
    expect(next.status).toBe("failed");
    expect(publicCertificateState(next)).toBeNull();
    expect(providers.sign).toHaveBeenCalledTimes(1);
  });

  it("preserves signed evidence but marks a revoked credential invalid", async () => {
    await service.configureIssuer(issuer, "admin-a");
    await approve();
    const first = await service.issue(coach, { offeringId: "offering-a", learnerId: "learner-a" });
    const revoked = await service.revoke(first.certificateId, "admin-a",
      "La institución comprobó una inconsistencia de identidad académica.");
    expect(revoked.status).toBe("revoked");
    expect(publicCertificateState(revoked)?.status).toBe("revoked");
    expect(storage.has(first.signedStoragePath!)).toBe(true);
  });

  it("rejects an instructor outside the correct tenant/cohort", async () => {
    await service.configureIssuer(issuer, "admin-a");
    await expect(service.approveCompletion({
      uid: "coach-b", access: { unrestricted: false, tenantIds: ["seres"], learnerIds: [] },
    }, {
      offeringId: "offering-a", learnerId: "learner-a",
      learnerLegalName: "María Fernández", identityConfirmed: true,
      rationale, evidenceEventIds: [],
    })).rejects.toThrow("CERTIFICATE_FORBIDDEN");
  });
});
