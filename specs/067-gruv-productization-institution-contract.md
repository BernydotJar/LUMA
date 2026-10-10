# LUMA-GRUV-001 — Institution configuration and product-shell separation

**State:** Candidate implementation, subject to Graph review and release gate.

## User outcome

As a LUMA product owner, I want to preserve the current Seres de Excelencia experience while preparing a distinct GRUV language product shell, so future institutions share learning intelligence without sharing branding, curriculum, access or learner data.

## Source constraints

- Seres stays the existing customer and retains its logo, color palette, text, feature behavior and deployment identity.
- GRUV is the new chosen name of the planned language product; it is not a tenant authorization mode.
- No fork, no second learning engine, no new runtime/provider, no unverified SaaS claims.
- Existing `resolveLearningEntitlement` remains the only current path to an authorized `{tenantId, programId}` under entitled mode; showcase mode is not an enterprise authorization mode.

## Acceptance criteria — current increment

1. **AC-01 Brand continuity:** the `se` theme uses its original label, logo URL and five colors; existing markup and theme selection remain unchanged in behavior.
2. **AC-02 Domain boundary:** a product shell (`luma-platform` or `gruv-languages`) is separate from tenant identity and program membership.
3. **AC-03 GRUV declaration:** a language-specific GRUV template exists; voice, commerce and certification are not silently activated or represented as deployed.
4. **AC-04 Explicit scope:** a configuration is returned only for an authorized tenant/program pair; missing, incorrect or malformed scope fails closed.
5. **AC-05 No implicit defaults:** unknown tenants do not resolve to Seres, and programs of another institution are rejected.
6. **AC-06 Failure transparency:** a configuration store error is surfaced, not converted into an empty state or a different institution.
7. **AC-07 Runtime parity:** no production mode, tenant entitlement, CI/CD or Firebase runtime configuration changes in this slice.
8. **AC-08 Tests:** positive templates, security-negative cases, existing themes, TypeScript and current build pass before proposing promotion.

## Out of scope

Self-service tenant creation, new database migrations, payment activation, external asset uploads, language lessons, CEFR certification, production GRUV application, tenant pickers, or provisioning SaaS tenants. A design-time template or synthetic store is not proof of cross-tenant database/RAG isolation.

## Architecture notes

- `src/lib/institutions/public-brand.ts`: public-only brand metadata used by existing SE visuals.
- `src/lib/institutions/config.ts`: neutral immutable composition, schema validation and fail-closed lookup by **already authorized** learning scope.
- `src/lib/institutions/templates.ts`: Seres and GRUV product templates outside the neutral configuration engine.
- No `tenantId` is accepted from query strings, unverified browser state or theme selection.
- A future trusted store must return versioned institution configurations and implement atomic publish, idempotent event and audit contracts. Until then this module is NOT wired into access decisions.

## Required Critic challenges

A) Does any unknown tenant fall back to SE? B) Does a GRUV program access an SE program? C) Are logos remote/external by default? D) Does store outage become a successful blank state? E) Does a template accidentally enable billable providers? F) Did any production customer behavior change? G) Does the new source exceed its verified capabilities?

## Evidence

`evidence/gruv-productization-001/` must carry exact commands, exit codes, independent tests and outstanding gates. No automatic promotion of this node to `done`.
