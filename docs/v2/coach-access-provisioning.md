# LUMA coach authorization — scope provisioning

Coach tokens must include **both** the coach role (`coach: true` or `role: "coach"`) and an explicit allowed scope. Plain `{ coach: true }` is intentionally rejected (`403 coach_scope_required`) because it does not identify authorized tenants or learners.

Scope claims accepted by the API: `coachTenantIds` for tenants whose **active enrolled learners** may be viewed, or `coachLearnerIds` for explicitly assigned learners. Admin/superuser identities have independent unrestricted access. Do not grant either privilege to a coach merely to bypass scoping.

For an existing coach, first review the assignment with a dry-run:

```bash
node scripts/provision-coach-scopes.mjs --project luma-learning-intelligence --uid <COACH_FIREBASE_UID> --tenant-id <AUTHORIZED_TENANT_ID>
```

Then explicitly apply after checking the project and tenant:

```bash
node scripts/provision-coach-scopes.mjs --project luma-learning-intelligence --uid <COACH_FIREBASE_UID> --tenant-id <AUTHORIZED_TENANT_ID> --apply
```

The script uses Admin SDK Application Default Credentials, preserves the account's existing custom claims, and merges assignments. For a one-to-one coach relationship, use `--learner-id <AUTHORIZED_LEARNER_UID>` instead. Multiple scopes can be added by repeating flags. No account is provisioned automatically; an authorized operator must supply and approve the real UID and scope. Revoking old or incorrect scopes requires an explicit administrative change.

After claims change, refresh/re-authenticate the coach's Firebase ID token so the new claims take effect. Run the emulator smoke flow `scripts/coach-api-emulator-smoke.sh`: it now grants the test coach `coachLearnerIds: [learner.uid]` and validates list/detail authorization. Existing production coaches configured only with `coach: true` must be explicitly migrated before their scoped Studio APIs work.
