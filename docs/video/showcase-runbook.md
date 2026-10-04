# Private Course Video Showcase Runbook

## Recommended representative source

Start with:

`ENTRENADORES DE TRANSFORMACIÓN INTEGRAL MODULO 1 - CLASES 2_Recording_1920x1080.mp4`

Drive ID:

`1EqcJC9MJKZjdspwcJkeKFXmcShIRzHmt`

Approximate size:

1.27 GB

This is operationally preferable to the approximately 9 GB Class 1 MOV for the first controlled ingestion exercise.

## Preflight

1. Confirm the user/client owns the content or has permission to process and demo it.
2. Confirm whether the coach/participants appearing in video consent to the intended demo use.
3. Confirm whether the selected segment contains third-party music, images or materials.
4. Record source visibility and access boundary.
5. Do not create a public Drive link.

## Controlled materialization

- materialize into private working storage;
- compute SHA-256 before transformation;
- record file size, MIME type, duration, frame rate and audio streams;
- keep original immutable.

## Representative segment

Select a 60–120 second section that:

- contains one coherent concept;
- has clean audio;
- can stand without disclosing sensitive participant information;
- naturally leads into a practice;
- avoids unsupported high-stakes claims unless the demo is explicitly about trust controls.

## Derivatives

- source-preserving transcript;
- WebVTT captions;
- chapter/title metadata;
- 16:9 poster;
- H.264/AAC MP4 preview;
- optional HLS 720p/480p;
- source receipt with exact time range;
- transcript/source alignment.

## Showcase behavior

The learner sees:

- why the segment is relevant;
- the exact clip;
- captions;
- a short practice.

The coach sees:

- source ID and time range;
- concept alignment;
- exposure event;
- subsequent transfer evidence.

## Evidence rule

`VIDEO_SEGMENT_COMPLETED` records exposure.

It does not update mastery by itself.

A separate practice or assessment event supplies capability evidence.
