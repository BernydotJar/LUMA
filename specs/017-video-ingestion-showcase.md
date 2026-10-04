# SPEC 017 — Private Course Video Ingestion and Showcase

## Source inventory

Private Drive corpus includes:

- Module 1 / Class 1: `NBC_Clase_1_2026_08_26.mov`, approximately 9.0 GB;
- Module 1 / Class 2: `ENTRENADORES DE TRANSFORMACIÓN INTEGRAL MODULO 1 - CLASES 2_Recording_1920x1080.mp4`, approximately 1.27 GB;
- supporting PDFs and exercise images.

The files are private and are not directly public-streamable from Firebase.

## Objective

Use one rights-cleared representative segment to demonstrate that LUMA can transform real course video into a source-backed learning object.

## Pipeline

1. rights/ownership confirmation;
2. controlled materialization;
3. SHA-256 and immutable source receipt;
4. `ffprobe` media inventory;
5. representative segment selection;
6. transcription and captions;
7. chapter/concept alignment;
8. unsupported-claim scan;
9. poster and preview generation;
10. H.264/AAC MP4 and optional HLS renditions;
11. private object storage / signed delivery;
12. learning-event instrumentation;
13. Firebase showcase smoke.

## Recommended first asset

Start with the Class 2 MP4 because it is substantially smaller than the Class 1 MOV. Select a 60–120 second conceptually complete segment after rights review.

## Product presentation

The coachee sees:

- exact source segment;
- why it is relevant now;
- transcript/captions;
- optional practice after the segment.

The coach sees:

- source lineage;
- concept alignment;
- engagement only as exposure evidence;
- subsequent transfer evidence.

## Invariant

Watching a video is exposure. It is not mastery.

## Acceptance criteria

1. No private Drive file is exposed publicly.
2. Rights gate precedes download/transcode.
3. Every derivative points to source ID, checksum and time range.
4. Captions are available.
5. Playback works on desktop/mobile.
6. Completion records exposure only.
7. A subsequent practice can create capability evidence.
