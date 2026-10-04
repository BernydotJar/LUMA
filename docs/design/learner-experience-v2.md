# LUMA Learner Experience v2 — Design Rationale

## Why this redesign exists

The previous release proved the intelligence layer but visually behaved too much like a dashboard. The new learner experience moves internal intelligence behind the visible learning decision.

The main experience now says:

> Today you do not need another lesson. You need to prove it.

That sentence demonstrates adaptation without explaining vector state, reflection pipelines, or recommendation internals.

## Visual system

The palette intentionally moves away from dark green AI SaaS:

| Role | Color family |
|---|---|
| Learning canvas | warm cream / off-white |
| Primary ink | deep brown |
| Adaptive action | burgundy |
| Energy / motion | burnt orange |
| Progress / demonstrated evidence | muted avocado |
| Highlight | mustard |

Liquid glass is used for:
- navigation shell;
- session brief;
- Learning Pulse overlays;
- selected contextual surfaces.

It is not used as the universal card style.

## Scrolltide / Mariana translation

What LUMA borrows:
- spatial depth rather than flat card grids;
- visual choreography around one focal object;
- large typography;
- motion that reinforces hierarchy;
- authored asymmetry.

What LUMA does not copy:
- underwater imagery;
- cinematic scroll as the primary navigation model;
- ornamental motion that slows task completion.

## 3D icon strategy

The reviewed 3dicon workflow can output seamless animated WebP assets with transparency. LUMA's current Learning Pulse is implemented in CSS so the release has:
- no external model dependency;
- no runtime asset dependency;
- accessible textual equivalents;
- reduced-motion compatibility.

Once the information architecture is accepted, semantic icons can be generated for:
- Practice;
- Twin;
- Mastery;
- Simulation;
- Human help.

## Product trade-off

The learner home intentionally hides many measurements that still exist in the system. This is not lost functionality. It is information architecture: action first, analytics second.
