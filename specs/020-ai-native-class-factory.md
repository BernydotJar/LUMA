# Spec 020 — AI-Native Class Factory and Evidence Loop

Status: draft-for-implementation
Owner: Product / Learning Intelligence
Harness: Graph-first

## Product thesis

LUMA should not treat a class as a static content page.

A class is an execution graph that moves a learner from a stated objective to observable evidence, while preserving source provenance, adaptation logic and coach visibility.

## Non-goal

This spec does not attempt to clone Platzi, an LMS, or a generic course-authoring product.

It defines the internal learning protocol that LUMA can use across programs.

---

## 1. Class contract

Every publishable class must expose this contract:

```ts
type LumaClassContract = {
  id: string;
  sourceIds: string[];
  capabilityId: string;
  objective: string;
  evidenceContract: {
    category: "observed" | "scored" | "self-reported";
    label: string;
    twinAuthority: "none" | "supporting" | "eligible";
  };
  diagnostic?: Diagnostic;
  topology: ClassTopology;
  keyIdeas: string[];
  practice: Practice;
  simulation?: Simulation;
  rubric?: Rubric;
  remediation: RemediationRule[];
  transfer: TransferTask;
  deferredRecheck?: RecheckRule;
};
```

### Invariants

- sourceIds must be non-empty;
- objective must describe an observable capability;
- self-reported evidence cannot independently raise mastery;
- scored evidence requires a rubric;
- sensitive topics require explicit human review;
- generated artifacts preserve source lineage;
- content refresh cannot automatically mutate a published class.

---

## 2. Runtime stages

### Stage 0 — Learning contract

Show the learner:

- what they will be able to do;
- approximately how long it takes;
- how they will prove it.

Do not expose internal model architecture.

### Stage 1 — Micro-diagnostic

One to three short, capability-specific decisions.

Possible route:

```
diagnostic
   ├── evidence strong → practice / transfer
   ├── mixed → key idea + practice
   └── weak → scaffolded explanation + practice
```

The diagnostic emits a receipt.

It does not certify mastery.

### Stage 2 — Explain / contrast / model

Short source-grounded teaching unit.

The topology decides presentation.

Examples:

- Concept → Contrast → Case → Transfer
- Scenario → Decision → Feedback → Replay
- Demonstrate → Diagnose → Remediate → Recheck
- Observe → Label → Interpret → Test

### Stage 3 — Practice

The smallest useful real application.

Practice should create a learner action, not only another content view.

### Stage 4 — Simulation

When the capability is behavioral or situational, create an environment with:

- role;
- context;
- constraints;
- success criteria;
- adaptive response;
- replay.

### Stage 5 — Assessment / evidence

Use the evidence contract.

Examples:

- criterion-based simulation result;
- teach-back;
- case analysis;
- artifact;
- observed behavior;
- coach-confirmed application.

### Stage 6 — Adaptive branch

If evidence is weak:

```
failed criterion
→ targeted explanation
→ smaller practice
→ retry
```

If evidence is strong:

```
strong criterion coverage
→ harder transfer case
→ optional accelerated path
```

### Stage 7 — Transfer

Move away from the original example.

The learner must use the capability in a new situation.

### Stage 8 — Deferred recheck

A later signal checks retention / transfer.

This avoids confusing a successful same-session attempt with durable capability.

---

## 3. Class Factory graph

```
Source Pack
  ↓
Ingest + Hash + Provenance
  ↓
Concept Extraction
  ↓
Objective Proposal
  ↓
Learning Designer Gate
  ↓
Topology Selection
  ↓
Lesson Atoms
  ↓
Challenge
  ↓
Simulation Candidate
  ↓
Rubric
  ↓
Evidence Contract
  ↓
Adversarial Learning Review
  ↓
Expert / Policy Gate
  ↓
Publish
  ↓
Learner Telemetry
  ↓
Reflection Candidate
  ↓
Impact Analysis
  ↓
Human Promotion
```

### Deterministic by default

Use deterministic workflow for:

- ingestion;
- provenance;
- state transitions;
- required artifacts;
- gate checks;
- scoring structure;
- publish authority;
- receipts.

