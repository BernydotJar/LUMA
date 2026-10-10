# LUMA — Administración institucional segura

## Authority contract

- **Global:** only `superuser=true` / `role=superuser`. This role is never issued by this tool.
- **Tenant admin:** `admin=true` or `role=admin` plus scoped organization claims. When `adminTenantIds` exists, it is authoritative **even if empty**; legacy `tenantId` / `tenantIds` cannot regrant revoked permissions. A plain `admin=true` does not allow academic data access.
- **Coach:** assignment by coach tenant / learner and by cohort for certificate authorization. Coach claims alone do not create LiveKit instructor access for an unrelated cohort.
- The certificate service permits a verified tenant admin to manage their organization's credentials without requiring a separate coach assignment; other-tenant credentials remain inaccessible.

## Operator provisioning

The CLI uses Google ADC and Firebase Admin SDK to modify an **existing verified and enabled Firebase user**. It never creates identities or grants platform superuser rights.

Dry run (NO writes):

```bash
node scripts/provision-tenant-admin.mjs --project luma-learning-intelligence \
 --uid '<firebase-uid>' --action grant --tenant-id '<tenant>' \
 --operator 'operator@example.org' \
 --reason 'Institutional administrator assignment approved by tenant owner'
```

Review the output scopes and `planHash`. Apply only after confirming the right project, verified email and exact hash:

```bash
node scripts/provision-tenant-admin.mjs --project luma-learning-intelligence \
 --uid '<firebase-uid>' --action grant --tenant-id '<tenant>' \
 --operator 'operator@example.org' \
 --reason 'Institutional administrator assignment approved by tenant owner' \
 --apply --confirm-project luma-learning-intelligence \
 --confirm-email '<verified-user-email>' --plan-sha '<sha256-from-dry-run>'
```

For revocation use `--action revoke` in the dry-run AND the apply step. Multiple `--tenant-id` options are supported. Never manually override `adminTenantIds` with a roleless tenant header.

## Auditing and token validity

- Tool refuses superuser modification, disabled/unverified users, invalid tenant IDs and custom claims over Firebase's 1,000-byte limit.
- Writes an intent audit to `identityRoleAudits/{uuid}` BEFORE changing Firebase claims, including operator-declared identity, reason, affected tenant scopes and hashes (not credentials). It re-reads the user to detect changes after preview.
- It calls `revokeRefreshTokens` after writing claims. Privileged admin/coach APIs and classroom admission use Firebase revoked-ID-token verification. Users sign in again to receive updated permissions.
- Firebase custom claim writes are NOT compare-and-set; serialize user administration. In partial failure, audit state may be `intent` / `auth_update_failed` / `claims_applied_revocation_failed`; reconcile manually. Never retry a partially applied role update blindly.
- No real identity change has been authorized or executed as part of this source implementation.

## Acceptance required before Seres de Excelencia rollout

1. Verified test admin: apply tenant A, confirm allowed A and denied tenant B across coach, certificates, programs and classroom.
2. Revoke tenant A, confirm its old ID token is rejected and the updated account cannot exercise admin authority.
3. Verify Firestore audit, access reporting and a recovery drill.
4. Confirm independent enterprise learner-data controls: `LUMA_LEARNING_ACCESS_MODE=entitled`, scoped program/tenant storage, provider settings and real signed-in purchase or institutional entitlement. `showcase` remains a demo profile.

See `docs/enterprise/tenant-isolation-contract.md`.

## Reproducible authorization integration gate

CI includes an independent `identity-roles` job, using **only** local Auth and Firestore emulators with the `demo-luma-role-provisioning` project (no production credentials or real accounts). The integration test creates a disposable verified user, signs in, checks the server's privileged access path and denied foreign-tenant classroom admission, then revokes and verifies that the old token is invalid. It separately executes the **actual provisioning CLI** through read-only preview, plan-hash-confirmed grant and revoke, confirming Firebase custom claims and durable Firestore audit records for both operations.

To run locally:

```bash
npx firebase-tools@15.30.2 emulators:exec \
  --project demo-luma-role-provisioning --only auth,firestore \
  'npm run test:run -- src/lib/tenant-admin-auth.emulator.test.ts --maxWorkers=1'
```

**Boundary:** emulator evidence demonstrates application integration, not Google IAM permissions of the production App Hosting service account. Production release still requires a controlled verified test-admin role assignment and revocation with actual project IAM, no real learner data, strict entitlement mode and tenant-scoped Firestore paths. Never claim that a passing emulator test proves a signed enterprise-pilot acceptance.
