# SPEC-003 — Curriculum Knowledge Graph

**Status:** product visualization and domain contract complete; persistent graph adapter is a production extension

## Outcome

Represent the selected curriculum as concepts, competencies, prerequisites, misconceptions, learning objects, assessments, and source-backed relationships.

## User value

- Learners receive precise actions instead of entire-module recommendations.
- Tutor search can return an exact segment plus related prerequisite and practice.
- Creators can inspect how content maps to learning outcomes.
- Instructors can see concept-level bottlenecks.

## Scope

- graph node and edge contract;
- Module 3 concept-map visualization;
- prerequisite-aware recommendation inputs;
- curriculum versioning and publication policy;
- provenance on every published node and edge;
- graph repository abstraction independent of vendor.

## Non-goals

- selecting a graph database before measured need;
- treating learner behavioral state as shared curriculum graph data;
- auto-publishing AI-generated relationships;
- using folders as semantic nodes unless the curriculum owner explicitly models them.

## Acceptance criteria

1. `/library` visualizes concepts and relationships for the selected slice.
2. At least one strict prerequisite chain is documented.
3. Concepts reference source provenance.
4. Draft and approved graph states are architecturally distinct.
5. Published graph versions are immutable.
6. Recommendations can penalize unmet prerequisites.
7. Strict prerequisite cycles are rejected by policy.
8. The architecture supports PostgreSQL first and a replaceable graph adapter.
9. Learner state references graph IDs without being stored in the shared graph.

## Required relationships

```text
PREREQUISITE_OF
COMPOSES
REQUIRES
TEACHES
DEMONSTRATES
PRACTICES
ASSESSES
DETECTS
CONCERNS
SUPPORTS
RELATED_TO
CONTRASTS_WITH
```

## Publication workflow

```text
AI or import proposal
  -> schema validation
  -> duplicate and cycle checks
  -> source/provenance validation
  -> expert review
  -> approval receipt
  -> immutable curriculum version
```

## Failure behavior

- cycle detected: block draft publication and show path;
- missing source segment: block affected node/edge;
- duplicate concept: propose alias or merge review, never auto-delete;
- deprecated node: exclude from new journeys while preserving historical receipts;
- repository unavailable: use pinned read cache for existing journeys and block publication.

## Verification

- architecture contains node/edge contracts and versioning;
- product graph renders on desktop and mobile;
- deterministic recommendation tests exercise prerequisite penalties;
- no approved object can exist without provenance;
- graph version is included in future recommendation and tutor receipts.

## Evidence

- `architecture/knowledge-graph.md`
- `src/app/library/page.tsx`
- `src/lib/learning-engine.ts`
- `src/lib/learning-engine.test.ts`
- `evidence/verification/unit-tests.log`