### Agentic by exception

Bounded agent decisions may include:

- analogy vs case;
- scenario selection;
- remediation variant;
- explanation style;
- candidate difficulty.

No autonomous agent owns the entire workflow.

---

## 4. Class Quality Gate

A class is releasable only if the verifier can prove:

### Grounding
- source identifiers present;
- source boundary explicit;
- no unsupported high-impact claim.

### Pedagogy
- actionable objective;
- at least one application step;
- evidence contract;
- remediation rule;
- transfer task.

### Assessment
- scored class has rubric;
- rubric has observable criteria;
- feedback explains the criterion, not only the score.

### Learning Twin
- evidence category explicit;
- mastery update authority explicit;
- self-report alone cannot become mastery.

### UX
- mobile and desktop flows;
- target sizes;
- focus order;
- reduced motion;
- no generic "AI tutor" copy where a specific learning action is clearer.

### Governance
- sensitive content receives required human review;
- changes generate release evidence;
- source refresh produces candidate changes rather than silent production mutation.

---

## 5. Learning Twin interaction

The runtime emits events such as:

```
CLASS_DIAGNOSTIC_COMPLETED
CLASS_PRACTICE_COMPLETED
SIMULATION_COMPLETED
TRANSFER_DEMONSTRATED
DEFERRED_RECHECK_COMPLETED
```

Each event includes:

- learner;
- class;
- capability;
- source;
- evidence category;
- rubric result when applicable;
- timestamp;
- authority.

Twin updates are policy-controlled.

---

## 6. Coach interaction

The coach does not need the entire class-generation graph.

The coach sees:

- current capability;
- evidence strength;
- repeated failure criterion;
- recommended intervention;
- transfer status;
- uncertainty;
- source / provenance when needed.

Possible actions:

- accept recommendation;
- assign practice;
- ask for a recheck;
- leave contextual note;
- override / annotate with reason.

---

## 7. Content reflection / refresh

New content enters as a candidate:

```
new source
→ extract delta
→ map impacted classes
→ propose objective/content/rubric changes
→ regression test
→ expert review
→ promote
```

No live class changes merely because retrieval found a newer source.

---

## 8. Initial implementation target

Use current experience:
`pas-detectar-y-reformular`

### Objective
Distinguish event, automatic thought and emotion, then formulate a testable alternative.

### Diagnostic
Present a short scenario and ask the learner to identify which statement is the automatic thought.

### Practice
Current four-step practice.

### Simulation
Existing scored P.A.S. session.

### Evidence
Simulation criterion coverage is eligible evidence.

### Self-report
The reflection remains supporting evidence only.

### Remediation
If the learner confuses event and thought:

- show a contrast pair;
- ask one smaller distinction;
- retry the first simulation criterion.

### Transfer
Use a different real situation from the learner's own context.

### Deferred recheck
Offer another short case later.

---

## 9. Graph nodes

### LUMA-043 — Learning Pattern Research
Inputs: public sources + linked video transcripts/captions.
Output: adoption/rejection matrix.

### LUMA-044 — Pedagogy-as-Code Contract
Output: types, invariants and executable verifier.

### LUMA-045 — Adaptive Entry Diagnostic
Output: runtime component, events and routing.

### LUMA-046 — Simulation + Evidence Runtime
Output: generalized criterion / remediation contract.

### LUMA-047 — Self-Refreshing Class Factory
Output: generation + reflection + promotion graph.

### LUMA-048 — Learning Impact Observability
Output: participant/coach evidence mapping and outcome linkage.

### LUMA-049 — Class Intelligence Release
Output: adversarial learning review, E2E, build, Graph Harness receipts and release decision.

---

## 10. Release definition

This increment is done when:

- current published experiences satisfy the quality contract;
- P.A.S. has a functioning micro-diagnostic;
- diagnostic routing is visible and understandable on mobile and desktop;
- diagnostic evidence does not mutate mastery directly;
- P.A.S. simulation remains the scored reference;
- tests encode the core pedagogy invariants;
- Graph Harness records independent verification;
- client-facing language remains Spanish;
- existing Google login and profile behavior are not regressed.
