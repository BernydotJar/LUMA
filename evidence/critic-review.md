# Product Critic Review

Review date: 2026-10-04
Review scope: LUMA Product Showcase Release
Role: adversarial product, engineering, trust, accessibility, and demo-readiness critic

## Review posture

The critic attempted to disprove the following claim:

> LUMA is ready to be shown to real clients as a coherent AI-native learning product rather than a static demo.

A feature was not accepted because a screen existed. The review looked for dead-end interactions, unsupported AI claims, misleading production language, brittle mobile behavior, inaccessible controls, security noise, missing provenance, and incomplete product narrative.

## Findings discovered and repaired

### CRIT-001 — Test toolchain incompatible with runtime types

**Finding:** Vitest 5 required Node type definitions compatible with Node 22, while the initial scaffold used Node 20 types. Dependency installation failed.

**Risk:** a repository that cannot install cleanly is not demo- or team-ready.

**Repair:** aligned `@types/node` with Node 22, the actual sandbox and CI runtime.

**Verification:** clean dependency installation, typecheck, unit, build, and E2E pass.

### CRIT-002 — Invalid ARIA on visual progress elements

**Finding:** non-semantic `div` elements used `aria-label` without a valid role. axe reported five violations.

**Risk:** accessibility claims would be false; assistive technology received incomplete semantics.

**Repair:** added explicit `progressbar`/`img` roles and value attributes where appropriate.

**Verification:** automated WCAG A/AA sweep passes on the key client-facing routes.

### CRIT-003 — Onboarding contrast insufficient

**Finding:** several muted labels in the light onboarding surface did not meet automated color-contrast thresholds.

**Risk:** visual polish hid a real readability and accessibility defect.

**Repair:** darkened muted text tokens in the onboarding surface without changing the visual system.

**Verification:** axe contrast checks pass.

### CRIT-004 — Mobile browser project was configured for an unavailable engine

**Finding:** the Playwright device profile implicitly selected WebKit, while only Chromium was installed in the controlled environment.

**Risk:** mobile validation failed for infrastructure reasons and could be mistaken for product coverage.

**Repair:** explicitly pinned the mobile emulation project to Chromium.

**Verification:** five mobile product flows pass; the duplicated mobile accessibility sweep is intentionally skipped because desktop Chromium already performs the route-wide axe scan.

### CRIT-005 — Generated report was linted as source code

**Finding:** the generated Playwright HTML report was included in ESLint traversal.

**Risk:** quality commands were not reproducible after running E2E.

**Repair:** excluded generated report and test-result paths from ESLint and Git.

**Verification:** lint passes after E2E output exists.

### CRIT-006 — Intervention queue lacked valid table semantics

**Finding:** an initial ARIA table implementation used rows without cell roles.

**Risk:** the Learning Studio looked correct visually but exposed invalid accessibility structure.

**Repair:** the queue now uses a complete ARIA table hierarchy with table, row, columnheader, and cell roles while preserving mobile card behavior.

**Verification:** typecheck, lint, E2E, and axe pass.

### CRIT-007 — Product scope could be mistaken for full production ingestion

**Finding:** a polished product could imply that the three multi-gigabyte videos had already been transcribed and indexed.

**Risk:** client trust and technical due diligence failure.

**Repair:** the library explicitly labels videos as transcription pending and the support ZIP as requiring licensing review. Architecture and specs distinguish the functioning showcase from production persistence, queues, identity, and provider credentials.

**Verification:** source state is visible in `/library`; inventory and architecture documents use the same boundary.

### CRIT-008 — AI scores risked appearing authoritative

**Finding:** an attractive Learning Twin could make inferred scores look like objective truth.

**Risk:** unsafe learner profiling and low trust.

**Repair:** evidence is visibly separated into observed, inferred, and self-reported categories. Inference confidence, correction, export, and projection caveats are product interactions—not only documentation.

**Verification:** `/twin` exposes filters, confidence, correction, export, and prediction assumptions.

### CRIT-009 — Recommendation risked being a decorative card

**Finding:** a showcase could display a “best next action” without a functioning action or deterministic rationale.

**Risk:** the AI-native thesis would collapse under live questioning.

**Repair:** implemented a typed deterministic ranking engine, four golden unit tests, an inspectable “Why this?” panel, and a complete practice that emits an event receipt.

**Verification:** unit and E2E tests pass; `SIMULATION_COMPLETED` is written to browser storage in the showcase flow.

### CRIT-010 — Temporary preview artifacts polluted release packaging

**Finding:** full-page QA screenshots, temporary Cloudflare logs, PIDs, browser reports, and test-result folders existed in the working tree.

**Risk:** large/noisy repository, accidental public QA assets, and poor handoff quality.

**Repair:** removed ephemeral assets; retained only compact contact sheets, structured audit results, and concise summaries. Added ignore rules.

**Verification:** final Git status contains only intentional source, docs, evidence, and configuration.

## Residual risks

### RISK-001 — Showcase persistence is browser-local

The onboarding and practice receipts are real interactions, but they are stored in local browser storage for the showcase. Production requires authenticated append-only server events and versioned Twin projection workers.

**Disposition:** accepted as an explicit release boundary; architecture and specs define the migration.

### RISK-002 — Tutor is deterministic, not full provider-backed RAG

The tutor endpoint is operational and source-backed for the selected concepts. It is not yet connected to a model provider, vector store, or citation validator.

**Disposition:** accepted for showcase because the product interaction and structured contract are real and do not falsely claim provider-backed generative breadth.

### RISK-003 — Video ingestion pending

The selected videos are manifested but not materialized/transcribed in this repository.

**Disposition:** accepted and visibly labeled; production ingestion is blocked on processing credentials, storage, rights policy, and cost decision.

### RISK-004 — Development dependency audit alerts

The full npm audit reports five high-severity findings in the ESLint development chain. The production dependency audit reports zero. The automated force fix would downgrade Next.js to an incompatible major version.

**Disposition:** document and monitor upstream; do not apply a destructive false fix. This does not affect the deployed production dependency graph.

### RISK-005 — Automated accessibility is not a complete manual audit

axe and keyboard-visible focus provide strong baseline coverage, but manual screen-reader, zoom, reduced-motion, and cognitive walkthrough testing remain production release requirements.

**Disposition:** accepted for Product Showcase Release; add manual audit before broad public production.

## Critic conclusion

The original “demo” framing was rejected. After repairs, the repository supports a coherent client narrative and live interactions across learner, content, Twin, tutor, practice, and instructor perspectives.

The remaining gaps are production infrastructure and external-service integrations, not missing product thinking or fake controls. The release may proceed as **Product Showcase Release**, provided the boundary is stated exactly as documented.
