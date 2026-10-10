import { createHash } from "node:crypto";

const TENANT = /^[A-Za-z0-9_-]{1,128}$/;
const PROJECT = /^[a-z][a-z0-9-]{5,62}$/;
const UID = /^[^/\\\x00-\x1f\x7f]{1,128}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sortedTenants(values) {
  const entries = Array.isArray(values) ? values : typeof values === "string" ? [values] : [];
  if (entries.some(value => typeof value !== "string" || !TENANT.test(value))) {
    throw new Error("TENANT_SCOPE_INVALID");
  }
  return [...new Set(entries)].sort();
}
function legacyTenants(claims) {
  const scope = [claims.tenantId, claims.tenantIds].flatMap(value =>
    value === undefined ? [] : sortedTenants(value));
  return sortedTenants(scope);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

export function planTenantAdminClaims(prior, action, tenantIds) {
  if (!prior || typeof prior !== "object" || Array.isArray(prior)) {
    throw new Error("ADMIN_CLAIMS_INVALID");
  }
  if (prior.superuser === true || prior.role === "superuser") {
    throw new Error("SUPERUSER_CLAIMS_NOT_MANAGED_BY_THIS_TOOL");
  }
  if (!["grant", "revoke"].includes(action)) throw new Error("ADMIN_ACTION_INVALID");
  const requested = sortedTenants(tenantIds);
  if (!requested.length) throw new Error("TENANT_SCOPE_REQUIRED");
  const dedicated = Object.prototype.hasOwnProperty.call(prior, "adminTenantIds");
  const alreadyAdmin = prior.admin === true || prior.role === "admin";
  const beforeTenants = dedicated ? sortedTenants(prior.adminTenantIds) :
    alreadyAdmin ? legacyTenants(prior) : [];

  const afterTenants = action === "grant" ?
    sortedTenants([...beforeTenants, ...requested]) :
    beforeTenants.filter(tenant => !requested.includes(tenant));
  if (action === "revoke" && requested.some(t => !beforeTenants.includes(t))) {
    throw new Error("TENANT_SCOPE_NOT_ASSIGNED");
  }
  const next = { ...prior, adminTenantIds: afterTenants };
  if (afterTenants.length) {
    next.admin = true;
  } else {
    delete next.admin;
    if (next.role === "admin") delete next.role;
  }
  if (Buffer.byteLength(JSON.stringify(next), "utf8") > 1_000) {
    throw new Error("FIREBASE_CUSTOM_CLAIMS_LIMIT_EXCEEDED");
  }
  return {
    action, requested, beforeTenants, afterTenants,
    next,
    changed: JSON.stringify(canonical(prior)) !== JSON.stringify(canonical(next)),
  };
}

export function computeTenantAdminPlanHash(input) {
  return createHash("sha256").update(JSON.stringify(canonical(input))).digest("hex");
}

export function parseTenantAdminCli(args) {
  const opts = {
    project: "", uid: "", mode: "", tenantIds: [], apply: false,
    confirmProject: "", confirmEmail: "", planSha: "", operator: "", reason: "",
  };
  const flagMap = {
    "--project": "project", "--uid": "uid", "--action": "mode",
    "--tenant-id": "tenantIds", "--confirm-project": "confirmProject",
    "--confirm-email": "confirmEmail", "--plan-sha": "planSha",
    "--operator": "operator", "--reason": "reason",
  };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--help" || flag === "-h") return null;
    if (flag === "--apply") {
      if (opts.apply) throw new Error("ADMIN_DUPLICATE_FLAG");
      opts.apply = true; continue;
    }
    const key = flagMap[flag];
    if (!key) throw new Error("ADMIN_UNKNOWN_FLAG");
    const value = args[++i];
    if (!value || value.startsWith("--") || value.length > 600) throw new Error("ADMIN_ARG_INVALID");
    if (key !== "tenantIds" && seen.has(key)) throw new Error("ADMIN_DUPLICATE_FLAG");
    seen.add(key);
    if (key === "tenantIds") opts.tenantIds.push(value);
    else opts[key] = value;
  }
  if (!PROJECT.test(opts.project) || !UID.test(opts.uid)) throw new Error("ADMIN_TARGET_INVALID");
  if (!["grant", "revoke"].includes(opts.mode)) throw new Error("ADMIN_ACTION_INVALID");
  opts.tenantIds = sortedTenants(opts.tenantIds);
  if (!opts.tenantIds.length) throw new Error("TENANT_SCOPE_REQUIRED");
  if (!EMAIL.test(opts.operator) || opts.operator.length > 254) throw new Error("ADMIN_OPERATOR_INVALID");
  if (opts.reason.trim().length < 20 || opts.reason.length > 500) throw new Error("ADMIN_REASON_INVALID");
  if (opts.apply) {
    if (opts.confirmProject !== opts.project ||
        !EMAIL.test(opts.confirmEmail) || !/^[a-f0-9]{64}$/.test(opts.planSha)) {
      throw new Error("ADMIN_APPLY_CONFIRMATION_REQUIRED");
    }
  }
  return opts;
}
