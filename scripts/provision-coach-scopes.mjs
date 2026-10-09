#!/usr/bin/env node
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const HELP = `Usage: node scripts/provision-coach-scopes.mjs --project <firebase-project> --uid <coach-uid> [--tenant-id <tenant>] [--learner-id <learner>] [--apply]

Safely add explicit scope to an existing Firebase coach account.
Without --apply this is a dry-run; no claims are modified.
Specify at least one tenant or learner ID. Existing custom claims are preserved.
Run --apply only after confirming the project's identity and assignments.`;

function parse(argv) {
  const result = { project: "", uid: "", tenants: [], learners: [], apply: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") return null;
    if (arg === "--apply") { result.apply = true; continue; }
    if (!["--project", "--uid", "--tenant-id", "--learner-id"].includes(arg)) throw new Error(`Unknown option: ${arg}`);
    const value = argv[++index];
    if (!value || value.startsWith("--") || value.length > 160) throw new Error(`Invalid value for ${arg}`);
    if (arg === "--project") result.project = value;
    if (arg === "--uid") result.uid = value;
    if (arg === "--tenant-id") result.tenants.push(value);
    if (arg === "--learner-id") result.learners.push(value);
  }
  if (!result.project || !result.uid || (!result.tenants.length && !result.learners.length)) {
    throw new Error("Explicit --project, --uid, and at least one scope are required");
  }
  return result;
}

function claimsList(value) {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

async function main() {
  const options = parse(process.argv.slice(2));
  if (!options) { console.log(HELP); return; }
  const app = initializeApp({ projectId: options.project }, `coach-claims-${process.pid}`);
  try {
    const auth = getAuth(app);
    const user = await auth.getUser(options.uid);
    const original = user.customClaims ?? {};
    const coachTenantIds = [...new Set([...claimsList(original.coachTenantIds), ...options.tenants])].sort();
    const coachLearnerIds = [...new Set([...claimsList(original.coachLearnerIds), ...options.learners])].sort();
    const next = { ...original, coach: true, coachTenantIds, coachLearnerIds };
    if (Buffer.byteLength(JSON.stringify(next), "utf8") > 1000) {
      throw new Error("Firebase custom claims would exceed 1000 bytes; reduce scope before applying");
    }
    if (options.apply) await auth.setCustomUserClaims(options.uid, next);
    console.log(JSON.stringify({
      project: options.project, uid: options.uid, mode: options.apply ? "applied" : "dry-run",
      coach: true, coachTenantIds, coachLearnerIds,
      note: options.apply ? "Refresh the coach ID token before using the scoped APIs" : "No changes made; add --apply after review",
    }, null, 2));
  } finally {
    await deleteApp(app);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
