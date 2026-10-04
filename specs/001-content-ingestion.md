# SPEC-001 — Content Ingestion

**Status:** implemented as source-backed showcase slice; production pipeline specified

## Outcome

Register one representative Module 3 corpus slice, preserve immutable provenance, expose its processing and rights state, and make approved source structure available to learner and instructor experiences.

## User value

- A creator can see what was ingested, what remains pending, and why.
- A learner can trace a concept or tutor answer to the original source.
- A buyer can distinguish a real connected corpus from generated placeholder content.

## Scope

### Showcase release

- real Google Drive IDs and source links for Module 3;
- source inventory for PDF, three videos, and support ZIP;
- PDF-derived section/concept structure;
- content-quality component view;
- explicit transcription and licensing states;
- immutable provenance model documented.

### Production extension

- resumable asset materialization;
- checksums and object storage;
- document extraction and video transcription;
- checkpointed stages and job receipts;
- reviewer workspace and publication gate.

## Non-goals

- silently ingest all seven modules;
- publish supporting books without rights review;
- claim completed video transcription before artifacts exist;
- mutate or reorganize source Drive assets.

## Acceptance criteria

1. The product displays the real Module 3 title and links to the source PDF.
2. Every selected asset has an immutable external ID, type, and processing state.
3. The UI distinguishes `inventoried`, `pending transcription`, and `licensing review`.
4. Generated concepts are presented as graph/curriculum objects, not raw folders.
5. No product copy claims that pending assets are fully processed.
6. Architecture defines checksum, stage checkpoint, rights, and provenance requirements.
7. Source assets remain unchanged.
8. The library route renders without browser errors on desktop and mobile.

## Data contract

```ts
type SourceAsset = {
  assetId: string;
  tenantId: string;
  corpusId: string;
  externalProvider: "google_drive" | "upload" | "lms";
  externalId: string;
  canonicalUrl: string;
  filename: string;
  mimeType: string;
  byteSize?: number;
  rightsStatus: "unknown" | "review_required" | "approved" | "restricted";
  ingestionState: string;
  checksum?: string;
  sourceModifiedAt?: string;
};
```

## Failure behavior

- unknown rights: manifest only; block publication and external-model processing;
- source unavailable: keep prior immutable revision and show stale/source-unavailable state;
- extraction failure: preserve previous stage receipt and retry from failed stage;
- checksum mismatch: stop and require source reconciliation;
- partial video: do not expose transcript-derived objects.

## Verification

- route `/library` shows source-backed slice and states;
- Drive inventory is documented in `docs/content-inventory.md`;
- browser visual audit reports no horizontal overflow or clipped text;
- WCAG automated scan passes;
- source links resolve through the authenticated user context when available.

## Evidence

- `docs/content-inventory.md`
- `architecture/content-intelligence.md`
- `src/app/library/page.tsx`
- `evidence/verification/e2e.log`
- `evidence/verification/visual-layout-audit.json`
