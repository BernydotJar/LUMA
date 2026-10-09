# LUMA — Solution Architecture

**Current implementation VERIFIED in repository; exact deployed topology and real provider activation NOT YET VERIFIED.**

```mermaid
flowchart TD
  Hotmart -->|Authenticated Hottok webhook| H[Hotmart adapter]
  Stripe -->|Signed HMAC webhook| S[Stripe adapter]
  H --> E[Normalized commerce event]
  S --> E
  E --> L[(Idempotent event ledger)]
  L --> M[Product / tenant / cohort mapping]
  M --> T[(Purchase-scoped entitlement)]
  T --> R[(Enrollment)]
  R --> I[Verified Firebase learner identity]
  I --> P[Live, evergreen or blended program]
  P --> B[Baseline + scored practice + reflection]
  B --> Twin[Evidence-backed persistent Learning Twin]
  Twin --> AI[Guided AI Coach]
  Twin --> CI[Scoped Coach Intelligence]
  Corpus[Permissioned video/audio/docs] --> Rag[Transcript + metadata + RAG]
  Rag --> AI
```

## Security and operations boundaries

- Provider authentication happens before normalized events; webhook payloads do not belong in the learning domain.
- State mutations use Firebase Admin; repository Firestore client rules deny all direct reads/writes.
- Purchase identity = tenant + customer + canonical product + stable purchase key. One refund cannot affect a separate purchase.
- Verified-email access claim binds a commerce enrollment to a Firebase user. Authenticated onboarding initializes `learners/{uid}`; purchase alone does NOT produce fabricated learning mastery.
- Live-cohort offering assignments, timezone-aware schedule and optional recording are independent of content playback.
- Coach APIs enforce claims/scope. Commerce mapping and trace APIs use **global admin authorization**, not tenant-self-service.
- App Hosting code config: CPU 1, memory 512 MiB, min 0 / max 2 instances, HTTP concurrency 80. This is NOT a measurement of active learners.

## Current vs target

**Current pilot:** Next.js, Firebase Auth, Firestore ledger/enrollment, AI + optional RAG/voice service boundaries, demo surfaces.

**Target production:** measured concurrency, provider sandbox receipts, settlement/reconciliation operational plan, tenant-specific privacy controls on all real-data surfaces, alerting, backup/restore rehearsal, RTO/RPO based on proof, retention and AI handling agreement.

**Blocking privacy caveat:** `/studio/learners/mariana` publicly displays example Twin evidence. It must remain fictional; real participant data requires server-side tenant-and-coach authorization on every UI/export path before launch.
