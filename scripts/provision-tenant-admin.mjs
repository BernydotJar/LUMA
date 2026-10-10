#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  computeTenantAdminPlanHash,
  parseTenantAdminCli,
  planTenantAdminClaims,
} from "./lib/tenant-admin-claims.mjs";

const HELP = `LUMA tenant-admin provisioner (existing Firebase Auth accounts only)

Dry run (read-only):
  node scripts/provision-tenant-admin.mjs --project <project> --uid <firebase-uid> \
    --action grant|revoke --tenant-id <tenant> --operator <operator-email> \
    --reason "<approved business justification>"

Apply (requires prior dry-run plan hash):
  ... --apply --confirm-project <same-project> --confirm-email <target-user-email> \
    --plan-sha <64-hex-plan-hash>

Security: verified, enabled target email required. No superuser grants, no
account creation, dry-run default. Applied changes are logged to Firestore
identityRoleAudits and require the user to refresh their Firebase ID token.
Do not run with credentials for a different Firebase project.`;

function hashClaims(claims) {
  return createHash("sha256").update(JSON.stringify(claims ?? {})).digest("hex");
}

async function main() {
  const opts = parseTenantAdminCli(process.argv.slice(2));
  if (!opts) { console.log(HELP); return; }
  const app = initializeApp({ projectId: opts.project }, "tenant-admin-"+process.pid);
  try {
    const auth = getAuth(app);
    const user = await auth.getUser(opts.uid);
    if (user.disabled || !user.email || user.emailVerified !== true) {
      throw new Error("ADMIN_TARGET_EMAIL_MUST_BE_VERIFIED_AND_ENABLED");
    }
    const email = user.email.trim().toLowerCase();
    const plan = planTenantAdminClaims(user.customClaims ?? {}, opts.mode, opts.tenantIds);
    const planHash = computeTenantAdminPlanHash({
      project: opts.project, uid: opts.uid, email,
      action: plan.action, requested: plan.requested,
      previous: user.customClaims ?? {}, next: plan.next,
    });
    const safeReport = {
      project: opts.project, targetUid: opts.uid, targetEmail: email,
      action: plan.action, requested: plan.requested,
      beforeTenants: plan.beforeTenants,
      afterTenants: plan.afterTenants,
      changed: plan.changed, planHash,
      mode: opts.apply ? "apply" : "dry-run",
    };
    if (!opts.apply) {
      console.log(JSON.stringify({
        ...safeReport,
        note: "READ ONLY. Apply with --confirm-project, --confirm-email and --plan-sha.",
      }, null, 2));
      return;
    }
    if (opts.confirmEmail.trim().toLowerCase() !== email ||
        opts.confirmProject !== opts.project ||
        opts.planSha !== planHash) {
      throw new Error("ADMIN_APPLY_PLAN_MISMATCH");
    }
    if (!plan.changed) {
      console.log(JSON.stringify({ ...safeReport, status: "unchanged" }, null, 2));
      return;
    }

    // Re-read immediately before writing, preventing accidental overwrite
    // of a different plan observed after the preview. Firebase Auth custom
    // claims do not offer CAS: serialize identity administration externally.
    const reloaded = await auth.getUser(opts.uid);
    if (reloaded.email?.trim().toLowerCase() !== email ||
        reloaded.emailVerified !== true || reloaded.disabled) {
      throw new Error("ADMIN_TARGET_CHANGED");
    }
    const again = planTenantAdminClaims(reloaded.customClaims ?? {}, opts.mode, opts.tenantIds);
    const freshHash = computeTenantAdminPlanHash({
      project: opts.project, uid: opts.uid, email,
      action: again.action, requested: again.requested,
      previous: reloaded.customClaims ?? {}, next: again.next,
    });
    if (freshHash !== planHash) throw new Error("ADMIN_CLAIMS_CHANGED_REVIEW_REQUIRED");

    // Durable intent first: in a partial failure operators can reconcile
    // whether Auth claims changed without losing why a change was attempted.
    const audit = getFirestore(app).collection("identityRoleAudits").doc(randomUUID());
    await audit.create({
      state: "intent", project: opts.project, targetUid: opts.uid,
      targetEmail: email, action: opts.mode, tenantIds: plan.requested,
      beforeTenants: plan.beforeTenants, afterTenants: plan.afterTenants,
      declaredOperator: opts.operator.toLowerCase().trim(),
      reason: opts.reason.trim(), planHash,
      oldClaimsHash: hashClaims(user.customClaims),
      intendedClaimsHash: hashClaims(plan.next),
      createdAt: new Date().toISOString(),
    });
    try {
      await auth.setCustomUserClaims(opts.uid, again.next);
    } catch (error) {
      await audit.update({
        state: "auth_update_failed", updatedAt: new Date().toISOString(),
      }).catch(() => {});
      throw error;
    }
    // Invalidate already-issued role-bearing ID tokens. Privileged LUMA routes
    // verify revocation, so removed administrators cannot keep using stale JWTs.
    try {
      await auth.revokeRefreshTokens(opts.uid);
    } catch {
      await audit.update({
        state: "claims_applied_revocation_failed",
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
      throw new Error("ADMIN_CLAIMS_APPLIED_TOKEN_REVOCATION_FAILED:" + audit.id);
    }
    // If this update fails the audit intent still exists; do not replay
    // automatically, because the Auth change may already be in effect.
    try {
      await audit.update({ state: "applied", updatedAt: new Date().toISOString() });
    } catch {
      throw new Error("ADMIN_CLAIMS_APPLIED_AUDIT_UPDATE_FAILED:" + audit.id);
    }
    console.log(JSON.stringify({
      ...safeReport, state: "applied",
      auditId: audit.id, note: "Existing role tokens invalidated. Sign in again and verify scoped API access.",
    }, null, 2));
  } finally {
    await deleteApp(app);
  }
}

main().catch(error => {
  // Do not dump SDK bodies/credentials into CI output.
  console.error(error instanceof Error ? error.message : "ADMIN_PROVISIONING_FAILED");
  process.exitCode = 1;
});
