# Arcadia scripted progress belongs to showcase

**Status:** Accepted  
**Date:** 2026-10-09  
**Affects:** `lib/showcase/arcadia-multitask-demo.ts`, Arcadia multitask provider and dashboard

## Context

Arcadia worker runs now supply progress through awareness events and board polling. The
original demo tick was disabled, but its required context property and interval call remained,
causing TypeScript errors. The scripted scenario is still useful as offline replay data.

## Decision

- Preserve the original scenario in `lib/showcase/arcadia-multitask-demo.ts`.
- Expose a fresh demo state and a pure tick function with an explicit timestamp. Playback
  owns its clock; milestones have deterministic ids and ticks stop when scripts are exhausted.
- Share roster identities and voice assignments through the existing roster factory. Only
  showcase applies the scripted goals, progress, status, and milestones.
- Remove the demo callback, interval, and Tick button from the live provider and dashboard.
  Live progress continues through worker awareness and board polling.

## Consequences

Showcase replay has no API or Speak calls, and independent replays can reset without sharing
a mutable cursor. The original nine-second cadence is exported for a playback controller.
This replaces the scripted data source described in section 4 of the
[original multitask Speak ADR](../../speak/decisions/20260925-multitask-subagent-speak.md).
