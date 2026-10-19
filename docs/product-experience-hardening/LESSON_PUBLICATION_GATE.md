# LUMA Course Player — Content Publication & Resume Gate

**State:** BLOCKED — real licensed curriculum and published media manifest are not yet available as a verified QA fixture. This is an enterprise release dependency, not an invitation to invent curriculum or link directly to private Google Drive content.

## Why seven module covers are not a course

The current Practitioner front end exposes seven **editorial module covers**, selected practice previews and PAS simulated feedback. It cannot honestly certify all modules, video lessons, instructor-led sessions or a full-program completion. The API currently protects enrollment and scored progress; approved, cohort-specific premium lesson assets need a separate server-authorized delivery pipeline.

## Implementation acceptance contract (node LUMA-CX-106)

1. **Publication manifest:** institutional publisher owns `tenantId/programId/moduleId/lessonId`, immutable version, reviewed title, outcome, authorized instructor, source/content hash, entitlement tier, visibility, provider, locale, and effective publication window. Draft and withdrawn items are not exposed to learners.
2. **Content safety:** media stored in an institution-approved Google Cloud Storage bucket (or authorized equivalent); signed time-limited URLs issued only after Firebase JWT, tenant, program and active enrollment checks, including on renewals and revoked access. No raw, durable Drive share links or service-account secrets in client bundles.
3. **Course player:** module outline → actual unit → content type (video/read/document/live) → progress checkpoint; explicit unavailable, upcoming and failed states. Transport and seek behavior accessible via keyboard, captions/transcripts when approved, reduced motion, touch targets and appropriate loading indicators.
4. **Checkpoints:** per-UID/tenant/program/lesson: playback position, duration, completed flag, event timestamp, content revision; race-safe idempotent writes, server timestamps, no progress credit for merely opening a card, and reopen from another browser at the correct position.
5. **Academic completion:** lesson-consumption signals are not equivalent to graded mastery. Assessed tasks require rubric records; certifications require separately published institutional rules, authorized signer and verification.
6. **Instructor:** only coach/admin with actual scope publishes, schedules or withdraws content. Publication changes and content rights keep review receipts.
7. **Reproducible tests:** Jeremy resumes mid-video on a fresh browser, Abigail sees correct locked/preview state, Adán sees authorized transcripts and asks grounded questions; tenant B and refunded learner are denied every asset and checkpoint; late/stale concurrent writes do not regress progress.

## Required inputs to unblock

Institution-approved lesson inventory for all seven modules; actual media/transcript files and copyright/access rights; tenant/cohort mapping; instructor-approved ordering and completion standards; QA-owned storage bucket or signed-delivery credentials; one end-to-end published sample lesson fixture. Until these exist, the graph gate stays **BLOCKED** and LUMA remains NO-GO as a complete premium-course LMS.

**Graph artifact:** `graph-harness.learner-lifecycle.project.json`, node `LUMA-CX-106-course-player`. No deployment, media publication, tenant permissions, Hotmart live webhook or certification is authorized by this plan alone.

## Verified source inventory — 2026-10-13

A read-only Google Drive metadata inspection found **all seven source documents** referenced by the module catalog: six PDFs and one DOCX (see `evidence/learner-lifecycle-20261013/curriculum-source-metadata.json`). This confirms the document references exist and are accessible to the connector, not that LUMA has rights to redistribute them or that the digital course lesson inventory is published. The documents' specific titles and educational contents must pass institutional editorial approval; metadata access alone does not establish an approved syllabus. No actual approved video media, trainer transcripts, learner progress checkpoints or source-license grant was verified in this inspection.

**Impact on graph node LUMA-CX-106:** DOCUMENT SOURCE INVENTORY READY; PUBLISHED LESSON/SECURE MEDIA/RESUME DELIVERY BLOCKED. No public raw Drive deep-link delivery should be used as a substitute for program-entitled access.

## Incremental implementation — kernel verified, customer publication BLOCKED

The first reusable **course-delivery kernel** is now implemented on the draft PR branch and independently exercised with fictitious teaching assets. It includes a rights-reviewed, tenant/program-scoped published catalog; protected media lease endpoint (GCS URL disabled unless private storage is explicitly confirmed); client video/document view; a durable per-UID/tenant/program/version resume checkpoint; server-transaction entitlement revalidation; no-grade consumption provenance; and a truthful empty state on `/learn/course`. See `COURSE_DELIVERY_KERNEL_20261013.md` and the synthetic E2E receipt (12/12 PASS).

This supersedes the earlier architectural *absence* of a resume/checkpoint implementation: **code now exists and passed emulator/browser tests**, but no real institution-owned media, publication approval, captions, private bucket or instructor-reviewed completion has been onboarded. To unblock this node, the editorial authoring/publishing control, licensed content and genuine media delivery plus human acceptance still need execution. Do not confuse code for an operational course. `LUMA-CX-106` remains **BLOCKED**.

## Latest engineering review — 2026-10-19

Local acceptance of the **infrastructure slice** was rechecked: 15/15 synthetic learner journeys, 54/54 Firestore integration checks, and 7 desktop/mobile guest browser assertions (one intentional skip). Publishing a lesson requires an explicit rights-approved publication receipt and private media object; the module covers are not lessons. The remaining release requirements (publisher authorization, real media, access rights, captions, staging and human confirmation) remain unchanged. Production and actual customer storage were not modified.
