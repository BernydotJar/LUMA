# LUMA — Responsive Program Concept

## Problem

The learner surface was functionally correct but the mobile composition still behaved like a desktop dashboard compressed into a phone. The practice shelf also repeated a generic AI-app pattern: rounded cards, soft gradients, equal-weight panels.

## Design exploration

Before implementation, three directions were compared.

### Direction A — Practitioner Folios + Field Notes

The program feels like a premium collection of practitioner folios: vertical numbering, editorial folds, physical depth and a CoverFlow interaction. Suggested practices appear as field notes rather than dashboard cards.

Strengths:
- directly connected to the source program;
- supports seven modules without looking like a module grid;
- strong visual identity on mobile;
- works across SE, Claro and Oscuro themes;
- differentiates program navigation from practice interaction.

### Direction B — Constellation Route

Modules become nodes in a large learning constellation with paths between capabilities.

Strengths:
- strong metaphor for a personalized route.

Risks:
- less direct for a first-time learner;
- easy to turn into decorative complexity;
- weaker connection to the existing Practitioner identity.

### Direction C — Glass Atelier

Modules become large translucent sheets in a spatial stack.

Strengths:
- visually compatible with liquid-glass surfaces.

Risks:
- too close to current AI-generated design conventions;
- risks becoming a collection of polished glass cards.

## Selected direction

**Direction A — Practitioner Folios + Field Notes.**

The interaction borrows the perspective and active-card mechanics of the Amicro CoverFlow component, but the visual language is LUMA-specific rather than copied: program folios, editorial numbering, source-aware statuses and distinct mobile gestures.

## Mobile rules

- real phone validation at 375×667, 390×844 and 430×932;
- no horizontal document overflow;
- no topbar/control collision;
- fixed bottom navigation remains reachable;
- program covers swipe horizontally;
- module pagination exposes all seven modules;
- practice suggestions use horizontal snap on mobile;
- new touch targets are at least 40–44 px where the interaction is discrete;
- reduced-motion users do not receive spring or drag motion.

## Language rule

Client-facing product terminology is Spanish for this release. Internal identifiers remain stable. A later i18n graph will externalize strings rather than mixing languages in the current UI.

## Content rule

All seven Practitioner modules are visible to the learner. A module may be visible even when its digital practices are still under editorial review. Source material is not silently converted into claims of efficacy or mastery.
